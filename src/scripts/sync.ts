#!/usr/bin/env node

import fs from 'fs-extra';
import * as path from 'path';
import simpleGit, { SimpleGit } from 'simple-git';
import { IndexManager } from '../indexing/index-manager.js';
import { logger } from '../utils/logger.js';

interface SyncOptions {
  repoUrl: string;
  targetDir: string;
  branch: string;
  forceUpdate: boolean;
  watch: boolean;
}

class MADESync {
  private git: SimpleGit;
  private options: SyncOptions;
  private indexManager: IndexManager;

  constructor(options: Partial<SyncOptions> = {}) {
    this.options = {
      repoUrl: 'https://github.com/Mastercard/made.git',
      targetDir: './data/made-repo',
      branch: 'main',
      forceUpdate: false,
      watch: false,
      ...options
    };
    
    this.git = simpleGit();
    this.indexManager = new IndexManager();
  }

  async sync(): Promise<void> {
    try {
      logger.info('Starting MADE design system sync...');
      
      // Ensure target directory exists
      await fs.ensureDir(this.options.targetDir);
      
      // Clone or update repository
      const repoExists = await fs.pathExists(path.join(this.options.targetDir, '.git'));
      
      if (!repoExists) {
        await this.cloneRepository();
      } else {
        await this.updateRepository();
      }
      
      // Get current commit info
      const commitInfo = await this.getCurrentCommitInfo();
      
      // Build indexes
      await this.indexManager.buildIndexes(
        this.options.targetDir,
        commitInfo.ref,
        commitInfo.commit
      );
      
      logger.info('MADE design system sync completed successfully');
      
      // Start watch mode if requested
      if (this.options.watch) {
        await this.startWatchMode();
      }
      
    } catch (error) {
      logger.error('Sync failed:', error);
      throw error;
    }
  }

  private async cloneRepository(): Promise<void> {
    logger.info(`Cloning MADE repository from ${this.options.repoUrl}...`);
    
    try {
      await this.git.clone(
        this.options.repoUrl, 
        this.options.targetDir,
        ['--depth', '1', '--branch', this.options.branch]
      );
      
      logger.info('Repository cloned successfully');
    } catch (error) {
      logger.error('Failed to clone repository:', error);
      throw new Error(`Failed to clone repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async updateRepository(): Promise<void> {
    const repoGit = simpleGit(this.options.targetDir);
    
    try {
      logger.info('Fetching latest changes...');
      
      // Fetch latest changes
      await repoGit.fetch(['--tags']);
      
      // Check if we need to update
      const status = await repoGit.status();
      const currentBranch = status.current;
      
      if (currentBranch !== this.options.branch) {
        await repoGit.checkout(this.options.branch);
      }
      
      // Get current and remote commit hashes
      const currentCommit = await repoGit.revparse(['HEAD']);
      const remoteCommit = await repoGit.revparse([`origin/${this.options.branch}`]);
      
      if (currentCommit !== remoteCommit || this.options.forceUpdate) {
        logger.info('Updates available, pulling changes...');
        await repoGit.pull();
        logger.info('Repository updated successfully');
      } else {
        logger.info('Repository is already up to date');
      }
      
    } catch (error) {
      logger.error('Failed to update repository:', error);
      
      // If update fails, try to recover by re-cloning
      if (this.options.forceUpdate) {
        logger.warn('Force update requested, removing and re-cloning...');
        await fs.remove(this.options.targetDir);
        await this.cloneRepository();
      } else {
        throw new Error(`Failed to update repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  private async getCurrentCommitInfo(): Promise<{ commit: string; ref: string; tag?: string }> {
    const repoGit = simpleGit(this.options.targetDir);
    
    try {
      const commit = await repoGit.revparse(['HEAD']);
      const ref = this.options.branch;
      
      // Try to get the latest tag
      let tag: string | undefined;
      try {
        const tags = await repoGit.tags(['--sort=-version:refname']);
        tag = tags.latest;
      } catch {
        // Tags might not be available
      }
      
      return { commit, ref, tag };
    } catch (error) {
      logger.error('Failed to get commit info:', error);
      throw new Error(`Failed to get commit info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async startWatchMode(): Promise<void> {
    logger.info('Starting watch mode - checking for updates every 5 minutes...');
    
    const checkInterval = 5 * 60 * 1000; // 5 minutes
    
    setInterval(async () => {
      try {
        logger.debug('Checking for updates...');
        
        const repoGit = simpleGit(this.options.targetDir);
        await repoGit.fetch();
        
        const currentCommit = await repoGit.revparse(['HEAD']);
        const remoteCommit = await repoGit.revparse([`origin/${this.options.branch}`]);
        
        if (currentCommit !== remoteCommit) {
          logger.info('New changes detected, syncing...');
          await this.updateRepository();
          
          const commitInfo = await this.getCurrentCommitInfo();
          await this.indexManager.buildIndexes(
            this.options.targetDir,
            commitInfo.ref,
            commitInfo.commit
          );
          
          logger.info('Watch mode sync completed');
        }
      } catch (error) {
        logger.error('Watch mode check failed:', error);
      }
    }, checkInterval);
    
    // Keep the process alive
    process.on('SIGINT', () => {
      logger.info('Watch mode stopped');
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      logger.info('Watch mode stopped');
      process.exit(0);
    });
  }

  async getStatus(): Promise<{
    lastSync: string | null;
    currentCommit: string | null;
    currentTag: string | null;
    upToDate: boolean;
  }> {
    try {
      const repoExists = await fs.pathExists(path.join(this.options.targetDir, '.git'));
      
      if (!repoExists) {
        return {
          lastSync: null,
          currentCommit: null,
          currentTag: null,
          upToDate: false
        };
      }
      
      const repoGit = simpleGit(this.options.targetDir);
      const currentCommit = await repoGit.revparse(['HEAD']);
      
      // Try to get tag
      let currentTag: string | null = null;
      try {
        const tags = await repoGit.tags(['--sort=-version:refname']);
        currentTag = tags.latest || null;
      } catch {
        // Ignore tag errors
      }
      
      // Check if up to date
      let upToDate = false;
      try {
        await repoGit.fetch();
        const remoteCommit = await repoGit.revparse([`origin/${this.options.branch}`]);
        upToDate = currentCommit === remoteCommit;
      } catch {
        // If we can't check remote, assume we're not up to date
        upToDate = false;
      }
      
      // Get last sync time from index metadata
      const indexMeta = this.indexManager.getIndexMeta();
      const lastSync = indexMeta?.buildTime || null;
      
      return {
        lastSync,
        currentCommit,
        currentTag,
        upToDate
      };
    } catch (error) {
      logger.error('Failed to get status:', error);
      return {
        lastSync: null,
        currentCommit: null,
        currentTag: null,
        upToDate: false
      };
    }
  }

  async cleanCache(): Promise<void> {
    logger.info('Cleaning cache...');
    
    try {
      await fs.remove('./data/cache');
      await fs.remove('./data/indexes');
      logger.info('Cache cleaned successfully');
    } catch (error) {
      logger.error('Failed to clean cache:', error);
      throw error;
    }
  }

  async resetRepo(): Promise<void> {
    logger.info('Resetting repository...');
    
    try {
      await fs.remove(this.options.targetDir);
      await this.cleanCache();
      logger.info('Repository reset successfully');
    } catch (error) {
      logger.error('Failed to reset repository:', error);
      throw error;
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'sync';
  
  const options: Partial<SyncOptions> = {
    forceUpdate: args.includes('--force') || args.includes('-f'),
    watch: args.includes('--watch') || args.includes('-w')
  };
  
  // Parse custom repo URL if provided
  const repoIndex = args.findIndex(arg => arg === '--repo' || arg === '-r');
  if (repoIndex !== -1 && args[repoIndex + 1]) {
    options.repoUrl = args[repoIndex + 1];
  }
  
  // Parse custom branch if provided
  const branchIndex = args.findIndex(arg => arg === '--branch' || arg === '-b');
  if (branchIndex !== -1 && args[branchIndex + 1]) {
    options.branch = args[branchIndex + 1];
  }
  
  const sync = new MADESync(options);
  
  try {
    switch (command) {
      case 'sync':
        await sync.sync();
        break;
        
      case 'status':
        const status = await sync.getStatus();
        console.log(JSON.stringify(status, null, 2));
        break;
        
      case 'clean':
        await sync.cleanCache();
        break;
        
      case 'reset':
        await sync.resetRepo();
        break;
        
      case 'help':
        console.log(`
MADE MCP Sync Tool

Commands:
  sync     - Sync MADE design system (default)
  status   - Show sync status
  clean    - Clean cache and indexes
  reset    - Reset repository and cache
  help     - Show this help

Options:
  --force, -f       - Force update even if no changes
  --watch, -w       - Watch for changes and auto-sync
  --repo, -r <url>  - Custom repository URL
  --branch, -b <br> - Custom branch (default: main)

Examples:
  npm run sync                    - Basic sync
  npm run sync -- --force         - Force sync
  npm run sync -- --watch         - Sync and watch for changes
  npm run sync -- status          - Show status
        `);
        break;
        
      default:
        console.error(`Unknown command: ${command}`);
        console.error('Run "npm run sync -- help" for usage information');
        process.exit(1);
    }
  } catch (error) {
    console.error('Sync failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Only run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { MADESync };