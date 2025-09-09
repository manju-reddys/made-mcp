# Made Design System Context for GitHub Copilot

This file provides context to GitHub Copilot about the Mastercard Made Design System.

## Component Guidelines

When generating components, ALWAYS use Made Design System classes and patterns:

### Buttons
```html
<!-- Primary Button -->
<button class="made-c-button made-c-button--primary" type="button">Submit</button>

<!-- Secondary Button -->
<button class="made-c-button made-c-button--secondary" type="button">Cancel</button>

<!-- Ghost Button -->
<button class="made-c-button made-c-button--ghost" type="button">Learn More</button>
```

### Form Elements
```html
<!-- Text Input -->
<div class="made-c-form__element">
  <label for="email" class="made-c-form__label">Email</label>
  <input class="made-c-text-input" type="email" id="email" name="email" required>
</div>

<!-- Textarea -->
<div class="made-c-form__element">
  <label for="message" class="made-c-form__label">Message</label>
  <textarea class="made-c-textarea" id="message" name="message"></textarea>
</div>

<!-- Checkbox -->
<div class="made-c-checkbox">
  <input class="made-c-checkbox__input" type="checkbox" id="agree" name="agree">
  <label class="made-c-checkbox__label" for="agree">I agree to terms</label>
</div>
```

### Modal
```html
<div class="made-c-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
  <div class="made-c-modal__backdrop"></div>
  <div class="made-c-modal__container">
    <div class="made-c-modal__header">
      <h2 id="modal-title" class="made-c-modal__title">Modal Title</h2>
      <button class="made-c-modal__close" aria-label="Close modal">&times;</button>
    </div>
    <div class="made-c-modal__body">
      <p>Modal content goes here.</p>
    </div>
    <div class="made-c-modal__footer">
      <button class="made-c-button made-c-button--secondary">Cancel</button>
      <button class="made-c-button made-c-button--primary">Confirm</button>
    </div>
  </div>
</div>
```

## Design Tokens

ALWAYS use Made CSS variables instead of hardcoded values:

### Colors
```css
/* Action Colors */
--made-color-action-background-primary-default: #A82226;
--made-color-action-background-secondary-default: transparent;
--made-color-feedback-success: #038a00;
--made-color-feedback-error: #ee0000;

/* Usage */
.my-component {
  background: var(--made-color-action-background-primary-default);
  color: var(--made-color-text-default-on-dark);
}
```

### Spacing
```css
/* Spacing Scale */
--made-space-1-x: 0.25rem; /* 4px */
--made-space-2-x: 0.5rem;  /* 8px */
--made-space-4-x: 1rem;    /* 16px */
--made-space-6-x: 1.5rem;  /* 24px */
--made-space-8-x: 2rem;    /* 32px */

/* Usage */
.my-component {
  padding: var(--made-space-4-x);
  margin-bottom: var(--made-space-6-x);
}
```

### Border Radius
```css
--made-border-radius-02: 4px;
--made-border-radius-04: 8px;
--made-border-radius-06: 16px;

/* Usage */
.my-component {
  border-radius: var(--made-border-radius-04);
}
```

## Accessibility Requirements

ALWAYS include proper accessibility attributes:

1. **Buttons**: Include `type` attribute and `aria-label` for icon buttons
2. **Forms**: Associate labels with inputs using `for`/`id`
3. **Modals**: Include `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
4. **Interactive elements**: Ensure keyboard navigation and focus management

## Component Naming Convention

- Base class: `made-c-{component}` (e.g., `made-c-button`)
- Variants: `made-c-{component}--{variant}` (e.g., `made-c-button--primary`)
- Elements: `made-c-{component}__{element}` (e.g., `made-c-modal__header`)

## MCP Server Integration

To query the Made MCP server for validation or generation:

1. Use the command palette: "Made: Query MCP Server"
2. In Copilot Chat, use: `@made-design-system generate a primary button`
3. For validation: `@made-design-system validate this component`

## Rules for Copilot

1. NEVER use hardcoded colors, spacing, or other design values
2. ALWAYS use Made CSS classes and variables
3. ALWAYS include proper accessibility attributes
4. ALWAYS follow the Made component structure
5. When in doubt, query the MCP server for guidance