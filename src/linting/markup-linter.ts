import { load } from 'cheerio';
import { MADEToken, LintIssue } from '../types.js';
import { logger } from '../utils/logger.js';

export class MarkupLinter {
  private tokens: MADEToken[] = [];
  private madeClasses: Set<string> = new Set();
  private initialized = false;

  async initialize(tokens: MADEToken[]): Promise<void> {
    this.tokens = tokens;
    
    // Build a set of known MADE classes for faster lookup
    this.buildMadeClassesSet();
    
    this.initialized = true;
    logger.info(`Markup linter initialized with ${this.tokens.length} tokens`);
  }

  private buildMadeClassesSet(): void {
    // Add common MADE class patterns
    const madePatterns = [
      'made-btn', 'made-button',
      'made-card', 'made-alert', 'made-modal',
      'made-input', 'made-form', 'made-textarea',
      'made-nav', 'made-navbar', 'made-menu',
      'made-grid', 'made-container', 'made-row', 'made-col',
      'made-text', 'made-heading', 'made-title',
      'made-badge', 'made-tag', 'made-chip',
      'made-icon', 'made-avatar', 'made-image'
    ];
    
    madePatterns.forEach(pattern => this.madeClasses.add(pattern));
    
    // Add utility classes
    const utilityPatterns = [
      // Spacing
      'p-0', 'p-1', 'p-2', 'p-3', 'p-4', 'p-5',
      'm-0', 'm-1', 'm-2', 'm-3', 'm-4', 'm-5',
      'pt-', 'pb-', 'pl-', 'pr-', 'px-', 'py-',
      'mt-', 'mb-', 'ml-', 'mr-', 'mx-', 'my-',
      
      // Colors
      'text-primary', 'text-secondary', 'text-success', 'text-warning', 'text-error',
      'bg-primary', 'bg-secondary', 'bg-light', 'bg-dark',
      
      // Typography
      'text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl',
      'font-normal', 'font-medium', 'font-semibold', 'font-bold',
      'text-left', 'text-center', 'text-right',
      
      // Layout
      'flex', 'grid', 'block', 'inline', 'hidden',
      'w-full', 'h-full', 'w-auto', 'h-auto',
      
      // Borders and radius
      'border', 'border-0', 'rounded', 'rounded-sm', 'rounded-lg'
    ];
    
    utilityPatterns.forEach(pattern => this.madeClasses.add(pattern));
  }

  async lint(html: string): Promise<LintIssue[]> {
    if (!this.initialized) {
      throw new Error('Markup linter not initialized');
    }

    const issues: LintIssue[] = [];
    
    try {
      const $ = load(html);
      
      // Check overall structure
      this.lintStructure($, issues);
      
      // Check each element
      $('*').each((index, element) => {
        this.lintElement($, $(element), issues, index);
      });
      
      // Check for MADE-specific patterns
      this.lintMADEPatterns($, issues);
      
      // Check accessibility
      this.lintAccessibility($, issues);
      
    } catch (error) {
      issues.push({
        type: 'error',
        message: `Failed to parse HTML: ${error instanceof Error ? error.message : 'Unknown error'}`,
        fixSuggestion: 'Check HTML syntax and ensure valid markup'
      });
    }
    
    return issues;
  }

  private lintStructure($: any, issues: LintIssue[]): void {
    const root = $.root();
    
    // Check for semantic HTML structure
    if (root.find('main, article, section, header, footer, nav, aside').length === 0) {
      issues.push({
        type: 'warning',
        message: 'Consider using semantic HTML elements (main, article, section, header, footer, nav, aside)',
        fixSuggestion: 'Wrap content in appropriate semantic elements for better accessibility'
      });
    }
  }

  private lintElement($: any, $element: any, issues: LintIssue[], index: number): void {
    const tagName = $element.prop('tagName')?.toLowerCase();
    const classes = $element.attr('class')?.split(/\\s+/) || [];
    
    // Check for MADE classes
    this.checkMADEClasses($element, classes, issues, index);
    
    // Check CSS variables usage
    this.checkCSSVariables($element, issues, index);
    
    // Check specific element patterns
    switch (tagName) {
      case 'button':
        this.lintButton($element, classes, issues, index);
        break;
      case 'input':
      case 'textarea':
      case 'select':
        this.lintFormElement($element, classes, issues, index);
        break;
      case 'a':
        this.lintLink($element, issues, index);
        break;
      case 'img':
        this.lintImage($element, issues, index);
        break;
    }
  }

  private checkMADEClasses($element: any, classes: string[], issues: LintIssue[], index: number): void {
    const madeClassesFound = classes.filter(cls => 
      cls.startsWith('made-') || this.madeClasses.has(cls) || this.isUtilityClass(cls)
    );
    
    if (classes.length > 0 && madeClassesFound.length === 0) {
      const tagName = $element.prop('tagName')?.toLowerCase();
      
      // Only warn for components that should use MADE classes
      if (['button', 'input', 'textarea', 'select', 'nav', 'card', 'modal'].includes(tagName)) {
        issues.push({
          type: 'warning',
          message: `Element <${tagName}> doesn't use MADE classes`,
          fixSuggestion: `Consider adding appropriate MADE classes like 'made-${tagName}' or utility classes`,
          line: index + 1
        });
      }
    }
    
    // Check for deprecated or unknown classes
    classes.forEach(cls => {
      if (cls.startsWith('made-') && !this.madeClasses.has(cls) && !this.isUtilityClass(cls)) {
        issues.push({
          type: 'info',
          message: `Unknown MADE class: ${cls}`,
          fixSuggestion: 'Verify this class exists in the current MADE design system version',
          line: index + 1
        });
      }
    });
  }

  private checkCSSVariables($element: any, issues: LintIssue[], index: number): void {
    const style = $element.attr('style');
    if (!style) return;
    
    // Find CSS variables in inline styles
    const varMatches = style.match(/var\(--[^)]+\)/g);
    if (varMatches) {
      varMatches.forEach((varMatch: string) => {
        const varName = varMatch.match(/var\((--[^)]+)\)/)?.[1];
        if (varName && !varName.startsWith('--made-')) {
          issues.push({
            type: 'warning',
            message: `Non-MADE CSS variable used: ${varName}`,
            fixSuggestion: 'Consider using MADE design tokens (--made-*) for consistency',
            line: index + 1
          });
        } else if (varName) {
          // Check if the MADE variable exists
          const tokenExists = this.tokens.some(token => token.name === varName);
          if (!tokenExists) {
            issues.push({
              type: 'error',
              message: `Unknown MADE token: ${varName}`,
              fixSuggestion: 'Check available MADE design tokens or update to a valid token',
              line: index + 1
            });
          }
        }
      });
    }
  }

  private lintButton($element: any, classes: string[], issues: LintIssue[], index: number): void {
    // Check for button variants
    const hasButtonClass = classes.some(cls => cls.includes('btn') || cls.includes('button'));
    if (!hasButtonClass) {
      issues.push({
        type: 'warning',
        message: 'Button element should use MADE button classes',
        fixSuggestion: "Add classes like 'made-btn', 'made-btn-primary', etc.",
        line: index + 1
      });
    }
    
    // Check for accessibility
    const type = $element.attr('type');
    if (!type && !$element.attr('aria-label') && !$element.text().trim()) {
      issues.push({
        type: 'error',
        message: 'Button needs accessible text content or aria-label',
        fixSuggestion: 'Add text content or aria-label attribute',
        line: index + 1
      });
    }
  }

  private lintFormElement($element: any, classes: string[], issues: LintIssue[], index: number): void {
    const tagName = $element.prop('tagName')?.toLowerCase();
    
    // Check for MADE form classes
    const hasFormClass = classes.some(cls => 
      cls.includes('form') || cls.includes('input') || cls.includes('field')
    );
    
    if (!hasFormClass) {
      issues.push({
        type: 'info',
        message: `Form element <${tagName}> could use MADE form classes`,
        fixSuggestion: `Consider adding 'made-form-control', 'made-input', etc.`,
        line: index + 1
      });
    }
    
    // Check for labels
    const id = $element.attr('id');
    const hasLabel = id && $element.closest('form, body').find(`label[for="${id}"]`).length > 0;
    const hasAriaLabel = $element.attr('aria-label') || $element.attr('aria-labelledby');
    
    if (!hasLabel && !hasAriaLabel) {
      issues.push({
        type: 'error',
        message: `Form element <${tagName}> needs a label for accessibility`,
        fixSuggestion: 'Add a <label> element or aria-label/aria-labelledby attribute',
        line: index + 1
      });
    }
  }

  private lintLink($element: any, issues: LintIssue[], index: number): void {
    const href = $element.attr('href');
    const text = $element.text().trim();
    
    if (!href) {
      issues.push({
        type: 'warning',
        message: 'Link element should have href attribute',
        fixSuggestion: 'Add href attribute or use button element for actions',
        line: index + 1
      });
    }
    
    if (!text && !$element.attr('aria-label')) {
      issues.push({
        type: 'error',
        message: 'Link needs accessible text content or aria-label',
        fixSuggestion: 'Add text content or aria-label attribute',
        line: index + 1
      });
    }
    
    // Check for generic link text
    const genericTexts = ['click here', 'read more', 'learn more', 'here'];
    if (genericTexts.includes(text.toLowerCase())) {
      issues.push({
        type: 'warning',
        message: 'Link text is not descriptive enough',
        fixSuggestion: 'Use more descriptive link text that explains the destination',
        line: index + 1
      });
    }
  }

  private lintImage($element: any, issues: LintIssue[], index: number): void {
    const alt = $element.attr('alt');
    const src = $element.attr('src');
    
    if (!src) {
      issues.push({
        type: 'error',
        message: 'Image element must have src attribute',
        line: index + 1
      });
    }
    
    if (alt === undefined) {
      issues.push({
        type: 'error',
        message: 'Image element must have alt attribute for accessibility',
        fixSuggestion: 'Add alt attribute with descriptive text or empty alt="" for decorative images',
        line: index + 1
      });
    }
  }

  private lintMADEPatterns($: any, issues: LintIssue[]): void {
    // Check for component patterns that should use MADE
    
    // Cards
    $('.card, .panel, .box').each((index: number, element: any) => {
      const $element = $(element);
      const classes = $element.attr('class')?.split(/\s+/) || [];
      
      if (!classes.some((cls: string) => cls.startsWith('made-'))) {
        issues.push({
          type: 'info',
          message: 'Card-like component could use MADE card classes',
          fixSuggestion: "Consider using 'made-card' and related classes",
          line: index + 1
        });
      }
    });
    
    // Modals/dialogs
    $('.modal, .dialog, .overlay').each((index: number, element: any) => {
      const $element = $(element);
      
      if (!$element.attr('role') && !$element.attr('aria-modal')) {
        issues.push({
          type: 'error',
          message: 'Modal/dialog should have proper ARIA attributes',
          fixSuggestion: 'Add role="dialog" and aria-modal="true"',
          line: index + 1
        });
      }
    });
  }

  private lintAccessibility($: any, issues: LintIssue[]): void {
    // Check for missing alt text on images
    $('img:not([alt])').each((index: number, element: any) => {
      issues.push({
        type: 'error',
        message: 'Image missing alt attribute',
        fixSuggestion: 'Add alt attribute for accessibility',
        line: index + 1
      });
    });
    
    // Check for proper heading hierarchy
    const headings = $('h1, h2, h3, h4, h5, h6').toArray();
    let lastLevel = 0;
    
    headings.forEach((heading: any, index: number) => {
      const level = parseInt(heading.tagName.substring(1));
      
      if (level > lastLevel + 1) {
        issues.push({
          type: 'warning',
          message: `Heading level ${level} skips levels (previous was h${lastLevel})`,
          fixSuggestion: 'Use sequential heading levels for proper document structure',
          line: index + 1
        });
      }
      
      lastLevel = level;
    });
    
    // Check for interactive elements without focus indicators
    $('button, a, input, select, textarea').each((index: number, element: any) => {
      const $element = $(element);
      const style = $element.attr('style') || '';
      
      if (style.includes('outline: none') && !style.includes('focus')) {
        issues.push({
          type: 'warning',
          message: 'Interactive element removes focus outline without alternative',
          fixSuggestion: 'Provide alternative focus indicator when removing outline',
          line: index + 1
        });
      }
    });
  }

  private isUtilityClass(className: string): boolean {
    // Check for utility class patterns
    const utilityPatterns = [
      /^[mp][tlbr]?-\\d+$/,        // margin/padding
      /^text-(left|center|right|justify)$/,
      /^text-(xs|sm|base|lg|xl|\\d+xl)$/,
      /^bg-\\w+$/,                 // backgrounds
      /^text-\\w+$/,               // text colors
      /^border(-\\w+)?$/,          // borders
      /^rounded(-\\w+)?$/,         // border radius
      /^w-\\w+$/,                  // widths
      /^h-\\w+$/,                  // heights
      /^flex(-\\w+)?$/,            // flex utilities
      /^grid(-\\w+)?$/,            // grid utilities
      /^font-\\w+$/,               // font weights/styles
      /^shadow(-\\w+)?$/           // shadows
    ];
    
    return utilityPatterns.some(pattern => pattern.test(className)) ||
           this.madeClasses.has(className);
  }

  // Get suggestions for common component patterns
  getSuggestions(html: string): string[] {
    const suggestions: string[] = [];
    
    try {
      const $ = load(html);
      
      // Suggest MADE components based on structure
      if ($('button').length > 0) {
        suggestions.push('Consider using MADE button variants: made-btn-primary, made-btn-secondary');
      }
      
      if ($('.card, .panel').length > 0) {
        suggestions.push('Use MADE card component: made-card, made-card-header, made-card-body');
      }
      
      if ($('form, input, textarea').length > 0) {
        suggestions.push('Apply MADE form styling: made-form-control, made-form-group');
      }
      
      if ($('nav, .navigation').length > 0) {
        suggestions.push('Consider MADE navigation components: made-nav, made-navbar');
      }
      
    } catch {
      // Ignore parsing errors for suggestions
    }
    
    return suggestions;
  }
}