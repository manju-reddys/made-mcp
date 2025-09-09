import fs from "fs-extra";
import * as path from "path";
import {
  LintIssue,
  IndexMeta,
  ListTokensResponse,
  ListComponentsResponse,
  GetComponentResponse,
  ScaffoldComponentResponse,
  SearchExamplesResponse,
  LintMarkupResponse,
  HealthCheckResponse,
  VersionResponse,
} from "./types.js";
import { IndexManager } from "./indexing/index-manager.js";
import { MarkupLinter } from "./linting/markup-linter.js";
import { ComponentScaffolder } from "./scaffolding/component-scaffolder.js";
import { SearchEngine } from "./search/search-engine.js";
import { logger } from "./utils/logger.js";

export class MADEMCPServer {
  private indexManager: IndexManager;
  private markupLinter: MarkupLinter;
  private componentScaffolder: ComponentScaffolder;
  private searchEngine: SearchEngine;
  private initialized = false;

  constructor() {
    this.indexManager = new IndexManager();
    this.markupLinter = new MarkupLinter();
    this.componentScaffolder = new ComponentScaffolder();
    this.searchEngine = new SearchEngine();
  }

  async initialize(): Promise<void> {
    try {
      logger.info("Initializing MADE MCP Server...");

      // Ensure data directories exist
      await fs.ensureDir("./data/indexes");
      await fs.ensureDir("./data/cache");

      // Load indexes
      await this.indexManager.loadIndexes();

      // Initialize search engine with indexes
      await this.searchEngine.initialize(
        this.indexManager.getComponents(),
        this.indexManager.getTokens()
      );

      // Initialize linter with design system rules
      await this.markupLinter.initialize(this.indexManager.getTokens());

      // Initialize scaffolder with components
      await this.componentScaffolder.initialize(
        this.indexManager.getComponents()
      );

      this.initialized = true;
      logger.info("MADE MCP Server initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize MADE MCP Server:", error);
      throw error;
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error("Server not initialized. Call initialize() first.");
    }
  }

  async listTokens(scope?: string): Promise<ListTokensResponse> {
    this.ensureInitialized();

    const allTokens = this.indexManager.getTokens();
    const filteredTokens = scope
      ? allTokens.filter((token) => token.category === scope)
      : allTokens;

    return {
      tokens: filteredTokens,
      meta: {
        totalCount: allTokens.length,
        filteredCount: filteredTokens.length,
      },
    };
  }

  async listComponents(): Promise<ListComponentsResponse> {
    this.ensureInitialized();

    const components = this.indexManager.getComponents();

    return {
      components: components.map((component) => ({
        name: component.name,
        description: component.description,
        tags: component.tags,
        variants: component.variants,
        props: component.props,
        a11yNotes: component.a11yNotes,
      })),
    };
  }

  async getComponent(name: string): Promise<GetComponentResponse> {
    this.ensureInitialized();

    const component = this.indexManager
      .getComponents()
      .find((comp) => comp.name.toLowerCase() === name.toLowerCase());

    if (!component) {
      throw new Error(`Component '${name}' not found`);
    }

    return {
      name: component.name,
      description: component.description,
      tags: component.tags,
      variants: component.variants,
      props: component.props,
      a11yNotes: component.a11yNotes || [],
      htmlScaffold: component.htmlScaffold,
      cssClasses: component.cssClasses,
      cssVarsUsed: component.cssVarsUsed,
      examples: component.examples,
      html: component.htmlScaffold,
      classes: component.cssClasses,
    };
  }

  async scaffoldComponent(
    name: string,
    props?: Record<string, any>
  ): Promise<ScaffoldComponentResponse> {
    this.ensureInitialized();

    const component = this.indexManager
      .getComponents()
      .find((comp) => comp.name.toLowerCase() === name.toLowerCase());

    if (!component) {
      throw new Error(`Component '${name}' not found`);
    }

    return await this.componentScaffolder.scaffold(component, props);
  }

  async searchExamples(query: string): Promise<SearchExamplesResponse> {
    this.ensureInitialized();

    const results = await this.searchEngine.search(query);

    return {
      results,
      meta: {
        totalResults: results.length,
        query,
      },
    };
  }

  async lintMarkup(html: string): Promise<LintMarkupResponse> {
    this.ensureInitialized();

    const issues = await this.markupLinter.lint(html);

    return {
      valid: issues.filter((issue) => issue.type === "error").length === 0,
      issues,
      suggestions: this.generateLintSuggestions(issues),
    };
  }

  async healthCheck(): Promise<HealthCheckResponse> {
    const checks = [];

    // Check if indexes are loaded
    try {
      const components = this.indexManager.getComponents();
      const tokens = this.indexManager.getTokens();
      checks.push({
        name: "indexes_loaded",
        status: "pass" as const,
        message: `${components.length} components, ${tokens.length} tokens loaded`,
      });
    } catch (error) {
      checks.push({
        name: "indexes_loaded",
        status: "fail" as const,
        message: `Failed to load indexes: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }

    // Check if data directory exists
    try {
      await fs.access("./data/indexes");
      checks.push({
        name: "data_directory",
        status: "pass" as const,
      });
    } catch {
      checks.push({
        name: "data_directory",
        status: "fail" as const,
        message: "Data directory not accessible",
      });
    }

    // Check initialization status
    checks.push({
      name: "initialization",
      status: this.initialized ? ("pass" as const) : ("fail" as const),
      message: this.initialized
        ? "Server initialized"
        : "Server not initialized",
    });

    const hasFailures = checks.some((check) => check.status === "fail");
    const status = hasFailures ? "unhealthy" : "healthy";

    const indexMeta = await this.getIndexMeta();

    return {
      status,
      version: "1.0.0",
      upstreamVersion: indexMeta?.upstreamRef,
      lastSync: indexMeta?.buildTime,
      checks,
    };
  }

  async version(): Promise<VersionResponse> {
    const indexMeta = await this.getIndexMeta();

    return {
      server: "1.0.0",
      upstream: indexMeta?.upstreamRef || "unknown",
      lastSync: indexMeta?.buildTime || "never",
      indexMeta: indexMeta || {
        version: "1.0.0",
        upstreamCommit: "unknown",
        upstreamRef: "unknown",
        buildTime: "unknown",
        componentsCount: 0,
        tokensCount: 0,
      },
    };
  }

  private async getIndexMeta(): Promise<IndexMeta | null> {
    try {
      const metaPath = path.join("./data/indexes", "index-meta.json");
      if (await fs.pathExists(metaPath)) {
        return await fs.readJson(metaPath);
      }
    } catch (error) {
      logger.warn("Could not read index metadata:", error);
    }
    return null;
  }

  private generateLintSuggestions(issues: LintIssue[]): string[] {
    const suggestions: string[] = [];

    // Analyze common issues and provide suggestions
    const errorCount = issues.filter((i) => i.type === "error").length;
    const warningCount = issues.filter((i) => i.type === "warning").length;

    if (errorCount > 0) {
      suggestions.push(`Fix ${errorCount} error(s) to ensure MADE compliance`);
    }

    if (warningCount > 0) {
      suggestions.push(
        `Consider addressing ${warningCount} warning(s) for better accessibility`
      );
    }

    // Specific suggestions based on issue patterns
    const missingClasses = issues.filter((i) =>
      i.message.includes("missing MADE class")
    );
    if (missingClasses.length > 0) {
      suggestions.push(
        "Add appropriate MADE CSS classes to ensure consistent styling"
      );
    }

    const a11yIssues = issues.filter((i) =>
      i.message.includes("accessibility")
    );
    if (a11yIssues.length > 0) {
      suggestions.push(
        "Add ARIA attributes and labels for better accessibility"
      );
    }

    return suggestions;
  }
}
