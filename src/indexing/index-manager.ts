import fs from 'fs-extra';
import * as path from 'path';
import { MADEToken, MADEComponent, IndexMeta } from '../types.js';
import { CSSParser } from '../parsers/css-parser.js';
import { StorybookParser } from '../parsers/storybook-parser.js';
import { logger } from '../utils/logger.js';

export class IndexManager {
  private tokens: MADEToken[] = [];
  private components: MADEComponent[] = [];
  private indexMeta: IndexMeta | null = null;
  private readonly indexDir = './data/indexes';
  private readonly cacheDir = './data/cache';

  async loadIndexes(): Promise<void> {
    try {
      await fs.ensureDir(this.indexDir);
      await fs.ensureDir(this.cacheDir);
      
      // Load metadata
      await this.loadIndexMeta();
      
      // Load tokens
      await this.loadTokens();
      
      // Load components
      await this.loadComponents();
      
      logger.info(`Loaded ${this.tokens.length} tokens and ${this.components.length} components`);
    } catch (error) {
      logger.warn('Failed to load existing indexes, will rebuild:', error);
      // If loading fails, we'll rely on sync to rebuild
    }
  }

  async buildIndexes(repoPath: string, upstreamRef: string, upstreamCommit: string): Promise<void> {
    try {
      logger.info('Building indexes from MADE repository...');
      
      // Clear existing data
      this.tokens = [];
      this.components = [];
      
      // Parse CSS files
      await this.parseCSSFiles(repoPath);
      
      // Parse Storybook stories
      await this.parseStorybookFiles(repoPath);
      
      // Create index metadata
      this.indexMeta = {
        version: '1.0.0',
        upstreamCommit,
        upstreamRef,
        buildTime: new Date().toISOString(),
        componentsCount: this.components.length,
        tokensCount: this.tokens.length
      };
      
      // Save indexes
      await this.saveIndexes();
      
      logger.info(`Successfully built indexes: ${this.tokens.length} tokens, ${this.components.length} components`);
    } catch (error) {
      logger.error('Failed to build indexes:', error);
      throw error;
    }
  }

  private async parseCSSFiles(repoPath: string): Promise<void> {
    const cssParser = new CSSParser();
    
    // Look for CSS variables files
    const cssVariablePaths = [
      // MADE specific CSS variable files (prioritize these)
      path.join(repoPath, 'packages', 'made-css', 'dist', '3.0.0', 'made-css-variables.css'),
      path.join(repoPath, 'packages', 'made-css', 'dist', '2.0.0', 'made-css-variables.css'),
      path.join(repoPath, 'packages', 'made-css', 'dist', 'made-css-variables.css'),
      path.join(repoPath, 'packages', 'made-css', 'src', '01-settings', 'tokens.css'),
      path.join(repoPath, 'storybook', 'stories', 'assets', 'css', 'made-css-variables.css'),
      // Standard variable file locations
      path.join(repoPath, 'made-css-variables.css'),
      path.join(repoPath, 'dist', 'made-css-variables.css'),
      path.join(repoPath, 'build', 'made-css-variables.css'),
      path.join(repoPath, 'css', 'made-css-variables.css')
    ];

    // Look for JSON token files
    const jsonTokenPaths = [
      // Design tokens JSON files
      path.join(repoPath, 'packages', 'made-design-tokens', 'dist', '2.3.0', 'web', 'themes', 'b2b', 'tokens.json'),
      path.join(repoPath, 'packages', 'made-design-tokens', 'dist', '2.2.0', 'web', 'themes', 'b2b', 'tokens.json'),
      path.join(repoPath, 'packages', 'made-design-tokens', 'dist', '2.1.1', 'web', 'themes', 'b2b', 'tokens.json'),
      path.join(repoPath, 'assets', 'partnerbank-test-theme', 'tokens.json'),
      // Fallback locations
      path.join(repoPath, 'tokens.json'),
      path.join(repoPath, 'dist', 'tokens.json'),
      path.join(repoPath, 'build', 'tokens.json')
    ];

    // Look for CSS variables with tokens
    const cssTokenPaths = [
      // Design tokens CSS files
      path.join(repoPath, 'packages', 'made-design-tokens', 'dist', '2.3.0', 'web', 'themes', 'b2b', 'tokens-variables.css'),
      path.join(repoPath, 'packages', 'made-design-tokens', 'dist', '2.2.0', 'web', 'themes', 'b2b', 'tokens-variables.css'),
      path.join(repoPath, 'packages', 'made-design-tokens', 'dist', '2.1.1', 'web', 'themes', 'b2b', 'tokens-variables.css'),
      path.join(repoPath, 'assets', 'partnerbank-test-theme', 'tokens-variables.css')
    ];

    // Parse CSS variable files
    for (const cssPath of cssVariablePaths) {
      if (await fs.pathExists(cssPath)) {
        logger.info(`Found CSS variables file: ${cssPath}`);
        
        try {
          await cssParser.parseMadeCSSVariables(cssPath);
        } catch (error) {
          logger.warn(`Failed to parse CSS variables file ${cssPath}:`, error instanceof Error ? error.message : 'Unknown error');
          continue; // Continue with next file
        }
      }
    }

    // Parse design token CSS files
    for (const cssPath of cssTokenPaths) {
      if (await fs.pathExists(cssPath)) {
        logger.info(`Found CSS tokens file: ${cssPath}`);
        
        try {
          await cssParser.parseMadeCSSVariables(cssPath);
        } catch (error) {
          logger.warn(`Failed to parse CSS tokens file ${cssPath}:`, error instanceof Error ? error.message : 'Unknown error');
          continue; // Continue with next file
        }
      }
    }

    // Parse JSON token files
    for (const jsonPath of jsonTokenPaths) {
      if (await fs.pathExists(jsonPath)) {
        logger.info(`Found JSON tokens file: ${jsonPath}`);
        
        try {
          await cssParser.parseMadeTokensJSON(jsonPath);
        } catch (error) {
          logger.warn(`Failed to parse JSON tokens file ${jsonPath}:`, error instanceof Error ? error.message : 'Unknown error');
          continue; // Continue with next file
        }
      }
    }

    // Look for main CSS files for utility classes
    const mainCSSPaths = [
      path.join(repoPath, 'packages', 'made-css', 'dist', '3.0.0', 'made.css'),
      path.join(repoPath, 'packages', 'made-css', 'dist', '2.0.0', 'made.css'),
      path.join(repoPath, 'packages', 'made-css', 'dist', 'made.css'),
      path.join(repoPath, 'made.css'),
      path.join(repoPath, 'dist', 'made.css'),
      path.join(repoPath, 'build', 'made.css'),
      path.join(repoPath, 'css', 'made.css')
    ];

    // Parse main CSS files for utility classes
    for (const cssPath of mainCSSPaths) {
      if (await fs.pathExists(cssPath)) {
        logger.info(`Found main CSS file: ${cssPath}`);
        
        try {
          await cssParser.parseMadeCSS(cssPath);
        } catch (error) {
          logger.warn(`Failed to parse main CSS file ${cssPath}:`, error instanceof Error ? error.message : 'Unknown error');
          continue; // Continue with next file
        }
      }
    }
    
    this.tokens = cssParser.getTokens();
  }

  private async parseStorybookFiles(repoPath: string): Promise<void> {
    // Look for Storybook directory
    const possibleStorybookPaths = [
      path.join(repoPath, '.storybook'),
      path.join(repoPath, 'storybook'),
      path.join(repoPath, 'stories'),
      path.join(repoPath, 'src', 'stories'),
      path.join(repoPath, 'docs', 'stories')
    ];
    
    let storybookPath: string | null = null;
    for (const sbPath of possibleStorybookPaths) {
      if (await fs.pathExists(sbPath)) {
        storybookPath = path.dirname(sbPath); // Use parent directory for story search
        break;
      }
    }
    
    if (!storybookPath) {
      logger.warn('No Storybook directory found, looking for story files in entire repo...');
      storybookPath = repoPath;
    }
    
    const storybookParser = new StorybookParser(storybookPath);
    await storybookParser.parseStories();
    this.components = storybookParser.getComponents();
  }

  private async loadIndexMeta(): Promise<void> {
    const metaPath = path.join(this.indexDir, 'index-meta.json');
    if (await fs.pathExists(metaPath)) {
      this.indexMeta = await fs.readJson(metaPath);
    }
  }

  private async loadTokens(): Promise<void> {
    const tokensPath = path.join(this.indexDir, 'tokens.json');
    if (await fs.pathExists(tokensPath)) {
      this.tokens = await fs.readJson(tokensPath);
    }
  }

  private async loadComponents(): Promise<void> {
    const componentsPath = path.join(this.indexDir, 'components.json');
    if (await fs.pathExists(componentsPath)) {
      this.components = await fs.readJson(componentsPath);
    }
  }

  private async saveIndexes(): Promise<void> {
    await fs.ensureDir(this.indexDir);
    
    // Save metadata
    if (this.indexMeta) {
      await fs.writeJSON(
        path.join(this.indexDir, 'index-meta.json'),
        this.indexMeta,
        { spaces: 2 }
      );
    }
    
    // Save tokens
    await fs.writeJSON(
      path.join(this.indexDir, 'tokens.json'),
      this.tokens,
      { spaces: 2 }
    );
    
    // Save components
    await fs.writeJSON(
      path.join(this.indexDir, 'components.json'),
      this.components,
      { spaces: 2 }
    );
    
    // Create search index cache
    await this.buildSearchCache();
    
    logger.info('Indexes saved successfully');
  }

  private async buildSearchCache(): Promise<void> {
    // Build simplified search index for faster lookups
    const searchIndex = {
      components: this.components.map(comp => ({
        name: comp.name.toLowerCase(),
        description: comp.description.toLowerCase(),
        tags: comp.tags,
        examples: comp.examples.map(ex => ({
          title: ex.title.toLowerCase(),
          description: ex.description?.toLowerCase() || ''
        }))
      })),
      tokens: this.tokens.map(token => ({
        name: token.name.toLowerCase(),
        category: token.category,
        description: token.description?.toLowerCase() || ''
      }))
    };
    
    await fs.writeJSON(
      path.join(this.cacheDir, 'search-index.json'),
      searchIndex,
      { spaces: 2 }
    );
  }

  // Getters
  getTokens(): MADEToken[] {
    return [...this.tokens];
  }

  getComponents(): MADEComponent[] {
    return [...this.components];
  }

  getIndexMeta(): IndexMeta | null {
    return this.indexMeta;
  }

  // Search and filter methods
  findTokensByCategory(category: MADEToken['category']): MADEToken[] {
    return this.tokens.filter(token => token.category === category);
  }

  searchTokens(query: string): MADEToken[] {
    const lowerQuery = query.toLowerCase();
    return this.tokens.filter(token =>
      token.name.toLowerCase().includes(lowerQuery) ||
      token.value.toLowerCase().includes(lowerQuery) ||
      token.description?.toLowerCase().includes(lowerQuery)
    );
  }

  findComponentByName(name: string): MADEComponent | undefined {
    return this.components.find(comp =>
      comp.name.toLowerCase() === name.toLowerCase()
    );
  }

  searchComponents(query: string): MADEComponent[] {
    const lowerQuery = query.toLowerCase();
    return this.components.filter(comp =>
      comp.name.toLowerCase().includes(lowerQuery) ||
      comp.description.toLowerCase().includes(lowerQuery) ||
      comp.tags.some(tag => tag.includes(lowerQuery)) ||
      comp.examples.some(ex =>
        ex.title.toLowerCase().includes(lowerQuery) ||
        ex.description?.toLowerCase().includes(lowerQuery)
      )
    );
  }

  // Validation methods
  isIndexOutdated(maxAge: number = 24 * 60 * 60 * 1000): boolean {
    if (!this.indexMeta?.buildTime) return true;
    
    const buildTime = new Date(this.indexMeta.buildTime);
    const now = new Date();
    
    return (now.getTime() - buildTime.getTime()) > maxAge;
  }

  hasValidIndexes(): boolean {
    return this.tokens.length > 0 || this.components.length > 0;
  }

  // Utility methods for component scaffolding
  getComponentClasses(componentName: string): string[] {
    const component = this.findComponentByName(componentName);
    return component?.cssClasses || [];
  }

  getComponentTokens(componentName: string): MADEToken[] {
    const component = this.findComponentByName(componentName);
    if (!component) return [];
    
    return this.tokens.filter(token =>
      component.cssVarsUsed.includes(token.name)
    );
  }

  // Export for backup/migration
  async exportIndexes(): Promise<{
    tokens: MADEToken[];
    components: MADEComponent[];
    meta: IndexMeta | null;
  }> {
    return {
      tokens: this.getTokens(),
      components: this.getComponents(),
      meta: this.getIndexMeta()
    };
  }

  // Import from backup/migration
  async importIndexes(data: {
    tokens: MADEToken[];
    components: MADEComponent[];
    meta: IndexMeta | null;
  }): Promise<void> {
    this.tokens = data.tokens;
    this.components = data.components;
    this.indexMeta = data.meta;
    
    await this.saveIndexes();
  }
}