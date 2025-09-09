import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import { CSSParser } from '../../src/parsers/css-parser.js';

describe('CSSParser', () => {
  let parser: CSSParser;
  const testCSSPath = path.join('./tests/fixtures', 'sample-css.css');

  beforeEach(() => {
    parser = new CSSParser();
  });

  describe('parseMadeCSSVariables', () => {
    it('should parse CSS variables from file', async () => {
      await parser.parseMadeCSSVariables(testCSSPath);
      const tokens = parser.getTokens();

      expect(tokens.length).toBeGreaterThan(0);
      
      // Check for specific tokens
      const primaryColor = tokens.find(token => token.name === '--made-color-primary-500');
      expect(primaryColor).toBeDefined();
      expect(primaryColor?.value).toBe('#FF5F00');
      expect(primaryColor?.category).toBe('color');
    });

    it('should categorize tokens correctly', async () => {
      await parser.parseMadeCSSVariables(testCSSPath);
      const tokens = parser.getTokens();

      // Check color tokens
      const colorTokens = tokens.filter(token => token.category === 'color');
      expect(colorTokens.length).toBeGreaterThan(0);
      
      // Check spacing tokens
      const spacingTokens = tokens.filter(token => token.category === 'spacing');
      expect(spacingTokens.length).toBeGreaterThan(0);
      
      // Check typography tokens
      const typographyTokens = tokens.filter(token => token.category === 'typography');
      expect(typographyTokens.length).toBeGreaterThan(0);
    });

    it('should generate appropriate descriptions', async () => {
      await parser.parseMadeCSSVariables(testCSSPath);
      const tokens = parser.getTokens();

      const primaryColor = tokens.find(token => token.name === '--made-color-primary-500');
      expect(primaryColor?.description).toContain('color token');
      expect(primaryColor?.description).toContain(primaryColor?.value);
    });
  });

  describe('parseMadeCSS', () => {
    it('should parse utility classes from CSS', async () => {
      await parser.parseMadeCSS(testCSSPath);
      const utilityClasses = parser.getUtilityClasses();

      expect(utilityClasses).toContain('made-btn');
      expect(utilityClasses).toContain('made-btn-primary');
      expect(utilityClasses).toContain('made-card');
      expect(utilityClasses).toContain('p-1');
      expect(utilityClasses).toContain('text-primary');
    });

    it('should identify MADE classes correctly', async () => {
      await parser.parseMadeCSS(testCSSPath);

      expect(parser.isMadeClass('made-btn')).toBe(true);
      expect(parser.isMadeClass('made-btn-primary')).toBe(true);
      expect(parser.isMadeClass('p-3')).toBe(true);
      expect(parser.isMadeClass('custom-class')).toBe(false);
    });
  });

  describe('helper methods', () => {
    beforeEach(async () => {
      await parser.parseMadeCSSVariables(testCSSPath);
    });

    it('should find tokens by pattern', () => {
      const colorTokens = parser.findTokens('color');
      expect(colorTokens.length).toBeGreaterThan(0);
      
      const primaryTokens = parser.findTokens(/primary/);
      expect(primaryTokens.length).toBeGreaterThan(0);
    });

    it('should get tokens by category', () => {
      const colorTokens = parser.getTokensByCategory('color');
      expect(colorTokens.length).toBeGreaterThan(0);
      
      const spacingTokens = parser.getTokensByCategory('spacing');
      expect(spacingTokens.length).toBeGreaterThan(0);
    });

    it('should return immutable copies of data', () => {
      const tokens1 = parser.getTokens();
      const tokens2 = parser.getTokens();
      
      expect(tokens1).not.toBe(tokens2); // Different references
      expect(tokens1).toEqual(tokens2); // Same content
    });
  });

  describe('error handling', () => {
    it('should handle missing files gracefully', async () => {
      await expect(parser.parseMadeCSSVariables('./nonexistent.css'))
        .rejects.toThrow();
    });

    it('should handle malformed CSS', async () => {
      const malformedCSS = path.join('./tests/cache', 'malformed.css');
      await fs.writeFile(malformedCSS, ':root { --invalid-token }');
      
      // Should not throw, but may not parse tokens
      await parser.parseMadeCSSVariables(malformedCSS);
      // The parser should handle malformed CSS gracefully
    });
  });
});