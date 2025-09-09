import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs-extra';
import { MADEMCPServer } from '../src/mcp-server.js';
import { MADEToken, MADEComponent } from '../src/types.js';

// Mock the dependencies
vi.mock('../src/indexing/index-manager.js');
vi.mock('../src/linting/markup-linter.js');
vi.mock('../src/scaffolding/component-scaffolder.js');
vi.mock('../src/search/search-engine.js');

describe('MADEMCPServer', () => {
  let server: MADEMCPServer;

  const mockTokens: MADEToken[] = [
    {
      name: '--made-color-primary-500',
      value: '#FF5F00',
      category: 'color',
      description: 'Primary brand color'
    },
    {
      name: '--made-spacing-md',
      value: '1rem',
      category: 'spacing',
      description: 'Medium spacing value'
    }
  ];

  const mockComponents: MADEComponent[] = [
    {
      name: 'Button',
      description: 'Interactive button component',
      tags: ['interactive', 'form'],
      variants: {
        variant: ['primary', 'secondary'],
        size: ['sm', 'md', 'lg']
      },
      props: {},
      a11yNotes: ['Ensure proper focus management'],
      htmlScaffold: '<button class="made-btn made-btn-primary" type="button">Button</button>',
      cssClasses: ['made-btn', 'made-btn-primary'],
      cssVarsUsed: ['--made-color-primary-500'],
      examples: [
        {
          title: 'Primary Button',
          html: '<button class="made-btn made-btn-primary">Click me</button>',
          description: 'Primary button example'
        }
      ]
    }
  ];

  beforeEach(async () => {
    server = new MADEMCPServer();
    
    // Mock the index manager methods
    const mockIndexManager = {
      loadIndexes: vi.fn(),
      getTokens: vi.fn(() => mockTokens),
      getComponents: vi.fn(() => mockComponents),
      getIndexMeta: vi.fn(() => ({
        version: '1.0.0',
        upstreamCommit: 'abc123',
        upstreamRef: 'main',
        buildTime: '2024-01-15T10:30:00Z',
        componentsCount: 1,
        tokensCount: 2
      }))
    };

    // Mock other dependencies
    const mockMarkupLinter = {
      initialize: vi.fn(),
      lint: vi.fn(() => [])
    };

    const mockComponentScaffolder = {
      initialize: vi.fn(),
      scaffold: vi.fn(() => ({
        html: '<button class="made-btn made-btn-primary">Test Button</button>',
        notes: ['Component scaffolded successfully'],
        dependencies: ['made.css']
      }))
    };

    const mockSearchEngine = {
      initialize: vi.fn(),
      search: vi.fn(() => [
        {
          component: 'Button',
          title: 'Primary Button',
          html: '<button class="made-btn made-btn-primary">Search Result</button>',
          sourcePath: 'components/button',
          upstreamRef: 'main'
        }
      ])
    };

    // Replace the instances (in a real scenario, this would be done with proper mocking)
    (server as any).indexManager = mockIndexManager;
    (server as any).markupLinter = mockMarkupLinter;
    (server as any).componentScaffolder = mockComponentScaffolder;
    (server as any).searchEngine = mockSearchEngine;
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(server.initialize()).resolves.not.toThrow();
    });

    it('should ensure required directories exist', async () => {
      await server.initialize();
      
      expect(await fs.pathExists('./data/indexes')).toBe(true);
      expect(await fs.pathExists('./data/cache')).toBe(true);
    });
  });

  describe('listTokens', () => {
    beforeEach(async () => {
      await server.initialize();
    });

    it('should return all tokens when no scope provided', async () => {
      const result = await server.listTokens();
      
      expect(result.tokens).toHaveLength(2);
      expect(result.meta?.totalCount).toBe(2);
      expect(result.meta?.filteredCount).toBe(2);
    });

    it('should filter tokens by scope', async () => {
      const result = await server.listTokens('color');
      
      expect(result.tokens).toHaveLength(1);
      expect(result.tokens[0].category).toBe('color');
      expect(result.meta?.filteredCount).toBe(1);
    });

    it('should return empty array for non-existent scope', async () => {
      const result = await server.listTokens('nonexistent');
      
      expect(result.tokens).toHaveLength(0);
      expect(result.meta?.filteredCount).toBe(0);
    });
  });

  describe('listComponents', () => {
    beforeEach(async () => {
      await server.initialize();
    });

    it('should return all components with metadata', async () => {
      const result = await server.listComponents();
      
      expect(result.components).toHaveLength(1);
      expect(result.components[0].name).toBe('Button');
      expect(result.components[0].variants).toBeDefined();
    });

    it('should not expose internal implementation details', async () => {
      const result = await server.listComponents();
      
      expect(result.components[0]).not.toHaveProperty('htmlScaffold');
      expect(result.components[0]).not.toHaveProperty('cssClasses');
    });
  });

  describe('getComponent', () => {
    beforeEach(async () => {
      await server.initialize();
    });

    it('should return component details for valid name', async () => {
      const result = await server.getComponent('Button');
      
      expect(result.name).toBe('Button');
      expect(result.html).toBeTruthy();
      expect(result.classes).toBeDefined();
      expect(result.examples).toHaveLength(1);
    });

    it('should be case insensitive', async () => {
      const result = await server.getComponent('button');
      expect(result.name).toBe('Button');
    });

    it('should throw error for non-existent component', async () => {
      await expect(server.getComponent('NonExistent'))
        .rejects.toThrow("Component 'NonExistent' not found");
    });
  });

  describe('scaffoldComponent', () => {
    beforeEach(async () => {
      await server.initialize();
    });

    it('should scaffold component without props', async () => {
      const result = await server.scaffoldComponent('Button');
      
      expect(result.html).toBeTruthy();
      expect(result.notes).toBeDefined();
      expect(result.dependencies).toBeDefined();
    });

    it('should scaffold component with props', async () => {
      const result = await server.scaffoldComponent('Button', {
        variant: 'primary',
        size: 'lg'
      });
      
      expect(result.html).toBeTruthy();
    });

    it('should throw error for non-existent component', async () => {
      await expect(server.scaffoldComponent('NonExistent'))
        .rejects.toThrow('Component \'NonExistent\' not found');
    });
  });

  describe('searchExamples', () => {
    beforeEach(async () => {
      await server.initialize();
    });

    it('should return search results', async () => {
      const result = await server.searchExamples('button');
      
      expect(result.results).toHaveLength(1);
      expect(result.meta.query).toBe('button');
      expect(result.meta.totalResults).toBe(1);
    });

    it('should handle empty search results', async () => {
      // Mock empty results
      (server as any).searchEngine.search = vi.fn(() => []);
      
      const result = await server.searchExamples('nonexistent');
      
      expect(result.results).toHaveLength(0);
      expect(result.meta.totalResults).toBe(0);
    });
  });

  describe('lintMarkup', () => {
    beforeEach(async () => {
      await server.initialize();
    });

    it('should lint HTML markup', async () => {
      const result = await server.lintMarkup('<button>Test</button>');
      
      expect(result.valid).toBeDefined();
      expect(result.issues).toBeDefined();
    });

    it('should provide suggestions when issues found', async () => {
      // Mock linter with issues
      (server as any).markupLinter.lint = vi.fn(() => [
        {
          type: 'warning',
          message: 'Missing MADE classes'
        }
      ]);
      
      const result = await server.lintMarkup('<button>Test</button>');
      
      expect(result.issues).toHaveLength(1);
      expect(result.suggestions).toBeDefined();
    });
  });

  describe('healthCheck', () => {
    beforeEach(async () => {
      await server.initialize();
    });

    it('should return healthy status when initialized', async () => {
      const result = await server.healthCheck();
      
      expect(result.status).toBe('healthy');
      expect(result.version).toBe('1.0.0');
      expect(result.checks).toBeDefined();
    });

    it('should include all required health checks', async () => {
      const result = await server.healthCheck();
      
      const checkNames = result.checks.map(check => check.name);
      expect(checkNames).toContain('indexes_loaded');
      expect(checkNames).toContain('data_directory');
      expect(checkNames).toContain('initialization');
    });
  });

  describe('version', () => {
    beforeEach(async () => {
      await server.initialize();
    });

    it('should return version information', async () => {
      const result = await server.version();
      
      expect(result.server).toBe('1.0.0');
      expect(result.upstream).toBeDefined();
      expect(result.lastSync).toBeDefined();
      expect(result.indexMeta).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should throw error when not initialized', async () => {
      const uninitializedServer = new MADEMCPServer();
      
      await expect(uninitializedServer.listTokens())
        .rejects.toThrow('Server not initialized');
    });

    it('should handle initialization failures gracefully', async () => {
      const failingServer = new MADEMCPServer();
      
      // Mock failing index manager
      (failingServer as any).indexManager = {
        loadIndexes: vi.fn(() => { throw new Error('Load failed'); })
      };
      
      await expect(failingServer.initialize())
        .rejects.toThrow('Load failed');
    });
  });

  describe('data consistency', () => {
    beforeEach(async () => {
      await server.initialize();
    });

    it('should return consistent data across calls', async () => {
      const result1 = await server.listTokens();
      const result2 = await server.listTokens();
      
      expect(result1).toEqual(result2);
    });

    it('should not mutate returned data', async () => {
      const result = await server.listComponents();
      const originalLength = result.components.length;
      
      // Try to mutate the returned data
      result.components.push({} as any);
      
      // Get fresh data
      const freshResult = await server.listComponents();
      expect(freshResult.components).toHaveLength(originalLength);
    });
  });
});