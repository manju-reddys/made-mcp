# GitHub Copilot Test Prompts for MADE MCP Server

These prompts can be used to test the MADE MCP Server integration with GitHub Copilot Agent Mode.

## Prerequisites

1. Ensure Docker container is running:
   ```bash
   docker-compose up -d made-mcp-server
   ```

2. Configure GitHub Copilot with the MCP server using `copilot-config-example.json`

## Basic Functionality Tests

### 1. Component Discovery
```
Show me all available MADE components
```
**Expected Result**: List of all components with brief descriptions

### 2. Design Token Exploration  
```
What design tokens are available in the MADE system?
```
**Expected Result**: List of color, spacing, typography tokens

### 3. Component Details
```
Tell me about the Button component in MADE
```
**Expected Result**: Detailed component information, props, variants, examples

## Component Generation Tests

### 4. Basic Button Creation
```
Create a primary button using MADE design system
```
**Expected Result**: HTML with proper MADE button classes and structure

### 5. Button with Props
```
Generate a large secondary button with the text "Get Started" using MADE
```
**Expected Result**: HTML button with size and variant classes applied

### 6. Form Components
```
Create a MADE input field for email with proper validation styling
```
**Expected Result**: Input element with MADE form classes and attributes

### 7. Card Component
```
Build a MADE card component with a title, description, and action button
```
**Expected Result**: Complete card HTML structure with MADE classes

### 8. Navigation Menu
```
Create a horizontal navigation menu using MADE components
```
**Expected Result**: Navigation HTML with proper MADE navigation classes

## Layout and Grid Tests

### 9. Responsive Grid
```
Create a 3-column responsive grid layout using MADE grid system
```
**Expected Result**: HTML with MADE grid classes and responsive breakpoints

### 10. Dashboard Layout
```
Build a dashboard layout with header, sidebar, and main content area using MADE
```
**Expected Result**: Complete layout structure with MADE layout classes

### 11. Card Grid
```
Create a responsive card grid showing product items using MADE styling
```
**Expected Result**: Grid container with multiple card components

## Advanced Functionality Tests

### 12. Component Search
```
Find MADE components related to data display and tables
```
**Expected Result**: List of table, list, and data display components

### 13. Form Validation
```
Create a contact form with validation using MADE form components
```
**Expected Result**: Form with proper validation classes and ARIA attributes

### 14. Accessibility Features
```
Generate an accessible modal dialog using MADE components
```
**Expected Result**: Modal HTML with proper ARIA attributes and focus management

### 15. Color System Usage
```
Create a color palette showcase using MADE color tokens
```
**Expected Result**: HTML elements displaying MADE color variables and classes

## Validation and Linting Tests

### 16. Markup Validation
```
Check if this HTML follows MADE standards: <button class="btn-primary">Click me</button>
```
**Expected Result**: Validation errors and suggestions for proper MADE classes

### 17. Compliance Check
```
Validate this form markup against MADE design system standards: [HTML snippet]
```
**Expected Result**: Detailed compliance report with specific improvements

### 18. Accessibility Audit
```
Review this component for MADE accessibility requirements: [HTML snippet]
```
**Expected Result**: Accessibility issues and MADE-compliant solutions

## Complex Integration Tests

### 19. E-commerce Product Page
```
Create a complete product page layout using MADE components including header, breadcrumb, product details, and reviews section
```
**Expected Result**: Full page HTML with proper MADE component composition

### 20. Data Dashboard
```
Build a data dashboard with charts, metrics cards, and filters using MADE design system
```
**Expected Result**: Dashboard HTML with MADE data visualization components

### 21. User Profile Page
```
Design a user profile page with tabs, form fields, and action buttons using MADE
```
**Expected Result**: Profile page HTML with MADE tab and form components

### 22. Landing Page Hero
```
Create a landing page hero section with headline, description, CTA buttons, and background image using MADE
```
**Expected Result**: Hero section HTML with MADE typography and button styles

## Customization Tests

### 23. Theme Customization
```
Show me how to customize MADE button colors for a dark theme
```
**Expected Result**: CSS custom properties and class overrides

### 24. Component Variants
```
Create all available variants of the MADE alert component
```
**Expected Result**: HTML for success, warning, error, and info alert variants

### 25. Responsive Behavior
```
Make this MADE card component responsive across mobile, tablet, and desktop
```
**Expected Result**: HTML with MADE responsive utility classes

## Error Handling Tests

### 26. Invalid Component Request
```
Create a "SuperButton" component using MADE
```
**Expected Result**: Graceful error handling, suggestion for similar components

### 27. Malformed HTML Validation
```
Validate this broken HTML: <div class="made-button"><span>Incomplete
```
**Expected Result**: Clear error messages and correction suggestions

## Integration Workflow Tests

### 28. Component Library Exploration
```
I'm new to MADE. Help me understand what components are available and show examples of a typical web page structure
```
**Expected Result**: Guided tour of components with practical examples

### 29. Design System Migration
```
I have this Bootstrap HTML, help me convert it to use MADE components: [Bootstrap HTML]
```
**Expected Result**: Converted HTML with equivalent MADE components

### 30. Performance Optimization
```
Review my MADE component usage and suggest optimizations for better performance
```
**Expected Result**: Analysis of HTML structure with optimization recommendations

## System Status Tests

### 31. Health Check
```
Is the MADE design system server working properly?
```
**Expected Result**: System status report with component and token counts

### 32. Version Information
```
What version of the MADE design system am I using?
```
**Expected Result**: Version details and last sync information

### 33. Component Updates
```
Have there been any recent updates to MADE components?
```
**Expected Result**: Change log or update information

## Interactive Testing Scenarios

### 34. Iterative Design
```
Start with a basic button, then make it larger, then add an icon, then make it full width
```
**Expected Result**: Progressive HTML improvements with each request

### 35. A/B Testing Variants
```
Create two versions of a CTA section - one with a button, one with a link
```
**Expected Result**: Two HTML variants using appropriate MADE components

### 36. Responsive Design Iteration
```
This card looks good on desktop, now make it work better on mobile
```
**Expected Result**: Mobile-optimized HTML with responsive MADE classes

## Expected Success Indicators

For each test prompt, successful integration should demonstrate:

- ✅ **Proper MCP Tool Usage**: Copilot calls appropriate MADE MCP tools
- ✅ **Accurate Component Information**: Returns correct MADE component details
- ✅ **Valid HTML Generation**: Produces syntactically correct HTML
- ✅ **MADE Class Usage**: Uses authentic MADE CSS classes and structure
- ✅ **Accessibility Compliance**: Includes proper ARIA attributes
- ✅ **Responsive Design**: Applies appropriate responsive utilities
- ✅ **Design Token Integration**: Uses MADE color, spacing, typography tokens
- ✅ **Error Handling**: Graceful handling of invalid requests
- ✅ **Context Awareness**: Maintains context across conversation turns
- ✅ **Best Practices**: Follows MADE design system guidelines

## Common Issues to Watch For

- **Hallucinated Components**: Copilot inventing non-existent MADE components
- **Incorrect Class Names**: Using generic classes instead of MADE-specific ones
- **Missing Accessibility**: Omitting required ARIA attributes
- **Broken HTML**: Malformed or unclosed tags
- **Context Loss**: Losing track of MADE-specific requirements
- **Tool Call Failures**: MCP server connection or tool execution errors

## Testing Checklist

Before considering the integration successful, verify:

- [ ] All 36 test prompts execute without errors
- [ ] Generated HTML validates against MADE standards
- [ ] Component information is accurate and up-to-date
- [ ] Accessibility requirements are met
- [ ] Responsive design works across breakpoints
- [ ] Error cases are handled gracefully
- [ ] Performance is acceptable (responses within 5 seconds)
- [ ] Copilot maintains MADE context throughout conversations