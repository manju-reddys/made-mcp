import { load } from 'cheerio';
import { MADEComponent, ScaffoldComponentResponse } from '../types.js';
import { logger } from '../utils/logger.js';

export class ComponentScaffolder {
  private components: MADEComponent[] = [];
  private initialized = false;

  async initialize(components: MADEComponent[]): Promise<void> {
    this.components = components;
    this.initialized = true;
    logger.info(`Component scaffolder initialized with ${components.length} components`);
  }

  async scaffold(component: MADEComponent, props?: Record<string, any>): Promise<ScaffoldComponentResponse> {
    if (!this.initialized) {
      throw new Error('Component scaffolder not initialized');
    }

    const notes: string[] = [];
    let html = component.htmlScaffold;

    try {
      // Apply props to the base scaffold
      html = this.applyProps(html, props || {}, component, notes);
      
      // Ensure proper ARIA attributes
      html = this.addAccessibilityFeatures(html, component, notes);
      
      // Optimize class usage
      html = this.optimizeClasses(html, component, notes);
      
      // Add development hints
      this.addDevelopmentHints(component, props, notes);
      
      return {
        html,
        notes,
        dependencies: this.getDependencies(component)
      };
      
    } catch (error) {
      logger.error('Error scaffolding component:', error);
      throw new Error(`Failed to scaffold component: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private applyProps(
    html: string, 
    props: Record<string, any>, 
    component: MADEComponent, 
    notes: string[]
  ): string {
    const $ = load(html);
    
    // Find the actual component element (first element with a made- class)
    let targetElement = $('[class*="made-"]').first();
    if (targetElement.length === 0) {
      // Fallback to first element in body
      targetElement = $('body').children().first();
    }
    
    // Apply variant classes and props
    Object.entries(props).forEach(([propName, propValue]) => {
      if (component.variants[propName]?.includes(propValue)) {
        this.applyVariant($, targetElement, component, propName, propValue, notes);
      } else if (propName in component.props || ['text', 'children', 'id', 'className', 'class', 'href', 'type', 'disabled', 'placeholder', 'value'].includes(propName)) {
        this.applyProp($, targetElement, propName, propValue, notes);
      } else {
        notes.push(`Warning: Unknown prop '${propName}' for component ${component.name}`);
      }
    });
    
    return $.html();
  }

  private applyVariant(
    $: any, 
    $element: any, 
    component: MADEComponent, 
    variantName: string, 
    variantValue: string, 
    notes: string[]
  ): void {
    const variantClass = this.getVariantClass(component.name, variantName, variantValue);
    
    if (variantClass) {
      // Remove any existing variant classes for this variant type
      const existingClasses = $element.attr('class')?.split(/\s+/) || [];
      const cleanedClasses = existingClasses.filter((cls: string) => 
        !this.isVariantClass(cls, component.name, variantName)
      );
      
      // Add new variant class
      cleanedClasses.push(variantClass);
      $element.attr('class', cleanedClasses.join(' '));
      
      notes.push(`Applied ${variantName} variant: ${variantValue}`);
    }
  }

  private applyProp(
    $: any, 
    $element: any, 
    propName: string, 
    propValue: any, 
    notes: string[]
  ): void {
    switch (propName) {
      case 'id':
        $element.attr('id', propValue);
        break;
      case 'className':
      case 'class':
        const existingClasses = $element.attr('class') || '';
        $element.attr('class', `${existingClasses} ${propValue}`.trim());
        break;
      case 'text':
      case 'children':
        if (typeof propValue === 'string') {
          $element.text(propValue);
        }
        break;
      case 'href':
        if ($element.is('a')) {
          $element.attr('href', propValue);
        }
        break;
      case 'type':
        if ($element.is('button, input')) {
          $element.attr('type', propValue);
        }
        break;
      case 'disabled':
        if (propValue && $element.is('button, input, select, textarea')) {
          $element.attr('disabled', true);
          $element.addClass('disabled');
        }
        break;
      case 'placeholder':
        if ($element.is('input, textarea')) {
          $element.attr('placeholder', propValue);
        }
        break;
      case 'value':
        if ($element.is('input, textarea, select')) {
          $element.attr('value', propValue);
        }
        break;
      case 'ariaLabel':
        $element.attr('aria-label', propValue);
        break;
      case 'role':
        $element.attr('role', propValue);
        break;
      default:
        // For unknown props, try to set as data attribute
        if (typeof propValue === 'string' || typeof propValue === 'number') {
          $element.attr(`data-${propName.toLowerCase()}`, propValue);
          notes.push(`Set custom attribute: data-${propName.toLowerCase()}`);
        }
        break;
    }
  }

  private addAccessibilityFeatures(
    html: string, 
    component: MADEComponent, 
    notes: string[]
  ): string {
    const $ = load(html);
    
    // Add ARIA attributes based on component type and accessibility notes
    $('*').each((index, element) => {
      const $element = $(element);
      const tagName = $element.prop('tagName')?.toLowerCase();
      
      this.addElementAccessibility($element, tagName || '', component, notes);
    });
    
    return $.html();
  }

  private addElementAccessibility(
    $element: any, 
    tagName: string, 
    component: MADEComponent, 
    notes: string[]
  ): void {
    switch (tagName) {
      case 'button':
        if (!$element.attr('type')) {
          $element.attr('type', 'button');
        }
        if (!$element.attr('aria-label') && !$element.text().trim()) {
          $element.attr('aria-label', `${component.name} button`);
          notes.push('Added default aria-label to button - customize as needed');
        }
        break;
        
      case 'input':
        const inputType = $element.attr('type');
        if (!inputType) {
          $element.attr('type', 'text');
        }
        if (!$element.attr('id')) {
          const id = `${component.name.toLowerCase()}-${Math.random().toString(36).substr(2, 9)}`;
          $element.attr('id', id);
          notes.push(`Added ID for accessibility - associate with label: ${id}`);
        }
        break;
        
      case 'img':
        if (!$element.attr('alt')) {
          $element.attr('alt', '');
          notes.push('Added empty alt attribute - update with descriptive text if not decorative');
        }
        break;
        
      case 'a':
        if (!$element.attr('href')) {
          notes.push('Link element needs href attribute');
        }
        break;
    }
    
    // Apply component-specific accessibility notes
    if (component.a11yNotes) {
      component.a11yNotes.forEach(note => {
        if (note.includes('role=')) {
          const roleMatch = note.match(/role=[\"']([^\"']+)[\"']/);
          if (roleMatch && !$element.attr('role')) {
            $element.attr('role', roleMatch[1]);
            notes.push(`Applied recommended role: ${roleMatch[1]}`);
          }
        }
        
        if (note.includes('aria-')) {
          const ariaMatch = note.match(/(aria-[\\w-]+)=[\"']([^\"']+)[\"']/);
          if (ariaMatch && !$element.attr(ariaMatch[1])) {
            $element.attr(ariaMatch[1], ariaMatch[2]);
            notes.push(`Applied recommended ARIA: ${ariaMatch[1]}`);
          }
        }
      });
    }
  }

  private optimizeClasses(
    html: string, 
    component: MADEComponent, 
    notes: string[]
  ): string {
    const $ = load(html);
    
    $('*').each((index, element) => {
      const $element = $(element);
      const classes = $element.attr('class')?.split(/\\s+/) || [];
      
      // Remove duplicates and sort
      const optimizedClasses = [...new Set(classes)].filter(cls => cls.trim());
      
      // Ensure essential component classes are present
      const essentialClasses = this.getEssentialClasses(component, $element);
      essentialClasses.forEach(essentialClass => {
        if (!optimizedClasses.includes(essentialClass)) {
          optimizedClasses.unshift(essentialClass);
          notes.push(`Added essential class: ${essentialClass}`);
        }
      });
      
      if (optimizedClasses.length > 0) {
        $element.attr('class', optimizedClasses.join(' '));
      }
    });
    
    return $.html();
  }

  private getEssentialClasses(component: MADEComponent, $element: any): string[] {
    const essential: string[] = [];
    const tagName = $element.prop('tagName')?.toLowerCase();
    
    // Add base component class
    const baseClass = `made-${component.name.toLowerCase()}`;
    essential.push(baseClass);
    
    // Add element-specific essential classes
    switch (tagName) {
      case 'button':
        if (!$element.attr('class')?.includes('made-btn')) {
          essential.push('made-btn');
        }
        break;
      case 'input':
      case 'textarea':
      case 'select':
        essential.push('made-form-control');
        break;
      case 'nav':
        essential.push('made-nav');
        break;
    }
    
    return essential.filter(cls => component.cssClasses.includes(cls));
  }

  private getVariantClass(
    componentName: string, 
    variantName: string, 
    variantValue: string
  ): string | null {
    // Use known MADE class prefixes for common components
    let baseClass: string;
    switch (componentName.toLowerCase()) {
      case 'button':
        baseClass = 'made-btn';
        break;
      case 'card':
        baseClass = 'made-card';
        break;
      case 'alert':
        baseClass = 'made-alert';
        break;
      default:
        baseClass = `made-${componentName.toLowerCase()}`;
    }
    
    switch (variantName) {
      case 'variant':
      case 'color':
        return `${baseClass}-${variantValue}`;
      case 'size':
        return `${baseClass}-${variantValue}`;
      case 'state':
        return `${baseClass}--${variantValue}`;
      default:
        return `${baseClass}-${variantName}-${variantValue}`;
    }
  }

  private isVariantClass(
    className: string, 
    componentName: string, 
    variantName: string
  ): boolean {
    const baseClass = `made-${componentName.toLowerCase()}`;
    
    switch (variantName) {
      case 'variant':
      case 'color':
        return className.startsWith(`${baseClass}-`) && 
               !className.includes('-size-') && 
               !className.includes('--');
      case 'size':
        return className.includes(`${baseClass}-`) && 
               (className.includes('-sm') || className.includes('-lg') || className.includes('-xl'));
      case 'state':
        return className.startsWith(`${baseClass}--`);
      default:
        return className.startsWith(`${baseClass}-${variantName}-`);
    }
  }

  private addDevelopmentHints(
    component: MADEComponent, 
    props?: Record<string, any>, 
    notes?: string[]
  ): void {
    if (!notes) return;
    
    // Add usage hints
    notes.push(`Component: ${component.name}`);
    
    if (component.variants && Object.keys(component.variants).length > 0) {
      notes.push('Available variants:');
      Object.entries(component.variants).forEach(([variantName, options]) => {
        notes.push(`  ${variantName}: ${options.join(', ')}`);
      });
    }
    
    if (component.cssVarsUsed.length > 0) {
      notes.push('CSS variables used:');
      component.cssVarsUsed.forEach(cssVar => {
        notes.push(`  ${cssVar}`);
      });
    }
    
    if (component.a11yNotes && component.a11yNotes.length > 0) {
      notes.push('Accessibility considerations:');
      component.a11yNotes.forEach(note => {
        notes.push(`  ${note}`);
      });
    }
    
    // Add customization hints
    if (!props || Object.keys(props).length === 0) {
      notes.push('💡 Tip: You can customize this component by passing props like:');
      if (component.variants.variant) {
        notes.push(`  variant: ${component.variants.variant[0]}`);
      }
      if (component.variants.size) {
        notes.push(`  size: ${component.variants.size[0]}`);
      }
      notes.push('  className: "custom-class"');
      notes.push('  id: "unique-id"');
    }
  }

  private getDependencies(component: MADEComponent): string[] {
    const dependencies: string[] = [];
    
    // Check if component requires JavaScript
    if (component.examples.some(ex => ex.html.includes('data-toggle') || ex.html.includes('onclick'))) {
      dependencies.push('made.js - For interactive functionality');
    }
    
    // Check for icon dependencies
    if (component.cssClasses.some(cls => cls.includes('icon')) || 
        component.htmlScaffold.includes('icon')) {
      dependencies.push('MADE icons - Icon font or SVG sprites');
    }
    
    // Check for specific CSS dependencies
    if (component.cssVarsUsed.length > 0) {
      dependencies.push('made-css-variables.css - For design token support');
    }
    
    dependencies.push('made.css - Core MADE styles');
    
    return dependencies;
  }

  // Utility method to generate multiple variations
  async scaffoldVariations(
    componentName: string, 
    variations: Record<string, any>[]
  ): Promise<ScaffoldComponentResponse[]> {
    const component = this.components.find(comp => 
      comp.name.toLowerCase() === componentName.toLowerCase()
    );
    
    if (!component) {
      throw new Error(`Component '${componentName}' not found`);
    }
    
    const results: ScaffoldComponentResponse[] = [];
    
    for (const variation of variations) {
      const result = await this.scaffold(component, variation);
      results.push(result);
    }
    
    return results;
  }

  // Get component preview with all variants
  async generateComponentPreview(componentName: string): Promise<{
    component: MADEComponent;
    variations: Array<{ props: Record<string, any>; html: string; }>;
  }> {
    const component = this.components.find(comp => 
      comp.name.toLowerCase() === componentName.toLowerCase()
    );
    
    if (!component) {
      throw new Error(`Component '${componentName}' not found`);
    }
    
    const variations: Array<{ props: Record<string, any>; html: string; }> = [];
    
    // Generate variations based on component variants
    const variantCombinations = this.generateVariantCombinations(component.variants);
    
    for (const props of variantCombinations.slice(0, 10)) { // Limit to 10 variations
      try {
        const scaffoldResult = await this.scaffold(component, props);
        variations.push({
          props,
          html: scaffoldResult.html
        });
      } catch (error) {
        logger.warn(`Failed to generate variation for ${componentName}:`, error);
      }
    }
    
    return {
      component,
      variations
    };
  }

  private generateVariantCombinations(variants: Record<string, string[]>): Record<string, any>[] {
    if (Object.keys(variants).length === 0) return [{}];
    
    const combinations: Record<string, any>[] = [];
    const variantKeys = Object.keys(variants);
    
    // Generate a reasonable number of combinations
    variantKeys.forEach(key => {
      variants[key].forEach(value => {
        combinations.push({ [key]: value });
      });
    });
    
    // Add a few multi-variant combinations
    if (variantKeys.length > 1) {
      const firstKey = variantKeys[0];
      const secondKey = variantKeys[1];
      
      variants[firstKey].slice(0, 2).forEach(firstValue => {
        variants[secondKey].slice(0, 2).forEach(secondValue => {
          combinations.push({
            [firstKey]: firstValue,
            [secondKey]: secondValue
          });
        });
      });
    }
    
    return combinations.slice(0, 20); // Reasonable limit
  }
}