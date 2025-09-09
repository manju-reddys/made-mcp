import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import { MADEMCPServer } from '../../src/mcp-server.js';
import { CSSParser } from '../../src/parsers/css-parser.js';
import { StorybookParser } from '../../src/parsers/storybook-parser.js';
import { IndexManager } from '../../src/indexing/index-manager.js';

describe('End-to-End Integration Tests', () => {
  let server: MADEMCPServer;
  let indexManager: IndexManager;
  const testDataDir = './tests/data/e2e';
  
  beforeAll(async () => {
    // Set up test environment
    await fs.ensureDir(testDataDir);
    await fs.ensureDir(path.join(testDataDir, 'indexes'));
    await fs.ensureDir(path.join(testDataDir, 'cache'));
    
    // Copy test fixtures to test data directory
    await fs.copy('./tests/fixtures', path.join(testDataDir, 'fixtures'));
    
    // Create MADE structure for proper testing
    const madeStructurePath = path.join(testDataDir, 'fixtures', 'packages', 'made-css', 'dist', '3.0.0');
    await fs.ensureDir(madeStructurePath);
    
    // Copy sample CSS to both locations for compatibility
    const sampleCssContent = await fs.readFile('./tests/fixtures/sample-css.css', 'utf8');
    await fs.writeFile(path.join(madeStructurePath, 'made-css-variables.css'), sampleCssContent);
    await fs.writeFile(path.join(madeStructurePath, 'made.css'), sampleCssContent);
    
    // Initialize components
    indexManager = new IndexManager();
    server = new MADEMCPServer();
  });

  afterAll(async () => {
    // Clean up test environment
    await fs.remove(testDataDir);
  });

  describe('Full Component Pipeline', () => {
    it('should process CSS and create tokens', async () => {
      const cssParser = new CSSParser();
      const cssPath = path.join(testDataDir, 'fixtures', 'sample-css.css');
      
      await cssParser.parseMadeCSSVariables(cssPath);
      const tokens = cssParser.getTokens();
      
      expect(tokens.length).toBeGreaterThan(0);
      
      // Verify token categories are properly assigned
      const categories = [...new Set(tokens.map(t => t.category))];
      expect(categories).toContain('color');
      expect(categories).toContain('spacing');
      expect(categories).toContain('typography');
    });

    it('should process Storybook files and create components', async () => {
      const storybookParser = new StorybookParser(path.join(testDataDir, 'fixtures'));
      
      await storybookParser.parseStories();
      const components = storybookParser.getComponents();
      
      expect(components.length).toBeGreaterThan(0);
      
      const buttonComponent = components.find(c => c.name === 'Button');
      expect(buttonComponent).toBeDefined();
      expect(buttonComponent!.examples.length).toBeGreaterThan(0);
    });

    it('should build complete indexes from parsed data', async () => {
      // This simulates the full index building process
      const repoPath = path.join(testDataDir, 'fixtures');
      
      await indexManager.buildIndexes(repoPath, 'main', 'abc123test');
      
      const tokens = indexManager.getTokens();
      const components = indexManager.getComponents();
      const meta = indexManager.getIndexMeta();
      
      expect(tokens.length).toBeGreaterThan(0);
      expect(components.length).toBeGreaterThan(0);
      expect(meta).toBeDefined();
      expect(meta!.upstreamRef).toBe('main');
    });
  });

  describe('MCP Server Integration', () => {
    beforeAll(async () => {
      // Set up server with test data
      const testIndexes = path.join('./tests/cache', 'test-indexes');
      await fs.ensureDir(testIndexes);
      
      // Build indexes for testing
      const repoPath = path.join(testDataDir, 'fixtures');
      await indexManager.buildIndexes(repoPath, 'main', 'abc123test');
      
      // Initialize the MCP server
      await server.initialize();
    });

    it('should handle complete Copilot workflow: list → search → scaffold', async () => {
      // Step 1: List available components
      const componentsList = await server.listComponents();
      expect(componentsList.components.length).toBeGreaterThan(0);
      
      const hasButton = componentsList.components.some(c => c.name === 'Button');
      expect(hasButton).toBe(true);
      
      // Step 2: Search for button examples
      const searchResults = await server.searchExamples('primary button');
      expect(searchResults.results.length).toBeGreaterThan(0);
      
      // Step 3: Get detailed component info
      const buttonInfo = await server.getComponent('Button');
      expect(buttonInfo.name).toBe('Button');
      expect(buttonInfo.variants).toBeDefined();
      
      // Step 4: Scaffold a custom button
      const scaffoldResult = await server.scaffoldComponent('Button', {
        variant: 'primary',
        size: 'lg',
        text: 'Get Started'
      });
      
      expect(scaffoldResult.html).toContain('made-btn');
      expect(scaffoldResult.html).toContain('Get Started');
      expect(scaffoldResult.notes.length).toBeGreaterThan(0);
    });

    it('should validate generated markup', async () => {
      // Generate component markup
      const scaffoldResult = await server.scaffoldComponent('Button', {
        variant: 'primary'
      });
      
      // Validate the generated markup
      const lintResult = await server.lintMarkup(scaffoldResult.html);
      
      // The generated markup should be valid or have only minor warnings
      const errors = lintResult.issues.filter(issue => issue.type === 'error');
      expect(errors.length).toBe(0);
    });

    it('should provide comprehensive health status', async () => {
      const health = await server.healthCheck();
      
      expect(health.status).toBe('healthy');
      expect(health.checks.length).toBeGreaterThan(0);
      
      // All critical checks should pass
      const criticalChecks = ['indexes_loaded', 'initialization'];
      criticalChecks.forEach(checkName => {
        const check = health.checks.find(c => c.name === checkName);
        expect(check).toBeDefined();
        expect(check!.status).toBe('pass');
      });
    });

    it('should handle design token queries effectively', async () => {
      // Test token listing and filtering
      const allTokens = await server.listTokens();
      expect(allTokens.tokens.length).toBeGreaterThan(0);
      
      const colorTokens = await server.listTokens('color');
      expect(colorTokens.tokens.length).toBeGreaterThan(0);
      expect(colorTokens.tokens.every(t => t.category === 'color')).toBe(true);
      
      const spacingTokens = await server.listTokens('spacing');
      expect(spacingTokens.tokens.length).toBeGreaterThan(0);
      expect(spacingTokens.tokens.every(t => t.category === 'spacing')).toBe(true);
    });
  });

  describe('Performance and Reliability', () => {
    beforeAll(async () => {
      await server.initialize();
    });

    it('should handle concurrent requests efficiently', async () => {
      // Simulate multiple concurrent requests
      const requests = [
        server.listTokens(),
        server.listComponents(),
        server.searchExamples('button'),
        server.getComponent('Button'),
        server.healthCheck()
      ];
      
      const results = await Promise.all(requests);
      
      // All requests should succeed
      results.forEach(result => {
        expect(result).toBeDefined();
      });
      
      // Specific validations
      expect((results[0] as any).tokens).toBeDefined();
      expect((results[1] as any).components).toBeDefined();
      expect((results[2] as any).results).toBeDefined();
      expect((results[3] as any).name).toBe('Button');
      expect((results[4] as any).status).toBe('healthy');
    });

    it('should maintain performance with repeated calls', async () => {
      const startTime = Date.now();
      
      // Make multiple calls to test caching
      for (let i = 0; i < 10; i++) {
        await server.listTokens();
        await server.listComponents();
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Should complete 20 calls in reasonable time (less than 2 seconds)
      expect(totalTime).toBeLessThan(2000);
    });

    it('should provide consistent results across multiple calls', async () => {
      // Get baseline results
      const baselineTokens = await server.listTokens();
      const baselineComponents = await server.listComponents();
      
      // Make multiple calls and verify consistency
      for (let i = 0; i < 5; i++) {
        const tokens = await server.listTokens();
        const components = await server.listComponents();
        
        expect(tokens.tokens.length).toBe(baselineTokens.tokens.length);
        expect(components.components.length).toBe(baselineComponents.components.length);
      }
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    beforeAll(async () => {
      await server.initialize();
    });

    it('should handle malformed search queries gracefully', async () => {
      const malformedQueries = [
        '',
        '   ',
        '!@#$%^&*()',
        'very long query that might cause issues with processing and could potentially break the search functionality if not handled properly'
      ];
      
      for (const query of malformedQueries) {
        const result = await server.searchExamples(query);
        expect(result.results).toBeDefined();
        expect(result.meta.query).toBe(query);
      }
    });

    it('should handle invalid component requests appropriately', async () => {
      const invalidNames = [
        'NonExistentComponent',
        '',
        '   ',
        '123',
        'component-with-dashes',
        'UPPERCASE'
      ];
      
      for (const name of invalidNames) {
        await expect(server.getComponent(name)).rejects.toThrow();
      }
    });

    it('should validate and clean malformed HTML markup', async () => {
      const malformedHTML = [
        '<button>Unclosed button',
        '<div><span>Nested unclosed</div>',
        '<button onclick="alert()">Security risk</button>',
        '<<>invalid</>tags>',
        ''
      ];
      
      for (const html of malformedHTML) {
        const result = await server.lintMarkup(html);
        expect(result.valid).toBeDefined();
        expect(result.issues).toBeDefined();
        // Should not throw errors even with malformed input
      }
    });
  });

  describe('Comprehensive Component Testing', () => {
    beforeAll(async () => {
      await server.initialize();
    });

    it('should generate accessible markup by default', async () => {
      const scaffoldResult = await server.scaffoldComponent('Button', {
        variant: 'primary',
        text: 'Test Button'
      });
      
      expect(scaffoldResult.html).toContain('type="button"');
      
      // Lint the generated markup for accessibility
      const lintResult = await server.lintMarkup(scaffoldResult.html);
      
      // Should not have critical accessibility errors
      const a11yErrors = lintResult.issues.filter(issue => 
        issue.type === 'error' && 
        issue.message.toLowerCase().includes('accessibility')
      );
      
      expect(a11yErrors.length).toBe(0);
    });

    it('should apply MADE design tokens correctly', async () => {
      const scaffoldResult = await server.scaffoldComponent('Button', {
        variant: 'primary'
      });
      
      // Should use MADE classes
      expect(scaffoldResult.html).toMatch(/made-btn/);
      expect(scaffoldResult.html).toMatch(/made-btn-primary/);
      
      // Lint should validate MADE compliance
      const lintResult = await server.lintMarkup(scaffoldResult.html);
      const madeIssues = lintResult.issues.filter(issue => 
        issue.message.toLowerCase().includes('made')
      );
      
      // Should have minimal or no MADE-specific issues
      const criticalMadeIssues = madeIssues.filter(issue => issue.type === 'error');
      expect(criticalMadeIssues.length).toBe(0);
    });

    it('should handle complex component variations', async () => {
      const variations = [
        { variant: 'primary', size: 'sm' },
        { variant: 'secondary', size: 'lg' },
        { variant: 'primary', disabled: true },
        { variant: 'secondary', className: 'custom-class' }
      ];
      
      for (const props of variations) {
        const result = await server.scaffoldComponent('Button', props);
        
        expect(result.html).toBeTruthy();
        expect(result.notes.length).toBeGreaterThan(0);
        
        // Verify the HTML contains expected classes/attributes
        if (props.variant) {
          expect(result.html).toContain(`made-btn-${props.variant}`);
        }
        if (props.size) {
          expect(result.html).toContain(`made-btn-${props.size}`);
        }
        if (props.disabled) {
          expect(result.html).toContain('disabled');
        }
        if (props.className) {
          expect(result.html).toContain(props.className);
        }
      }
    });
  });
});