import fs from 'fs-extra';
import * as path from 'path';
import { MADEComponent, MADEToken, SearchResult } from '../types.js';
import { logger } from '../utils/logger.js';

export class SearchEngine {
  private components: MADEComponent[] = [];
  private tokens: MADEToken[] = [];
  private searchIndex: SearchIndex | null = null;
  private initialized = false;

  async initialize(components: MADEComponent[], tokens: MADEToken[]): Promise<void> {
    this.components = components;
    this.tokens = tokens;
    
    // Load or build search index
    await this.loadSearchIndex();
    
    this.initialized = true;
    logger.info(`Search engine initialized with ${components.length} components and ${tokens.length} tokens`);
  }

  async search(query: string): Promise<SearchResult[]> {
    if (!this.initialized) {
      throw new Error('Search engine not initialized');
    }

    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();
    const terms = this.extractSearchTerms(lowerQuery);

    // Search components
    const componentResults = this.searchComponents(terms, lowerQuery);
    results.push(...componentResults);

    // Search examples within components
    const exampleResults = this.searchExamples(terms, lowerQuery);
    results.push(...exampleResults);

    // Sort results by relevance
    results.sort((a, b) => this.calculateRelevance(b, terms) - this.calculateRelevance(a, terms));

    // Limit results to prevent overwhelming responses
    return results.slice(0, 50);
  }

  private extractSearchTerms(query: string): string[] {
    // Extract meaningful terms from the query
    const terms = query
      .toLowerCase()
      .replace(/[^a-z0-9\\s-]/g, ' ')
      .split(/\\s+/)
      .filter(term => term.length > 2)
      .filter(term => !this.isStopWord(term));

    return [...new Set(terms)];
  }

  private isStopWord(word: string): boolean {
    const stopWords = [
      'the', 'and', 'or', 'but', 'for', 'with', 'a', 'an', 'as', 'at', 'by', 'in', 'of', 'on', 'to',
      'create', 'make', 'build', 'generate', 'show', 'display', 'use', 'using', 'want', 'need',
      'component', 'element', 'html', 'css', 'class', 'style', 'design', 'system'
    ];
    return stopWords.includes(word);
  }

  private searchComponents(terms: string[], query: string): SearchResult[] {
    const results: SearchResult[] = [];

    this.components.forEach(component => {
      const matches = this.findMatches(component, terms, query);
      
      if (matches.length > 0) {
        // Use the first example or scaffold as the primary result
        const primaryExample = component.examples[0] || {
          title: 'Component Scaffold',
          html: component.htmlScaffold,
          description: component.description
        };

        results.push({
          component: component.name,
          title: `${component.name} Component`,
          html: primaryExample.html,
          sourcePath: `components/${component.name.toLowerCase()}`,
          upstreamRef: 'main'
        });
      }
    });

    return results;
  }

  private searchExamples(terms: string[], query: string): SearchResult[] {
    const results: SearchResult[] = [];

    this.components.forEach(component => {
      component.examples.forEach(example => {
        const exampleMatches = this.findExampleMatches(example, component, terms, query);
        
        if (exampleMatches.length > 0) {
          results.push({
            component: component.name,
            title: `${component.name}: ${example.title}`,
            html: example.html,
            sourcePath: `components/${component.name.toLowerCase()}/examples`,
            upstreamRef: 'main'
          });
        }
      });
    });

    return results;
  }

  private findMatches(component: MADEComponent, terms: string[], query: string): string[] {
    const matches: string[] = [];
    const searchableText = [
      component.name,
      component.description,
      ...component.tags,
      ...component.cssClasses,
      ...Object.keys(component.variants),
      ...Object.values(component.variants).flat(),
      ...(component.a11yNotes || [])
    ].join(' ').toLowerCase();

    // Exact query match
    if (searchableText.includes(query)) {
      matches.push('exact_match');
    }

    // Term matches
    terms.forEach(term => {
      if (searchableText.includes(term)) {
        matches.push(term);
      }
    });

    // Fuzzy matching for component names
    if (this.fuzzyMatch(component.name.toLowerCase(), query)) {
      matches.push('fuzzy_name');
    }

    // UI pattern matching
    const uiPatterns = this.detectUIPatterns(query);
    uiPatterns.forEach(pattern => {
      if (this.componentMatchesPattern(component, pattern)) {
        matches.push(`pattern_${pattern}`);
      }
    });

    return matches;
  }

  private findExampleMatches(
    example: any, 
    component: MADEComponent, 
    terms: string[], 
    query: string
  ): string[] {
    const matches: string[] = [];
    const searchableText = [
      example.title,
      example.description || '',
      example.html
    ].join(' ').toLowerCase();

    // Exact query match
    if (searchableText.includes(query)) {
      matches.push('exact_match');
    }

    // Term matches
    terms.forEach(term => {
      if (searchableText.includes(term)) {
        matches.push(term);
      }
    });

    // HTML structure matching
    if (this.htmlContainsPattern(example.html, query)) {
      matches.push('html_pattern');
    }

    return matches;
  }

  private detectUIPatterns(query: string): string[] {
    const patterns: string[] = [];

    // Common UI patterns
    const uiPatternMap = {
      'button': ['button', 'btn', 'click', 'action', 'submit'],
      'card': ['card', 'panel', 'container', 'box'],
      'modal': ['modal', 'dialog', 'popup', 'overlay'],
      'form': ['form', 'input', 'field', 'text', 'submit'],
      'navigation': ['nav', 'menu', 'navbar', 'link'],
      'alert': ['alert', 'notification', 'message', 'toast'],
      'grid': ['grid', 'layout', 'columns', 'rows'],
      'table': ['table', 'data', 'rows', 'columns'],
      'tabs': ['tabs', 'tab', 'switch', 'toggle'],
      'accordion': ['accordion', 'collapse', 'expand', 'fold'],
      'dropdown': ['dropdown', 'select', 'menu', 'options'],
      'tooltip': ['tooltip', 'popover', 'hover', 'hint'],
      'badge': ['badge', 'label', 'tag', 'chip'],
      'avatar': ['avatar', 'profile', 'user', 'image'],
      'breadcrumb': ['breadcrumb', 'path', 'navigation'],
      'pagination': ['pagination', 'pager', 'pages', 'next', 'previous'],
      'progress': ['progress', 'bar', 'loading', 'status'],
      'spinner': ['spinner', 'loading', 'wait', 'busy'],
      'carousel': ['carousel', 'slider', 'gallery', 'slideshow'],
      'chart': ['chart', 'graph', 'data', 'visualization']
    };

    Object.entries(uiPatternMap).forEach(([pattern, keywords]) => {
      if (keywords.some(keyword => query.includes(keyword))) {
        patterns.push(pattern);
      }
    });

    // Action patterns
    if (query.includes('dark') || query.includes('theme')) {
      patterns.push('themeable');
    }
    if (query.includes('responsive') || query.includes('mobile')) {
      patterns.push('responsive');
    }
    if (query.includes('icon') || query.includes('symbol')) {
      patterns.push('icon');
    }

    return patterns;
  }

  private componentMatchesPattern(component: MADEComponent, pattern: string): boolean {
    const componentName = component.name.toLowerCase();
    const componentTags = component.tags.join(' ').toLowerCase();
    const componentClasses = component.cssClasses.join(' ').toLowerCase();

    switch (pattern) {
      case 'button':
        return componentName.includes('button') || 
               componentName.includes('btn') ||
               componentClasses.includes('btn');
      
      case 'card':
        return componentName.includes('card') || 
               componentTags.includes('card') ||
               componentClasses.includes('card');
      
      case 'modal':
        return componentName.includes('modal') || 
               componentName.includes('dialog') ||
               componentTags.includes('overlay');
      
      case 'form':
        return componentName.includes('form') || 
               componentName.includes('input') ||
               componentTags.includes('form');
      
      case 'navigation':
        return componentName.includes('nav') || 
               componentName.includes('menu') ||
               componentTags.includes('navigation');
      
      case 'alert':
        return componentName.includes('alert') || 
               componentName.includes('notification') ||
               componentTags.includes('feedback');
      
      case 'themeable':
        return !!component.variants.theme || 
               !!component.variants.color ||
               componentClasses.includes('dark') || componentClasses.includes('light');
      
      case 'responsive':
        return componentClasses.includes('responsive') ||
               componentClasses.includes('sm') ||
               componentClasses.includes('md') ||
               componentClasses.includes('lg');
      
      case 'icon':
        return componentName.includes('icon') ||
               componentClasses.includes('icon');
      
      default:
        return componentName.includes(pattern) || componentTags.includes(pattern);
    }
  }

  private htmlContainsPattern(html: string, query: string): boolean {
    const lowerHtml = html.toLowerCase();
    
    // Check for specific HTML patterns
    if (query.includes('button') && lowerHtml.includes('<button')) return true;
    if (query.includes('form') && (lowerHtml.includes('<form') || lowerHtml.includes('<input'))) return true;
    if (query.includes('link') && lowerHtml.includes('<a ')) return true;
    if (query.includes('image') && lowerHtml.includes('<img')) return true;
    if (query.includes('list') && (lowerHtml.includes('<ul') || lowerHtml.includes('<ol'))) return true;
    if (query.includes('table') && lowerHtml.includes('<table')) return true;
    
    return false;
  }

  private fuzzyMatch(text: string, query: string): boolean {
    if (query.length < 3) return false;
    
    const threshold = 0.7;
    const similarity = this.calculateSimilarity(text, query);
    return similarity >= threshold;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + cost // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private calculateRelevance(result: SearchResult, terms: string[]): number {
    let score = 0;
    const lowerTitle = result.title.toLowerCase();
    const lowerHtml = result.html.toLowerCase();

    // Exact component name match gets highest score
    if (terms.some(term => lowerTitle.includes(term) && lowerTitle.indexOf(term) === 0)) {
      score += 10;
    }

    // Title contains terms
    terms.forEach(term => {
      if (lowerTitle.includes(term)) {
        score += 5;
      }
    });

    // HTML contains terms
    terms.forEach(term => {
      if (lowerHtml.includes(term)) {
        score += 2;
      }
    });

    // Boost for component scaffolds vs examples
    if (result.title.includes('Component') && !result.title.includes(':')) {
      score += 3;
    }

    // Boost for exact pattern matches
    if (result.html.length > 0 && result.html.length < 1000) {
      score += 1; // Prefer concise examples
    }

    return score;
  }

  private async loadSearchIndex(): Promise<void> {
    const indexPath = path.join('./data/cache', 'search-index.json');
    
    try {
      if (await fs.pathExists(indexPath)) {
        this.searchIndex = await fs.readJson(indexPath);
        logger.debug('Loaded search index from cache');
      }
    } catch (error) {
      logger.warn('Could not load search index cache:', error);
    }
  }

  // Advanced search features
  async searchByTags(tags: string[]): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    
    this.components.forEach(component => {
      const matchingTags = component.tags.filter(tag => 
        tags.some(searchTag => tag.toLowerCase().includes(searchTag.toLowerCase()))
      );
      
      if (matchingTags.length > 0) {
        const primaryExample = component.examples[0] || {
          title: 'Component Scaffold',
          html: component.htmlScaffold,
          description: component.description
        };

        results.push({
          component: component.name,
          title: `${component.name} Component (${matchingTags.join(', ')})`,
          html: primaryExample.html,
          sourcePath: `components/${component.name.toLowerCase()}`,
          upstreamRef: 'main'
        });
      }
    });
    
    return results;
  }

  async searchByVariant(variantName: string, variantValue?: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    
    this.components.forEach(component => {
      if (component.variants[variantName]) {
        const matchingVariants = variantValue 
          ? component.variants[variantName].filter(v => v.includes(variantValue))
          : component.variants[variantName];
        
        if (matchingVariants.length > 0) {
          matchingVariants.forEach(variant => {
            // Find example that uses this variant
            const example = component.examples.find(ex => 
              ex.props && ex.props[variantName] === variant
            ) || component.examples[0] || {
              title: 'Component Scaffold',
              html: component.htmlScaffold,
              description: component.description
            };

            results.push({
              component: component.name,
              title: `${component.name} - ${variantName}: ${variant}`,
              html: example.html,
              sourcePath: `components/${component.name.toLowerCase()}/variants`,
              upstreamRef: 'main'
            });
          });
        }
      }
    });
    
    return results;
  }

  async searchSimilarComponents(componentName: string): Promise<SearchResult[]> {
    const targetComponent = this.components.find(comp => 
      comp.name.toLowerCase() === componentName.toLowerCase()
    );
    
    if (!targetComponent) {
      return [];
    }
    
    const results: SearchResult[] = [];
    
    this.components.forEach(component => {
      if (component.name === targetComponent.name) return;
      
      const similarity = this.calculateComponentSimilarity(targetComponent, component);
      
      if (similarity > 0.3) {
        const primaryExample = component.examples[0] || {
          title: 'Component Scaffold',
          html: component.htmlScaffold,
          description: component.description
        };

        results.push({
          component: component.name,
          title: `${component.name} Component (similar to ${targetComponent.name})`,
          html: primaryExample.html,
          sourcePath: `components/${component.name.toLowerCase()}`,
          upstreamRef: 'main'
        });
      }
    });
    
    return results.sort((a, b) => 
      this.calculateComponentSimilarity(targetComponent, 
        this.components.find(c => c.name === b.component)!
      ) - this.calculateComponentSimilarity(targetComponent, 
        this.components.find(c => c.name === a.component)!
      )
    );
  }

  private calculateComponentSimilarity(comp1: MADEComponent, comp2: MADEComponent): number {
    let score = 0;
    
    // Tag similarity
    const commonTags = comp1.tags.filter(tag => comp2.tags.includes(tag));
    score += commonTags.length / Math.max(comp1.tags.length, comp2.tags.length, 1) * 0.4;
    
    // Class similarity
    const commonClasses = comp1.cssClasses.filter(cls => comp2.cssClasses.includes(cls));
    score += commonClasses.length / Math.max(comp1.cssClasses.length, comp2.cssClasses.length, 1) * 0.3;
    
    // Variant similarity
    const commonVariants = Object.keys(comp1.variants).filter(variant => 
      Object.keys(comp2.variants).includes(variant)
    );
    const totalVariants = new Set([...Object.keys(comp1.variants), ...Object.keys(comp2.variants)]).size;
    score += commonVariants.length / Math.max(totalVariants, 1) * 0.3;
    
    return score;
  }
}

interface SearchIndex {
  components: Array<{
    name: string;
    description: string;
    tags: string[];
    examples: Array<{
      title: string;
      description: string;
    }>;
  }>;
  tokens: Array<{
    name: string;
    category: string;
    description: string;
  }>;
}