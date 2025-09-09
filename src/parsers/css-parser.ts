import fs from 'fs-extra';
import { parse } from '@adobe/css-tools';
import { MADEToken } from '../types.js';
import { logger } from '../utils/logger.js';

export class CSSParser {
  private tokens: MADEToken[] = [];
  private utilityClasses: string[] = [];

  async parseMadeCSS(cssFilePath: string): Promise<void> {
    try {
      const cssContent = await fs.readFile(cssFilePath, 'utf-8');
      const ast = parse(cssContent);
      
      await this.extractUtilityClasses(ast);
      logger.info(`Parsed ${this.utilityClasses.length} utility classes from ${cssFilePath}`);
    } catch (error) {
      logger.error(`Failed to parse CSS file ${cssFilePath}:`, error);
      throw error;
    }
  }

  async parseMadeCSSVariables(variablesFilePath: string): Promise<void> {
    try {
      const cssContent = await fs.readFile(variablesFilePath, 'utf-8');
      const ast = parse(cssContent);
      
      await this.extractCSSVariables(ast);
      logger.info(`Parsed ${this.tokens.length} CSS variables from ${variablesFilePath}`);
    } catch (error) {
      logger.error(`Failed to parse CSS variables file ${variablesFilePath}:`, error);
      // Don't throw error for malformed CSS, just log it and continue
      if (error instanceof Error && error.message.includes('property missing')) {
        return; // Gracefully handle malformed CSS
      }
      throw error;
    }
  }

  async parseMadeTokensJSON(jsonFilePath: string): Promise<void> {
    try {
      const jsonContent = await fs.readFile(jsonFilePath, 'utf-8');
      const tokensData = JSON.parse(jsonContent);
      
      await this.extractJSONTokens(tokensData);
      logger.info(`Parsed ${this.tokens.length} tokens from JSON file ${jsonFilePath}`);
    } catch (error) {
      logger.error(`Failed to parse JSON tokens file ${jsonFilePath}:`, error);
      throw error;
    }
  }

  private async extractCSSVariables(ast: any): Promise<void> {
    const tokens: MADEToken[] = [];
    
    // Walk through the AST to find CSS custom properties (variables)
    this.walkAST(ast, (rule: any) => {
      if (rule.type === 'rule' && rule.selectors?.includes(':root')) {
        // Process :root selector
        rule.declarations?.forEach((decl: any) => {
          if (decl.type === 'declaration' && decl.property?.startsWith('--made-')) {
            // Extract comment description if available
            let description = this.extractTokenDescription(decl.property, decl.value);
            let cleanValue = decl.value;
            
            // Handle inline comments in the value
            const commentMatch = decl.value.match(/^([^\/]+)\/\*\s*(.+?)\s*\*\/$/);
            if (commentMatch) {
              cleanValue = commentMatch[1].trim();
              description = commentMatch[2].trim();
            }
            
            const token: MADEToken = {
              name: decl.property,
              value: cleanValue,
              category: this.categorizeToken(decl.property),
              description
            };
            tokens.push(token);
          }
        });
      }
    });
    
    // Merge with existing tokens, avoiding duplicates
    const existingNames = new Set(this.tokens.map(t => t.name));
    const newTokens = tokens.filter(t => !existingNames.has(t.name));
    this.tokens = [...this.tokens, ...newTokens];
  }

  private async extractJSONTokens(tokensData: any): Promise<void> {
    const tokens: MADEToken[] = [];
    
    // Handle flat token structure (like Made design tokens)
    if (typeof tokensData === 'object' && tokensData !== null) {
      for (const [key, value] of Object.entries(tokensData)) {
        if (typeof value === 'string') {
          // Convert camelCase token names to CSS variable format
          const cssVarName = this.convertToCSSVariable(key);
          
          const token: MADEToken = {
            name: cssVarName,
            value: value as string,
            category: this.categorizeToken(cssVarName),
            description: this.extractTokenDescription(cssVarName, value as string)
          };
          tokens.push(token);
        }
      }
    }
    
    // Merge with existing tokens, avoiding duplicates
    const existingNames = new Set(this.tokens.map(t => t.name));
    const newTokens = tokens.filter(t => !existingNames.has(t.name));
    this.tokens = [...this.tokens, ...newTokens];
  }

  private convertToCSSVariable(tokenName: string): string {
    // Convert MadeColorPrimary500 to --made-color-primary-500
    return '--' + tokenName
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '');
  }

  private async extractUtilityClasses(ast: any): Promise<void> {
    const classes: string[] = [];
    
    this.walkAST(ast, (rule: any) => {
      if (rule.type === 'rule' && rule.selectors) {
        rule.selectors.forEach((selector: string) => {
          // Extract class names from selectors
          const classMatches = selector.match(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g);
          if (classMatches) {
            classMatches.forEach(match => {
              const className = match.substring(1); // Remove the dot
              
              if (className.startsWith('made-') || this.isUtilityClass(className)) {
                classes.push(className);
              }
            });
          }
        });
      }
    });
    
    // Remove duplicates and sort
    const newClasses = [...new Set(classes)].sort();
    this.utilityClasses = [...this.utilityClasses, ...newClasses];
    this.utilityClasses = [...new Set(this.utilityClasses)].sort();
  }

  private walkAST(node: any, callback: (node: any) => void): void {
    callback(node);
    
    // Handle the top-level stylesheet structure
    if (node.stylesheet && node.stylesheet.rules) {
      node.stylesheet.rules.forEach((child: any) => this.walkAST(child, callback));
    }
    
    if (node.rules) {
      node.rules.forEach((child: any) => this.walkAST(child, callback));
    }
    if (node.declarations) {
      node.declarations.forEach((child: any) => this.walkAST(child, callback));
    }
  }

  private categorizeToken(tokenName: string): MADEToken['category'] {
    const name = tokenName.toLowerCase();
    
    // Color tokens
    if (name.includes('color') || name.includes('bg') || name.includes('background') || 
        name.includes('border') || name.includes('text') && (name.includes('color') || name.match(/red|blue|green|yellow|orange|purple|gray|grey|white|black|teal|gold/))) {
      return 'color';
    }
    
    // Spacing tokens
    if (name.includes('space') || name.includes('spacing') || name.includes('padding') || 
        name.includes('margin') || name.includes('gap') || name.includes('size') && name.match(/\d+(-x)?$/)) {
      return 'spacing';
    }
    
    // Typography tokens
    if (name.includes('font') || name.includes('text') || name.includes('line-height') || 
        name.includes('letter-spacing') || name.includes('weight')) {
      return 'typography';
    }
    
    // Shadow tokens
    if (name.includes('shadow') || name.includes('drop-shadow') || name.includes('elevation')) {
      return 'shadow';
    }
    
    // Border radius tokens
    if (name.includes('radius') || name.includes('border-radius') || name.includes('rounded')) {
      return 'radius';
    }
    
    // Time/animation tokens
    if (name.includes('time') || name.includes('duration') || name.includes('transition') || 
        name.includes('animation') || name.includes('slow') || name.includes('fast') || name.includes('moderate')) {
      return 'time';
    }
    
    // Z-index tokens
    if (name.includes('z-index') || name.includes('zindex') || name.includes('layer')) {
      return 'other';
    }
    
    // Breakpoint tokens
    if (name.includes('breakpoint') || name.includes('screen') || name.includes('container') || name.includes('viewport')) {
      return 'breakpoint';
    }
    
    return 'other';
  }

  private extractTokenDescription(name: string, value: string): string {
    const category = this.categorizeToken(name);
    const cleanName = name.replace('--made-', '').replace(/-/g, ' ');
    
    switch (category) {
      case 'color':
        return `${cleanName} color token (${value})`;
      case 'spacing':
        return `${cleanName} spacing value (${value})`;
      case 'typography':
        return `${cleanName} typography setting (${value})`;
      case 'shadow':
        return `${cleanName} shadow effect (${value})`;
      case 'radius':
        return `${cleanName} border radius (${value})`;
      case 'breakpoint':
        return `${cleanName} responsive breakpoint (${value})`;
      default:
        return `${cleanName} design token (${value})`;
    }
  }

  private isUtilityClass(className: string): boolean {
    // Common utility class patterns
    const utilityPatterns = [
      /^m[tlbr]?-\d+$/,       // margins
      /^p[tlbr]?-\d+$/,       // padding
      /^text-(left|center|right|justify)$/, // text alignment
      /^text-(xs|sm|base|lg|xl|\d*xl)$/,   // text sizes
      /^text-(primary|secondary|white|black)$/, // text colors
      /^bg-\w+$/,             // backgrounds
      /^border-\w+$/,         // borders
      /^flex/,                // flex utilities
      /^grid/,                // grid utilities
      /^w-\w+$/,              // widths
      /^h-\w+$/,              // heights
      /^rounded/,             // border radius
      /^shadow/               // shadows
    ];
    
    return utilityPatterns.some(pattern => pattern.test(className));
  }

  getTokens(): MADEToken[] {
    return [...this.tokens];
  }

  getUtilityClasses(): string[] {
    return [...this.utilityClasses];
  }

  // Helper method to validate if a CSS class is from MADE design system
  isMadeClass(className: string): boolean {
    return this.utilityClasses.includes(className) || 
           className.startsWith('made-') ||
           this.isUtilityClass(className);
  }

  // Find tokens that match a given pattern
  findTokens(pattern: string | RegExp): MADEToken[] {
    const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
    return this.tokens.filter(token => regex.test(token.name) || regex.test(token.value));
  }

  // Get tokens by category
  getTokensByCategory(category: MADEToken['category']): MADEToken[] {
    return this.tokens.filter(token => token.category === category);
  }
}