#!/usr/bin/env node

import fs from 'fs-extra';
import { IndexManager } from '../indexing/index-manager.js';
import { logger } from '../utils/logger.js';

async function main() {
  try {
    // Get arguments from command line
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
      console.error('Usage: build-indexes <repo-path> <version> [commit-hash]');
      console.error('Example: build-indexes /app/made-repo v3.0.0 abc123');
      process.exit(1);
    }

    const repoPath = args[0];
    const version = args[1];
    const commitHash = args[2] || 'unknown';

    // Validate repo path exists
    if (!await fs.pathExists(repoPath)) {
      logger.error(`Repository path does not exist: ${repoPath}`);
      process.exit(1);
    }

    logger.info(`Building indexes from MADE repository...`);
    logger.info(`Repository path: ${repoPath}`);
    logger.info(`Version: ${version}`);
    logger.info(`Commit: ${commitHash}`);

    // Initialize index manager
    const indexManager = new IndexManager();
    
    // Build indexes
    await indexManager.buildIndexes(repoPath, version, commitHash);
    
    // Get final counts
    const tokens = indexManager.getTokens();
    const components = indexManager.getComponents();
    
    logger.info(`Successfully built indexes:`);
    logger.info(`- ${tokens.length} design tokens`);
    logger.info(`- ${components.length} components`);
    
    process.exit(0);
    
  } catch (error) {
    logger.error('Failed to build indexes:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}