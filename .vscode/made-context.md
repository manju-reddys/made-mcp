# Made Design System Context for GitHub Copilot

This file provides context to GitHub Copilot about the Mastercard Made Design System.

## Component Guidelines

When generating components, ALWAYS use Made Design System classes and patterns:

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
6. Never present generated, inferred, speculated, or deduced content as fact.