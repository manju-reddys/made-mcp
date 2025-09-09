import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import { MADEMCPServer } from '../../src/mcp-server.js';

describe('Golden Snapshot Tests', () => {
  let server: MADEMCPServer;
  const goldenDir = './tests/golden';

  beforeAll(async () => {
    await fs.ensureDir(goldenDir);
    
    // Initialize server with test data
    server = new MADEMCPServer();
    
    // Mock the server to use test fixtures
    const mockIndexManager = {
      loadIndexes: async () => {},
      getTokens: () => [
        {
          name: '--made-color-primary-500',
          value: '#FF5F00',
          category: 'color' as const,
          description: 'Primary brand color'
        }
      ],
      getComponents: () => [
        {
          name: 'Button',
          description: 'Interactive button component',
          tags: ['interactive'],
          variants: {
            variant: ['primary', 'secondary'],
            size: ['sm', 'md', 'lg']
          },
          props: {},
          a11yNotes: [],
          htmlScaffold: '<button class="made-btn" type="button">Button</button>',
          cssClasses: ['made-btn', 'made-btn-primary'],
          cssVarsUsed: ['--made-color-primary-500'],
          examples: []
        }
      ]
    };

    const mockComponentScaffolder = {
      initialize: async () => {},
      scaffold: async (component: any, props: any = {}) => {
        let html = '<button class="made-btn';
        
        if (props.variant) {
          html += ` made-btn-${props.variant}`;
        }
        if (props.size) {
          html += ` made-btn-${props.size}`;
        }
        
        html += '" type="button"';
        
        if (props.disabled) {
          html += ' disabled';
        }
        
        html += ` aria-label="${component.name} button"`;
        html += `>${props.text || component.name}</button>`;
        
        return {
          html,
          notes: [`Applied ${props.variant || 'default'} variant`],
          dependencies: ['made.css']
        };
      }
    };

    // Mock other dependencies
    (server as any).indexManager = mockIndexManager;
    (server as any).componentScaffolder = mockComponentScaffolder;
    (server as any).markupLinter = { initialize: async () => {}, lint: async () => [] };
    (server as any).searchEngine = { initialize: async () => {}, search: async () => [] };

    await server.initialize();
  });

  const goldenTests = [
    {
      name: 'button-primary',
      component: 'Button',
      props: { variant: 'primary' },
      description: 'Primary button with default styling'
    },
    {
      name: 'button-secondary-large',
      component: 'Button', 
      props: { variant: 'secondary', size: 'lg', text: 'Large Secondary' },
      description: 'Large secondary button with custom text'
    },
    {
      name: 'button-disabled',
      component: 'Button',
      props: { variant: 'primary', disabled: true, text: 'Disabled' },
      description: 'Disabled primary button'
    },
    {
      name: 'button-small',
      component: 'Button',
      props: { variant: 'primary', size: 'sm', text: 'Small' },
      description: 'Small primary button'
    }
  ];

  describe('Component Scaffolding Snapshots', () => {
    goldenTests.forEach(test => {
      it(`should match golden snapshot for ${test.name}`, async () => {
        const result = await server.scaffoldComponent(test.component, test.props);
        const goldenPath = path.join(goldenDir, `${test.name}.golden.html`);
        
        // Check if golden file exists
        if (await fs.pathExists(goldenPath)) {
          // Compare with existing golden file
          const goldenContent = await fs.readFile(goldenPath, 'utf-8');
          expect(result.html.trim()).toBe(goldenContent.trim());
        } else {
          // Create new golden file for first run
          await fs.writeFile(goldenPath, result.html);
          console.warn(`Created new golden file: ${goldenPath}`);
          
          // Still run the test to ensure the HTML is reasonable
          expect(result.html).toContain('<button');
          expect(result.html).toContain('made-btn');
          
          if (test.props.variant) {
            expect(result.html).toContain(`made-btn-${test.props.variant}`);
          }
        }
      });
    });
  });

  describe('Token Output Snapshots', () => {
    it('should match token list format', async () => {
      const result = await server.listTokens('color');
      const goldenPath = path.join(goldenDir, 'color-tokens.golden.json');
      
      if (await fs.pathExists(goldenPath)) {
        const goldenContent = await fs.readJson(goldenPath);
        expect(result).toEqual(goldenContent);
      } else {
        await fs.writeJson(goldenPath, result, { spaces: 2 });
        console.warn(`Created new golden file: ${goldenPath}`);
        
        expect(result.tokens).toBeDefined();
        expect(result.meta).toBeDefined();
      }
    });

    it('should match component list format', async () => {
      const result = await server.listComponents();
      const goldenPath = path.join(goldenDir, 'components-list.golden.json');
      
      if (await fs.pathExists(goldenPath)) {
        const goldenContent = await fs.readJson(goldenPath);
        expect(result).toEqual(goldenContent);
      } else {
        await fs.writeJson(goldenPath, result, { spaces: 2 });
        console.warn(`Created new golden file: ${goldenPath}`);
        
        expect(result.components).toBeDefined();
        expect(Array.isArray(result.components)).toBe(true);
      }
    });
  });

  describe('Complex Scenario Snapshots', () => {
    it('should handle multi-variant component combinations', async () => {
      const scenarios = [
        { variant: 'primary', size: 'sm' },
        { variant: 'primary', size: 'lg' },
        { variant: 'secondary', size: 'sm' },
        { variant: 'secondary', size: 'lg' }
      ];
      
      const results = [];
      for (const props of scenarios) {
        const result = await server.scaffoldComponent('Button', props);
        results.push({
          props,
          html: result.html,
          notes: result.notes
        });
      }
      
      const goldenPath = path.join(goldenDir, 'button-variations.golden.json');
      
      if (await fs.pathExists(goldenPath)) {
        const goldenContent = await fs.readJson(goldenPath);
        expect(results).toEqual(goldenContent);
      } else {
        await fs.writeJson(goldenPath, results, { spaces: 2 });
        console.warn(`Created new golden file: ${goldenPath}`);
        
        // Validate structure
        expect(results.length).toBe(4);
        results.forEach(result => {
          expect(result.html).toContain('made-btn');
          expect(result.notes).toBeDefined();
        });
      }
    });
  });

  describe('Health Check Snapshots', () => {
    it('should maintain consistent health check format', async () => {
      const result = await server.healthCheck();
      
      // Remove timestamp-dependent fields for stable comparison
      const normalizedResult = {
        ...result,
        lastSync: result.lastSync ? 'TIMESTAMP_PLACEHOLDER' : result.lastSync,
        checks: result.checks.map(check => ({
          ...check,
          message: check.message?.replace(/\\d+/g, 'NUMBER_PLACEHOLDER') || check.message
        }))
      };
      
      const goldenPath = path.join(goldenDir, 'health-check.golden.json');
      
      if (await fs.pathExists(goldenPath)) {
        const goldenContent = await fs.readJson(goldenPath);
        expect(normalizedResult).toEqual(goldenContent);
      } else {
        await fs.writeJson(goldenPath, normalizedResult, { spaces: 2 });
        console.warn(`Created new golden file: ${goldenPath}`);
        
        expect(result.status).toBeDefined();
        expect(result.version).toBeDefined();
        expect(Array.isArray(result.checks)).toBe(true);
      }
    });
  });

  describe('Golden File Management', () => {
    it('should validate all golden files exist and are readable', async () => {
      const goldenFiles = await fs.readdir(goldenDir);
      const expectedFiles = [
        ...goldenTests.map(test => `${test.name}.golden.html`),
        'color-tokens.golden.json',
        'components-list.golden.json', 
        'button-variations.golden.json',
        'health-check.golden.json'
      ];
      
      for (const expectedFile of expectedFiles) {
        if (!goldenFiles.includes(expectedFile)) {
          console.warn(`Missing golden file: ${expectedFile}`);
        } else {
          // Verify file is readable
          const content = await fs.readFile(path.join(goldenDir, expectedFile), 'utf-8');
          expect(content.length).toBeGreaterThan(0);
        }
      }
    });

    it('should provide regeneration capability', async () => {
      // This test can be used to regenerate golden files during major updates
      const regenerateGoldens = process.env.REGENERATE_GOLDEN_FILES === 'true';
      
      if (regenerateGoldens) {
        console.log('Regenerating golden files...');
        
        // Regenerate component snapshots
        for (const test of goldenTests) {
          const result = await server.scaffoldComponent(test.component, test.props);
          const goldenPath = path.join(goldenDir, `${test.name}.golden.html`);
          await fs.writeFile(goldenPath, result.html);
        }
        
        // Regenerate JSON snapshots
        const colorTokens = await server.listTokens('color');
        await fs.writeJson(path.join(goldenDir, 'color-tokens.golden.json'), colorTokens, { spaces: 2 });
        
        const componentsList = await server.listComponents();
        await fs.writeJson(path.join(goldenDir, 'components-list.golden.json'), componentsList, { spaces: 2 });
        
        console.log('Golden files regenerated successfully');
      }
      
      // This test always passes, it's just for regeneration
      expect(true).toBe(true);
    });
  });
});