#!/usr/bin/env node

import fs from 'fs-extra';
import * as path from 'path';
import { IndexManager } from '../indexing/index-manager.js';
import { logger } from '../utils/logger.js';

interface BuildIndexOptions {
  repoPath: string;
  outputDir: string;
  verbose: boolean;
  dryRun: boolean;
}

class IndexBuilder {
  private options: BuildIndexOptions;
  private indexManager: IndexManager;

  constructor(options: Partial<BuildIndexOptions> = {}) {
    this.options = {
      repoPath: './data/made-repo',
      outputDir: './data/indexes',
      verbose: false,
      dryRun: false,
      ...options
    };
    
    this.indexManager = new IndexManager();
    
    if (this.options.verbose) {
      logger.setLevel('debug');
    }
  }

  async buildIndexes(): Promise<void> {
    try {
      logger.info('Starting index build...');
      
      // Validate repository exists
      if (!await fs.pathExists(this.options.repoPath)) {
        throw new Error(`Repository path does not exist: ${this.options.repoPath}`);
      }
      
      if (!await fs.pathExists(path.join(this.options.repoPath, '.git'))) {
        throw new Error(`Not a git repository: ${this.options.repoPath}`);
      }
      
      // Get repository info
      const repoInfo = await this.getRepositoryInfo();
      logger.info(`Building indexes for ${repoInfo.ref} (${repoInfo.commit.substring(0, 8)})`);
      
      if (this.options.dryRun) {
        logger.info('DRY RUN: Would build indexes but not save them');
        
        // Still build indexes to validate structure
        await this.indexManager.buildIndexes(
          this.options.repoPath,
          repoInfo.ref,
          repoInfo.commit
        );
        
        // Show what would be created
        const tokens = this.indexManager.getTokens();
        const components = this.indexManager.getComponents();
        
        logger.info(`Would create indexes with:`);
        logger.info(`  - ${tokens.length} design tokens`);
        logger.info(`  - ${components.length} components`);
        
        // Show sample data
        if (this.options.verbose) {
          logger.debug('Sample tokens:', tokens.slice(0, 3));
          logger.debug('Sample components:', components.slice(0, 2));
        }
        
        return;
      }
      
      // Ensure output directory exists
      await fs.ensureDir(this.options.outputDir);
      
      // Build indexes
      await this.indexManager.buildIndexes(
        this.options.repoPath,
        repoInfo.ref,
        repoInfo.commit
      );
      
      // Validate indexes
      await this.validateIndexes();
      
      logger.info('Index build completed successfully');
      
      // Show summary
      await this.showBuildSummary();
      
    } catch (error) {
      logger.error('Index build failed:', error);
      throw error;
    }
  }

  private async getRepositoryInfo(): Promise<{ commit: string; ref: string; tag?: string }> {
    const gitDir = path.join(this.options.repoPath, '.git');
    
    try {
      // Read HEAD to get current commit
      const headContent = await fs.readFile(path.join(gitDir, 'HEAD'), 'utf-8');
      let commit: string;
      let ref: string;
      
      if (headContent.startsWith('ref: ')) {
        // HEAD points to a branch
        ref = headContent.replace('ref: refs/heads/', '').trim();
        const refPath = path.join(gitDir, 'refs', 'heads', ref);
        
        if (await fs.pathExists(refPath)) {
          commit = (await fs.readFile(refPath, 'utf-8')).trim();
        } else {
          // Check packed refs
          const packedRefs = await fs.readFile(path.join(gitDir, 'packed-refs'), 'utf-8');
          const refMatch = packedRefs.match(new RegExp(`^([a-f0-9]+) refs/heads/${ref}$`, 'm'));
          if (!refMatch) throw new Error(`Cannot find commit for ref ${ref}`);
          commit = refMatch[1];
        }
      } else {
        // HEAD is a direct commit (detached state)
        commit = headContent.trim();
        ref = 'HEAD';
      }
      
      // Try to find associated tag
      let tag: string | undefined;
      try {
        const tagsDir = path.join(gitDir, 'refs', 'tags');
        if (await fs.pathExists(tagsDir)) {
          const tagFiles = await fs.readdir(tagsDir);
          for (const tagFile of tagFiles) {
            const tagCommit = (await fs.readFile(path.join(tagsDir, tagFile), 'utf-8')).trim();
            if (tagCommit === commit) {
              tag = tagFile;
              break;
            }
          }
        }
      } catch {
        // Ignore tag lookup errors
      }
      
      return { commit, ref, tag };
    } catch (error) {
      logger.error('Failed to get repository info:', error);
      throw new Error(`Failed to get repository info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async validateIndexes(): Promise<void> {
    logger.debug('Validating generated indexes...');
    
    const tokens = this.indexManager.getTokens();
    const components = this.indexManager.getComponents();
    const meta = this.indexManager.getIndexMeta();
    
    // Validate tokens
    if (tokens.length === 0) {
      logger.warn('No design tokens found - this might indicate parsing issues');
    } else {
      // Check token structure
      const invalidTokens = tokens.filter(token => 
        !token.name || !token.value || !token.category
      );
      
      if (invalidTokens.length > 0) {
        throw new Error(`Found ${invalidTokens.length} invalid tokens missing required fields`);
      }
      
      // Check for duplicate tokens
      const tokenNames = tokens.map(t => t.name);
      const duplicates = tokenNames.filter((name, index) => tokenNames.indexOf(name) !== index);
      if (duplicates.length > 0) {
        logger.warn(`Found duplicate token names: ${[...new Set(duplicates)].join(', ')}`);
      }
    }
    
    // Validate components
    if (components.length === 0) {
      logger.warn('No components found - this might indicate parsing issues');
    } else {
      // Check component structure
      const invalidComponents = components.filter(comp => 
        !comp.name || !comp.htmlScaffold
      );
      
      if (invalidComponents.length > 0) {
        throw new Error(`Found ${invalidComponents.length} invalid components missing required fields`);
      }
      
      // Check for duplicate components
      const componentNames = components.map(c => c.name);
      const duplicates = componentNames.filter((name, index) => componentNames.indexOf(name) !== index);
      if (duplicates.length > 0) {
        logger.warn(`Found duplicate component names: ${[...new Set(duplicates)].join(', ')}`);
      }
    }
    
    // Validate metadata
    if (!meta) {
      throw new Error('Index metadata is missing');
    }
    
    if (meta.componentsCount !== components.length || meta.tokensCount !== tokens.length) {
      logger.warn('Metadata counts do not match actual data counts');
    }
    
    logger.debug('Index validation completed successfully');
  }

  private async showBuildSummary(): Promise<void> {
    const tokens = this.indexManager.getTokens();
    const components = this.indexManager.getComponents();
    const meta = this.indexManager.getIndexMeta();
    
    logger.info('\\n=== Build Summary ===');
    logger.info(`Tokens: ${tokens.length}`);
    
    // Group tokens by category
    const tokensByCategory: Record<string, number> = {};
    tokens.forEach(token => {
      tokensByCategory[token.category] = (tokensByCategory[token.category] || 0) + 1;
    });
    
    Object.entries(tokensByCategory).forEach(([category, count]) => {
      logger.info(`  ${category}: ${count}`);
    });
    
    logger.info(`\\nComponents: ${components.length}`);
    
    // Group components by tags
    const componentsByTag: Record<string, number> = {};
    components.forEach(comp => {
      comp.tags.forEach(tag => {
        componentsByTag[tag] = (componentsByTag[tag] || 0) + 1;
      });
    });
    
    const topTags = Object.entries(componentsByTag)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);
    
    topTags.forEach(([tag, count]) => {
      logger.info(`  ${tag}: ${count} components`);
    });
    
    logger.info(`\\nRepository: ${meta?.upstreamRef} (${meta?.upstreamCommit?.substring(0, 8)})`);
    logger.info(`Built: ${meta?.buildTime}`);
    
    if (this.options.verbose) {
      logger.info('\\n=== Detailed Information ===');
      
      logger.info('\\nToken Categories:');
      Object.entries(tokensByCategory).forEach(([category, count]) => {
        logger.info(`  ${category}: ${count} tokens`);
      });
      
      logger.info('\\nComponent Examples:');
      components.slice(0, 5).forEach(comp => {
        logger.info(`  ${comp.name}: ${comp.examples.length} examples, ${comp.cssClasses.length} classes`);
      });
      
      logger.info('\\nFile Sizes:');
      const indexFiles = ['tokens.json', 'components.json', 'index-meta.json'];
      for (const file of indexFiles) {
        try {
          const filePath = path.join(this.options.outputDir, file);
          const stats = await fs.stat(filePath);
          const sizeKB = Math.round(stats.size / 1024);
          logger.info(`  ${file}: ${sizeKB} KB`);
        } catch {
          // Ignore missing files
        }
      }
    }
    
    logger.info('====================\\n');
  }

  async exportIndexes(exportPath: string): Promise<void> {
    logger.info(`Exporting indexes to ${exportPath}...`);
    
    try {
      const data = await this.indexManager.exportIndexes();
      await fs.writeJSON(exportPath, data, { spaces: 2 });
      
      const stats = await fs.stat(exportPath);
      const sizeMB = Math.round(stats.size / 1024 / 1024 * 100) / 100;
      
      logger.info(`Indexes exported successfully (${sizeMB} MB)`);
    } catch (error) {
      logger.error('Failed to export indexes:', error);
      throw error;
    }
  }

  async importIndexes(importPath: string): Promise<void> {
    logger.info(`Importing indexes from ${importPath}...`);
    
    try {
      if (!await fs.pathExists(importPath)) {
        throw new Error(`Import file does not exist: ${importPath}`);
      }
      
      const data = await fs.readJson(importPath);
      await this.indexManager.importIndexes(data);
      
      logger.info('Indexes imported successfully');
      await this.showBuildSummary();
    } catch (error) {
      logger.error('Failed to import indexes:', error);
      throw error;
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'build';
  
  const options: Partial<BuildIndexOptions> = {
    verbose: args.includes('--verbose') || args.includes('-v'),
    dryRun: args.includes('--dry-run') || args.includes('-n')
  };
  
  // Parse custom repo path if provided
  const repoIndex = args.findIndex(arg => arg === '--repo' || arg === '-r');
  if (repoIndex !== -1 && args[repoIndex + 1]) {
    options.repoPath = args[repoIndex + 1];
  }
  
  // Parse custom output directory if provided
  const outputIndex = args.findIndex(arg => arg === '--output' || arg === '-o');
  if (outputIndex !== -1 && args[outputIndex + 1]) {
    options.outputDir = args[outputIndex + 1];
  }
  
  const builder = new IndexBuilder(options);
  
  try {
    switch (command) {
      case 'build':
        await builder.buildIndexes();
        break;
        
      case 'export':
        const exportPath = args[1] || './made-indexes-export.json';
        await builder.buildIndexes(); // Build first
        await builder.exportIndexes(exportPath);
        break;
        
      case 'import':
        const importPath = args[1];
        if (!importPath) {
          console.error('Import path is required');
          process.exit(1);
        }
        await builder.importIndexes(importPath);
        break;
        
      case 'help':
        console.log(`
MADE MCP Index Builder

Commands:
  build             - Build indexes from repository (default)
  export [path]     - Build and export indexes to JSON file
  import <path>     - Import indexes from JSON file
  help              - Show this help

Options:
  --repo, -r <path>     - Repository path (default: ./data/made-repo)
  --output, -o <dir>    - Output directory (default: ./data/indexes)
  --verbose, -v         - Verbose output
  --dry-run, -n         - Dry run (don't save results)

Examples:
  npm run build-index                           - Basic build
  npm run build-index -- --verbose              - Verbose build
  npm run build-index -- --dry-run              - Test build without saving
  npm run build-index -- export ./backup.json   - Export indexes
  npm run build-index -- import ./backup.json   - Import indexes
        `);
        break;
        
      default:
        console.error(`Unknown command: ${command}`);
        console.error('Run "npm run build-index -- help" for usage information');
        process.exit(1);
    }
  } catch (error) {
    console.error('Build failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Only run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { IndexBuilder };