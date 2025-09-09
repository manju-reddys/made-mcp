import fs from 'fs-extra';
import * as path from 'path';
import * as glob from 'glob';
import { load } from 'cheerio';
import { MADEComponent, ComponentExample } from '../types.js';
import { logger } from '../utils/logger.js';

export class StorybookParser {
  private components: MADEComponent[] = [];
  private storybookRoot: string;

  constructor(storybookRoot: string) {
    this.storybookRoot = storybookRoot;
  }

  async parseStories(): Promise<void> {
    try {
      logger.info(`Parsing Storybook stories from ${this.storybookRoot}`);
      
      // Find all story files
      const storyFiles = await this.findStoryFiles();
      logger.info(`Found ${storyFiles.length} story files`);
      
      // Parse each story file
      for (const storyFile of storyFiles) {
        try {
          await this.parseStoryFile(storyFile);
        } catch (error) {
          logger.warn(`Failed to parse story file ${storyFile}:`, error);
        }
      }
      
      logger.info(`Successfully parsed ${this.components.length} components from stories`);
    } catch (error) {
      logger.error('Failed to parse Storybook stories:', error);
      throw error;
    }
  }

  private async findStoryFiles(): Promise<string[]> {
    const patterns = [
      path.join(this.storybookRoot, '**/*.stories.{js,ts,jsx,tsx,mdx}'),
      path.join(this.storybookRoot, '**/*.story.{js,ts,jsx,tsx,mdx}')
    ];
    
    const files: string[] = [];
    for (const pattern of patterns) {
      const matches = glob.sync(pattern, { ignore: '**/node_modules/**' });
      files.push(...matches);
    }
    
    return [...new Set(files)].sort();
  }

  private async parseStoryFile(filePath: string): Promise<void> {
    const content = await fs.readFile(filePath, 'utf-8');
    const relativePath = path.relative(this.storybookRoot, filePath);
    
    // Determine if it's an MDX file or JS/TS
    if (filePath.endsWith('.mdx')) {
      await this.parseMDXStory(content, relativePath);
    } else {
      await this.parseJSStory(content, relativePath);
    }
  }

  private async parseMDXStory(content: string, sourcePath: string): Promise<void> {
    // Extract component name from file path or Meta title
    const componentName = this.extractComponentName(content, sourcePath);
    
    // Parse MDX content to find code blocks and examples
    const examples = this.extractMDXExamples(content, sourcePath);
    
    if (componentName && examples.length > 0) {
      const component: MADEComponent = {
        name: componentName,
        description: this.extractDescription(content),
        tags: this.extractTags(content, sourcePath),
        variants: this.extractVariants(content, examples),
        props: this.extractProps(content),
        a11yNotes: this.extractAccessibilityNotes(content),
        htmlScaffold: this.generateHtmlScaffold(examples),
        cssClasses: this.extractCssClasses(examples),
        cssVarsUsed: this.extractCssVariables(examples),
        examples
      };
      
      this.components.push(component);
    }
  }

  private async parseJSStory(content: string, sourcePath: string): Promise<void> {
    // Extract component name from default export or file name
    const componentName = this.extractComponentNameFromJS(content, sourcePath);
    
    // Parse story exports to find examples
    const examples = this.extractJSExamples(content, sourcePath);
    
    if (componentName && examples.length > 0) {
      const component: MADEComponent = {
        name: componentName,
        description: this.extractJSDescription(content),
        tags: this.extractTags(content, sourcePath),
        variants: this.extractVariants(content, examples),
        props: this.extractJSProps(content),
        a11yNotes: this.extractAccessibilityNotes(content),
        htmlScaffold: this.generateHtmlScaffold(examples),
        cssClasses: this.extractCssClasses(examples),
        cssVarsUsed: this.extractCssVariables(examples),
        examples
      };
      
      this.components.push(component);
    }
  }

  private extractComponentName(content: string, sourcePath: string): string {
    // Try to extract from Meta title
    const metaTitleMatch = content.match(/title:\\s*['"]([^'"]+)['"]/);
    if (metaTitleMatch) {
      return metaTitleMatch[1].split('/').pop() || '';
    }
    
    // Fall back to file name
    return path.basename(sourcePath, path.extname(sourcePath))
      .replace(/\.(stories?|story)$/, '')
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  private extractComponentNameFromJS(content: string, sourcePath: string): string {
    // Try to extract from default export title
    const titleMatch = content.match(/title:\s*['"]([^'"]+)['"]/);
    if (titleMatch) {
      return titleMatch[1].split('/').pop() || '';
    }
    
    // Try to extract from component name in template
    const componentMatch = content.match(/component:\s*([A-Z]\w+)/);
    if (componentMatch) {
      return componentMatch[1];
    }
    
    // Fall back to file name
    return path.basename(sourcePath, path.extname(sourcePath))
      .replace(/\.(stories?|story)$/, '')
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, (l: string) => l.toUpperCase());
  }

  private extractMDXExamples(content: string, sourcePath: string): ComponentExample[] {
    const examples: ComponentExample[] = [];
    
    // Extract code blocks that contain HTML
    const codeBlockRegex = /```(?:html|jsx?|tsx?)\\n([\\s\\S]*?)\\n```/g;
    let match;
    let index = 0;
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const code = match[1].trim();
      if (this.looksLikeHTML(code) || this.looksLikeJSX(code)) {
        const html = this.convertToHTML(code);
        if (html) {
          examples.push({
            title: `Example ${index + 1}`,
            html,
            description: this.findNearbyDescription(content, match.index)
          });
          index++;
        }
      }
    }
    
    // Also look for Story templates
    const storyRegex = /<Story[^>]*>([\s\S]*?)<\/Story>/g;
    while ((match = storyRegex.exec(content)) !== null) {
      const storyContent = match[1].trim();
      if (storyContent) {
        const html = this.convertToHTML(storyContent);
        if (html) {
          examples.push({
            title: `Story Example ${examples.length + 1}`,
            html,
            description: 'From Storybook Story component'
          });
        }
      }
    }
    
    return examples;
  }

  private extractJSExamples(content: string, sourcePath: string): ComponentExample[] {
    const examples: ComponentExample[] = [];
    
    // Extract story functions and their templates - handle nested braces properly
    const storyRegex = /export const (\w+):\s*Story\s*=\s*\{([\s\S]*?)\n\};/g;
    let match;
    
    while ((match = storyRegex.exec(content)) !== null) {
      const storyName = match[1];
      const storyContent = match[2];
      
      // Look for render function with template literal (handle escaped backticks)
      const renderMatch = storyContent.match(/render:\s*\([^)]*\)\s*=>\s*\\?`([^`]+)\\?`/s);
      if (renderMatch) {
        const template = renderMatch[1].trim();
        const html = this.convertTemplateToHTML(template);
        
        if (html) {
          examples.push({
            title: this.humanizeStoryName(storyName),
            html,
            description: `${storyName} story variant`,
            props: this.extractStoryArgs(storyContent)
          });
        }
      }
    }
    
    return examples;
  }

  private looksLikeHTML(code: string): boolean {
    return /<[^>]+>/.test(code) && !code.includes('React.createElement');
  }

  private looksLikeJSX(code: string): boolean {
    return /<[A-Z][^>]*>/.test(code) || code.includes('className=');
  }

  private convertToHTML(code: string): string | null {
    try {
      // If it's already HTML, clean it up
      if (this.looksLikeHTML(code) && !this.looksLikeJSX(code)) {
        const $ = load(code);
        return $.html();
      }
      
      // Convert JSX-like syntax to HTML
      if (this.looksLikeJSX(code)) {
        return this.jsxToHTML(code);
      }
      
      return null;
    } catch {
      return null;
    }
  }

  private convertTemplateToHTML(template: string): string | null {
    try {
      // Remove template literal variable interpolations for now
      // Replace ${...} with placeholder text
      let html = template.replace(/\\\$\{[^}]+\}/g, (match) => {
        if (match.includes('children')) {
          return 'Button Text';
        }
        return match;
      });
      
      // Remove escaped backslashes and clean up
      html = html.replace(/\\\\/g, '').replace(/\\/g, '');
      
      // Clean up the HTML
      const $ = load(html);
      return $.html();
    } catch {
      return null;
    }
  }

  private jsxToHTML(jsx: string): string {
    // Basic JSX to HTML conversion
    let html = jsx;
    
    // Convert className to class
    html = html.replace(/className=/g, 'class=');
    
    // Convert self-closing tags
    html = html.replace(/<(\w+)([^>]*?)\s*\/>/g, '<$1$2></$1>');
    
    // Remove React-specific attributes
    html = html.replace(/\s+key=\{[^}]*\}/g, '');
    html = html.replace(/\s+ref=\{[^}]*\}/g, '');
    
    // Convert {expression} to actual values where possible
    html = html.replace(/\{([^}]+)\}/g, (match, expr) => {
      // Simple expression evaluation for strings and basic values
      if (expr.startsWith("'") || expr.startsWith('"')) {
        return expr.slice(1, -1);
      }
      return match;
    });
    
    try {
      const $ = load(html);
      return $.html();
    } catch {
      return html;
    }
  }

  private extractDescription(content: string): string {
    // Look for description in Meta or as comment
    const descMatch = content.match(/description:\\s*['"]([^'"]+)['"]/);
    if (descMatch) {
      return descMatch[1];
    }
    
    // Look for first paragraph or comment
    const paragraphMatch = content.match(/^([^\\n]+)/);
    return paragraphMatch ? paragraphMatch[1].trim() : '';
  }

  private extractJSDescription(content: string): string {
    // Try to extract from default export description
    const descMatch = content.match(/description:\s*['"]([^'"]+)['"]/);
    if (descMatch) {
      return descMatch[1];
    }
    
    // Try to extract from JSDoc comment
    const jsdocMatch = content.match(/\/\*\*\s*\n\s*\*\s*(.*?)\s*\n/s);
    if (jsdocMatch) {
      return jsdocMatch[1];
    }
    
    return 'A reusable component from the MADE design system';
  }

  private extractTags(content: string, sourcePath: string): string[] {
    const tags: string[] = [];
    
    // Extract from file path
    const pathParts = sourcePath.split('/');
    pathParts.forEach(part => {
      if (part !== 'stories' && part !== 'src' && !part.includes('.')) {
        tags.push(part.toLowerCase());
      }
    });
    
    // Extract from content categories or tags
    const tagsMatch = content.match(/tags:\s*\[([^\]]+)\]/);
    if (tagsMatch) {
      const contentTags = tagsMatch[1].split(',').map(tag => 
        tag.trim().replace(/['\"]/g, '').toLowerCase()
      );
      tags.push(...contentTags);
    }
    
    return [...new Set(tags)];
  }

  private extractVariants(content: string, examples: ComponentExample[]): Record<string, string[]> {
    const variants: Record<string, string[]> = {};
    
    // Extract from argTypes if available
    const argTypesMatch = content.match(/argTypes:\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/s);
    if (argTypesMatch) {
      const argTypesContent = argTypesMatch[1];
      
      // Look for control options
      const controlMatches = argTypesContent.matchAll(/(\w+):\s*\{[^}]*options:\s*\[([^\]]+)\]/g);
      for (const match of controlMatches) {
        const propName = match[1];
        const options = match[2].split(',').map(opt => opt.trim().replace(/['"]/g, ''));
        variants[propName] = options;
      }
    }
    
    // Extract from story args by analyzing all examples
    const argValues: Record<string, Set<string>> = {};
    
    examples.forEach(example => {
      // Extract args from story content by looking at the story definitions
      const storyMatch = content.match(new RegExp(`export const ${example.title}.*?args:\\s*\\{([^}]+)\\}`, 's'));
      if (storyMatch) {
        const argsContent = storyMatch[1];
        const argMatches = argsContent.matchAll(/(\w+):\s*['"]([^'"]*)['"]/g);
        
        for (const argMatch of argMatches) {
          const key = argMatch[1];
          const value = argMatch[2];
          
          if (!argValues[key]) {
            argValues[key] = new Set();
          }
          argValues[key].add(value);
        }
      }
    });
    
    // Convert sets to arrays
    Object.entries(argValues).forEach(([key, valueSet]) => {
      if (valueSet.size > 1) { // Only include if there are multiple variants
        variants[key] = Array.from(valueSet);
      }
    });
    
    return variants;
  }

  private extractProps(content: string): Record<string, any> {
    const props: Record<string, any> = {};
    
    // Extract from argTypes
    const argTypesMatch = content.match(/argTypes:\\s*\\{([\\s\\S]*?)\\}/);
    if (argTypesMatch) {
      // This would need more sophisticated parsing for complex argTypes
      // For now, we'll extract basic property definitions
    }
    
    return props;
  }

  private extractJSProps(content: string): Record<string, any> {
    return this.extractProps(content);
  }

  private extractStoryArgs(storyContent: string): Record<string, any> {
    const args: Record<string, any> = {};
    
    const argsMatch = storyContent.match(/args:\\s*\\{([\\s\\S]*?)\\}/);
    if (argsMatch) {
      const argsContent = argsMatch[1];
      
      // Basic parsing of args object
      const propRegex = /(\\w+):\\s*['\"']?([^,'\"\\}]+)['\"']?/g;
      let match;
      while ((match = propRegex.exec(argsContent)) !== null) {
        args[match[1]] = match[2];
      }
    }
    
    return args;
  }

  private extractAccessibilityNotes(content: string): string[] {
    const notes: string[] = [];
    
    // Look for accessibility-related comments or sections
    const a11yPatterns = [
      /\/\*\s*a11y:([^\*]+)\*\//gi,
      /\/\/\s*accessibility:([^\n]+)/gi,
      /\/\/\s*a11y:([^\n]+)/gi
    ];
    
    a11yPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        notes.push(match[1].trim());
      }
    });
    
    return notes;
  }

  private generateHtmlScaffold(examples: ComponentExample[]): string {
    if (examples.length === 0) return '';
    
    // Use the first example as the base scaffold
    const baseExample = examples[0];
    
    // Clean up the HTML to create a basic scaffold
    const $ = load(baseExample.html);
    
    // Remove specific content but keep structure
    $('*').each((_, el) => {
      const $el = $(el);
      
      // Keep structural elements but simplify content
      if ($el.is('button, a, input')) {
        // Keep interactive elements but simplify
        const text = $el.text().trim();
        if (text.length > 20) {
          $el.text('...');
        }
      }
      
      // Remove IDs that might be specific to the example
      if ($el.attr('id')?.includes('example') || $el.attr('id')?.includes('demo')) {
        $el.removeAttr('id');
      }
    });
    
    return $.html();
  }

  private extractCssClasses(examples: ComponentExample[]): string[] {
    const classes = new Set<string>();
    
    examples.forEach(example => {
      const $ = load(example.html);
      $('[class]').each((_, element) => {
        const classAttr = $(element).attr('class');
        if (classAttr) {
          // Split class attribute into individual classes
          classAttr.split(/\s+/).forEach(cls => {
            if (cls.trim()) {
              classes.add(cls.trim());
            }
          });
        }
      });
    });
    
    return Array.from(classes).sort();
  }

  private extractCssVariables(examples: ComponentExample[]): string[] {
    const variables: string[] = [];
    
    examples.forEach(example => {
      const $ = load(example.html);
      
      $('*').each((_, el) => {
        const styleAttr = $(el).attr('style');
        if (styleAttr) {
          const varMatches = styleAttr.match(/var\\(--[^)]+\\)/g);
          if (varMatches) {
            varMatches.forEach(varMatch => {
              const varName = varMatch.match(/var\\((--[^)]+)\\)/)?.[1];
              if (varName && varName.startsWith('--made-')) {
                variables.push(varName);
              }
            });
          }
        }
      });
      
      // Also check for CSS variables in classes that might be documented
      const cssVarPattern = /--made-[\\w-]+/g;
      const matches = example.html.match(cssVarPattern);
      if (matches) {
        variables.push(...matches);
      }
    });
    
    return [...new Set(variables)].sort();
  }

  private findNearbyDescription(content: string, index: number): string {
    // Look backwards from the match to find a description
    const before = content.substring(Math.max(0, index - 200), index);
    const lines = before.split('\\n').reverse();
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('```') && !trimmed.startsWith('#')) {
        return trimmed;
      }
    }
    
    return '';
  }

  private humanizeStoryName(storyName: string): string {
    return storyName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  getComponents(): MADEComponent[] {
    return [...this.components];
  }

  // Get component by name
  getComponent(name: string): MADEComponent | undefined {
    return this.components.find(comp => 
      comp.name.toLowerCase() === name.toLowerCase()
    );
  }

  // Search components by tags or name
  searchComponents(query: string): MADEComponent[] {
    const lowerQuery = query.toLowerCase();
    return this.components.filter(comp =>
      comp.name.toLowerCase().includes(lowerQuery) ||
      comp.description.toLowerCase().includes(lowerQuery) ||
      comp.tags.some(tag => tag.includes(lowerQuery))
    );
  }
}