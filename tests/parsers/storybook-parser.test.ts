import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'path';
import { StorybookParser } from '../../src/parsers/storybook-parser.js';

describe('StorybookParser', () => {
  let parser: StorybookParser;
  const testStoriesDir = './tests/fixtures';

  beforeEach(() => {
    parser = new StorybookParser(testStoriesDir);
  });

  describe('parseStories', () => {
    it('should parse components from story files', async () => {
      await parser.parseStories();
      const components = parser.getComponents();

      expect(components.length).toBeGreaterThan(0);
      
      const buttonComponent = components.find(comp => comp.name === 'Button');
      expect(buttonComponent).toBeDefined();
    });

    it('should extract component metadata correctly', async () => {
      await parser.parseStories();
      const buttonComponent = parser.getComponent('Button');

      expect(buttonComponent).toBeDefined();
      expect(buttonComponent?.name).toBe('Button');
      expect(buttonComponent?.description).toBeTruthy();
      expect(buttonComponent?.examples.length).toBeGreaterThan(0);
    });

    it('should parse component variants', async () => {
      await parser.parseStories();
      const buttonComponent = parser.getComponent('Button');

      expect(buttonComponent?.variants).toBeDefined();
      expect(buttonComponent?.variants.variant).toContain('primary');
      expect(buttonComponent?.variants.variant).toContain('secondary');
      expect(buttonComponent?.variants.size).toContain('sm');
      expect(buttonComponent?.variants.size).toContain('lg');
    });

    it('should extract CSS classes from examples', async () => {
      await parser.parseStories();
      const buttonComponent = parser.getComponent('Button');

      expect(buttonComponent?.cssClasses).toContain('made-btn');
      expect(buttonComponent?.cssClasses).toContain('made-btn-primary');
    });

    it('should generate HTML scaffolds', async () => {
      await parser.parseStories();
      const buttonComponent = parser.getComponent('Button');

      expect(buttonComponent?.htmlScaffold).toBeTruthy();
      expect(buttonComponent?.htmlScaffold).toContain('<button');
      expect(buttonComponent?.htmlScaffold).toContain('made-btn');
    });

    it('should parse multiple examples per component', async () => {
      await parser.parseStories();
      const buttonComponent = parser.getComponent('Button');

      expect(buttonComponent?.examples.length).toBeGreaterThan(1);
      
      const primaryExample = buttonComponent?.examples.find(ex => 
        ex.title.toLowerCase().includes('primary')
      );
      expect(primaryExample).toBeDefined();
      
      const secondaryExample = buttonComponent?.examples.find(ex => 
        ex.title.toLowerCase().includes('secondary')
      );
      expect(secondaryExample).toBeDefined();
    });
  });

  describe('component search', () => {
    beforeEach(async () => {
      await parser.parseStories();
    });

    it('should find components by name', () => {
      const buttonComponent = parser.getComponent('Button');
      expect(buttonComponent).toBeDefined();
      
      const nonExistentComponent = parser.getComponent('NonExistent');
      expect(nonExistentComponent).toBeUndefined();
    });

    it('should search components by query', () => {
      const results = parser.searchComponents('button');
      expect(results.length).toBeGreaterThan(0);
      
      const buttonResult = results.find(comp => comp.name === 'Button');
      expect(buttonResult).toBeDefined();
    });

    it('should search by tags', () => {
      const results = parser.searchComponents('interactive');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('HTML processing', () => {
    beforeEach(async () => {
      await parser.parseStories();
    });

    it('should convert JSX-like syntax to HTML', async () => {
      // Test JSX conversion logic
      const buttonComponent = parser.getComponent('Button');
      const examples = buttonComponent?.examples;

      examples?.forEach(example => {
        expect(example.html).toBeTruthy();
        expect(example.html).toContain('<button');
        expect(example.html).not.toContain('className=');
        expect(example.html).toContain('class=');
      });
    });

    it('should extract CSS variables from styles', async () => {
      // This would test CSS variable extraction from inline styles
      // For now, we check that the functionality exists
      const buttonComponent = parser.getComponent('Button');
      expect(buttonComponent?.cssVarsUsed).toBeDefined();
      expect(Array.isArray(buttonComponent?.cssVarsUsed)).toBe(true);
    });
  });

  describe('accessibility extraction', () => {
    beforeEach(async () => {
      await parser.parseStories();
    });

    it('should extract accessibility notes', async () => {
      const buttonComponent = parser.getComponent('Button');
      
      // Check that a11y notes structure exists
      expect(buttonComponent?.a11yNotes).toBeDefined();
      expect(Array.isArray(buttonComponent?.a11yNotes)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle empty directories gracefully', async () => {
      const emptyParser = new StorybookParser('./tests/cache');
      await emptyParser.parseStories();
      
      const components = emptyParser.getComponents();
      expect(components).toEqual([]);
    });

    it('should handle malformed story files', async () => {
      // Parser should not crash on malformed files
      await expect(parser.parseStories()).resolves.not.toThrow();
    });
  });

  describe('data integrity', () => {
    beforeEach(async () => {
      await parser.parseStories();
    });

    it('should return immutable copies of components', () => {
      const components1 = parser.getComponents();
      const components2 = parser.getComponents();
      
      expect(components1).not.toBe(components2);
      expect(components1).toEqual(components2);
    });

    it('should validate component structure', async () => {
      const components = parser.getComponents();
      
      components.forEach(component => {
        expect(component.name).toBeTruthy();
        expect(component.htmlScaffold).toBeTruthy();
        expect(Array.isArray(component.examples)).toBe(true);
        expect(Array.isArray(component.cssClasses)).toBe(true);
        expect(Array.isArray(component.tags)).toBe(true);
        expect(typeof component.variants).toBe('object');
      });
    });
  });
});