import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';

// Test data directories
const TEST_DATA_DIR = './tests/data';
const TEST_CACHE_DIR = './tests/cache';

beforeAll(async () => {
  // Ensure test directories exist
  await fs.ensureDir(TEST_DATA_DIR);
  await fs.ensureDir(TEST_CACHE_DIR);
  
  // Set up test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error'; // Reduce noise in tests
});

afterAll(async () => {
  // Clean up test directories
  await fs.remove(TEST_CACHE_DIR);
});

beforeEach(async () => {
  // Clean up cache before each test
  if (await fs.pathExists(TEST_CACHE_DIR)) {
    await fs.emptyDir(TEST_CACHE_DIR);
  }
});

afterEach(() => {
  // Reset environment after each test
  delete process.env.REPO_URL;
  delete process.env.REPO_DIR;
});