# MADE MCP Server

A **Model Context Protocol (MCP) server** that enables GitHub Copilot Agent Mode to generate UI components conforming to the Mastercard MADE design system. This server provides offline access to design tokens, component scaffolds, and usage examples for seamless integration in corporate/air-gapped environments.

## 🚀 Features

- **Offline-First**: No external network calls at runtime after initial sync
- **Design System Integration**: Complete access to MADE CSS variables, utility classes, and component patterns
- **Intelligent Component Scaffolding**: Generate ready-to-use HTML with proper MADE classes and accessibility attributes
- **Smart Search**: Find components and examples using natural language queries
- **Markup Linting**: Validate HTML against MADE design system standards
- **GitHub Copilot Integration**: Native MCP support for seamless AI-assisted development
- **Docker Ready**: Production-grade containerization with health checks
- **Auto-Sync**: Keep design system artifacts up-to-date with scheduled syncing

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [MCP Tools Reference](#mcp-tools-reference)
- [GitHub Copilot Integration](#github-copilot-integration)
- [Docker Deployment](#docker-deployment)
- [Development](#development)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [API Examples](#api-examples)

## ⚡ Quick Start

### Prerequisites

- Node.js 18+ 
- Git
- Docker (optional, for containerized deployment)

### Option 1: Docker (Recommended)

The easiest way to get started is using Docker, which automatically clones and parses the MADE design system:

```bash
# Clone the repository
git clone <repository-url>
cd made-mcp

# Build with a specific MADE version (REQUIRED)
./scripts/docker-build.sh v3.0.0

# Or use Docker Compose
MADE_VERSION=v3.0.0 docker-compose up

# The server will be available at http://localhost:3000
```

**Available MADE versions**: Check [MADE releases](https://github.com/Mastercard/made/tags) for available versions like `v3.0.0`, `v2.3.0`, or use `main` for the latest.

### Option 2: Local Development

```bash
# Clone and install
git clone <repository-url>
cd made-mcp
npm install

# Build the project
npm run build

# Initial sync of MADE design system
npm run sync

# Start the MCP server
npm start
```

### Docker Quick Start

```bash
# Build and start with Docker Compose
docker-compose up -d made-mcp-server

# Check status
docker-compose logs made-mcp-server

# Sync design system data
docker-compose exec made-mcp-server ./scripts/sync.sh
```

## 🏗 Architecture

The MADE MCP Server follows a modular architecture designed for reliability and performance:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   GitHub        │    │   MCP Server     │    │   MADE Design   │
│   Copilot       │◄──►│                  │◄──►│   System Repo   │
│   Agent Mode    │    │   - Tools API    │    │   (Cached)      │
└─────────────────┘    │   - Indexing     │    └─────────────────┘
                       │   - Search       │    
                       │   - Linting      │    
                       └──────────────────┘    

Data Flow:
1. Sync process clones/updates MADE repository
2. Parsers extract tokens and components from CSS/Stories  
3. Indexes enable fast offline lookups
4. Copilot requests components via MCP tools
5. Server returns scaffolds with MADE classes and tokens
```

### Core Components

- **CSS Parser**: Extracts design tokens from `made-css-variables.css`
- **Storybook Parser**: Analyzes component stories for scaffolds and examples
- **Index Manager**: Builds and manages local search indexes
- **Search Engine**: Provides intelligent component and example discovery
- **Markup Linter**: Validates HTML against MADE standards
- **Component Scaffolder**: Generates production-ready component markup

## 🛠 MCP Tools Reference

The server exposes these MCP tools for GitHub Copilot integration:

### `list_tokens(scope?: string)`

Returns design tokens with categories and values.

**Parameters:**
- `scope` (optional): Filter by category (color, spacing, typography, shadow, radius, breakpoint)

**Response:**
```json
{
  "tokens": [
    {
      "name": "--made-color-primary-500",
      "value": "#FF5F00", 
      "category": "color",
      "description": "Primary brand color"
    }
  ],
  "meta": {
    "totalCount": 150,
    "filteredCount": 12
  }
}
```

### `list_components()`

Returns available MADE components with metadata.

**Response:**
```json
{
  "components": [
    {
      "name": "Button",
      "description": "Interactive button component with multiple variants",
      "tags": ["interactive", "form"],
      "variants": {
        "variant": ["primary", "secondary", "ghost"],
        "size": ["sm", "md", "lg"]
      },
      "props": {},
      "a11yNotes": ["Ensure proper focus management"]
    }
  ]
}
```

### `get_component(name: string)`

Get detailed component information including HTML scaffold.

**Parameters:**
- `name`: Component name (e.g., "Button", "Card", "Alert")

**Response:**
```json
{
  "name": "Button",
  "description": "Interactive button component",
  "html": "<button class=\"made-btn made-btn-primary\" type=\"button\">Button Text</button>",
  "classes": ["made-btn", "made-btn-primary"],
  "cssVarsUsed": ["--made-color-primary-500", "--made-spacing-md"],
  "variants": {
    "variant": ["primary", "secondary", "ghost"],
    "size": ["sm", "md", "lg"]
  },
  "examples": [
    {
      "title": "Primary Button",
      "html": "<button class=\"made-btn made-btn-primary\">Click me</button>"
    }
  ]
}
```

### `scaffold_component(name: string, props?: object)`

Generate customized component HTML with props applied.

**Parameters:**
- `name`: Component name
- `props`: Component properties (variant, size, className, etc.)

**Example Request:**
```json
{
  "name": "Button",
  "props": {
    "variant": "primary",
    "size": "lg", 
    "text": "Get Started",
    "className": "my-custom-class"
  }
}
```

**Response:**
```json
{
  "html": "<button class=\"made-btn made-btn-primary made-btn-lg my-custom-class\" type=\"button\" aria-label=\"Get Started button\">Get Started</button>",
  "notes": [
    "Applied variant: primary",
    "Applied size: lg", 
    "Added default aria-label - customize as needed"
  ],
  "dependencies": ["made.css", "made-css-variables.css"]
}
```

### `search_examples(query: string)`

Search for component examples using natural language.

**Parameters:**
- `query`: Search query (e.g., "dark button", "responsive card", "alert with icon")

**Response:**
```json
{
  "results": [
    {
      "component": "Button", 
      "title": "Button - Dark Theme",
      "html": "<button class=\"made-btn made-btn-dark\">Dark Button</button>",
      "sourcePath": "components/button/examples",
      "upstreamRef": "main"
    }
  ],
  "meta": {
    "totalResults": 5,
    "query": "dark button"
  }
}
```

### `lint_markup(html: string)`

Validate HTML markup against MADE standards.

**Parameters:**
- `html`: HTML markup to validate

**Response:**
```json
{
  "valid": false,
  "issues": [
    {
      "type": "warning",
      "message": "Button element should use MADE button classes",
      "fixSuggestion": "Add classes like 'made-btn', 'made-btn-primary', etc.",
      "line": 1
    },
    {
      "type": "error", 
      "message": "Button needs accessible text content or aria-label",
      "fixSuggestion": "Add text content or aria-label attribute",
      "line": 1
    }
  ],
  "suggestions": [
    "Fix 1 error(s) to ensure MADE compliance",
    "Add appropriate MADE CSS classes to ensure consistent styling"
  ]
}
```

### `health_check()`

Check server health and component availability.

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0", 
  "upstreamVersion": "v2.1.0",
  "lastSync": "2024-01-15T10:30:00Z",
  "checks": [
    {
      "name": "indexes_loaded",
      "status": "pass",
      "message": "45 components, 150 tokens loaded"
    }
  ]
}
```

### `version()`

Get server and design system version information.

**Response:**
```json
{
  "server": "1.0.0",
  "upstream": "v2.1.0", 
  "lastSync": "2024-01-15T10:30:00Z",
  "indexMeta": {
    "version": "1.0.0",
    "upstreamCommit": "abc123def",
    "upstreamRef": "main",
    "buildTime": "2024-01-15T10:30:00Z",
    "componentsCount": 45,
    "tokensCount": 150
  }
}
```

## 🤖 GitHub Copilot Integration

### Setup

1. **Configure MCP Client**: Add server configuration to your Copilot MCP settings:

```json
{
  "servers": {
    "made-mcp": {
      "command": "node",
      "args": ["/path/to/made-mcp/dist/server.js"],
      "env": {
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

2. **Docker Configuration** (recommended for production):

```json
{
  "servers": {
    "made-mcp": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "made-mcp-server:latest"],
      "env": {
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### Example Copilot Interactions

#### Creating a Primary Button
```
User: "Create a primary button with MADE design system"

Copilot: I'll create a primary button using the MADE design system.

[MCP Tool Call: scaffold_component]
{
  "name": "Button", 
  "props": {
    "variant": "primary",
    "text": "Click me"
  }
}

Here's your MADE primary button:

<button class="made-btn made-btn-primary" type="button" aria-label="Click me button">Click me</button>

This button uses:
- made-btn: Base button styling
- made-btn-primary: Primary variant coloring  
- Proper accessibility with type and aria-label attributes
- MADE design tokens for consistent theming
```

#### Building a Responsive Card Grid

```
User: "Build a responsive card grid with images and captions using MADE"

Copilot: I'll help you create a responsive card grid using MADE components.

[MCP Tool Call: search_examples] 
{"query": "responsive card grid images"}

[MCP Tool Call: scaffold_component]
{"name": "Card", "props": {"variant": "default"}}

Here's a responsive card grid using MADE:

<div class="made-container">
  <div class="made-grid made-grid-responsive">
    <div class="made-col-12 made-col-md-6 made-col-lg-4">
      <div class="made-card">
        <img src="image1.jpg" alt="Card image" class="made-card-image">
        <div class="made-card-body">
          <h3 class="made-card-title">Card Title</h3>
          <p class="made-card-text">Card caption text goes here.</p>
        </div>
      </div>
    </div>
    <!-- Repeat for more cards -->
  </div>
</div>

This uses MADE's responsive grid system with breakpoint classes for mobile-first design.
```

#### Creating a Dark-Mode Alert

```
User: "Give me a dark-mode friendly alert with an icon and dismiss action"

Copilot: I'll create a dark-mode alert with MADE components.

[MCP Tool Call: search_examples]
{"query": "dark alert icon dismiss"}

[MCP Tool Call: scaffold_component]
{
  "name": "Alert",
  "props": {
    "variant": "dark",
    "dismissible": true
  }
}

Here's your dark-mode alert with MADE:

<div class="made-alert made-alert-dark made-alert-dismissible" role="alert" aria-live="polite">
  <div class="made-alert-content">
    <i class="made-icon made-icon-info" aria-hidden="true"></i>
    <div class="made-alert-body">
      <strong>Notice:</strong> This alert works well in dark themes.
    </div>
    <button class="made-alert-dismiss" type="button" aria-label="Close alert">
      <i class="made-icon made-icon-close" aria-hidden="true"></i>
    </button>
  </div>
</div>

Features:
- Dark variant styling with made-alert-dark
- Accessible with proper ARIA attributes
- Icon support with made-icon classes
- Dismissible functionality
- Uses MADE design tokens for consistent theming
```

## 🐳 Docker Deployment

### Building with MADE Version

**Important**: You must specify a MADE design system version when building the Docker image. The container will clone and parse the specified version during build time.

```bash
# Using the build script (recommended)
./scripts/docker-build.sh v3.0.0

# Or build directly with Docker
docker build --build-arg MADE_VERSION=v3.0.0 -t made-mcp-server:v3.0.0 .

# Available versions: https://github.com/Mastercard/made/tags
# Examples: v3.0.0, v2.3.0, main, develop
```

### Docker Compose (Recommended)

```bash
# Set the MADE version and start
MADE_VERSION=v3.0.0 docker-compose up -d

# Or create a .env file with:
# MADE_VERSION=v3.0.0
docker-compose up -d
```

### Production Deployment

```bash
# Build for specific MADE version
./scripts/docker-build.sh v3.0.0 made-mcp-server:production

# Run with data persistence
docker run -d \
  --name made-mcp-server \
  --restart unless-stopped \
  -p 3000:3000 \
  -v made_data:/app/data \
  -e LOG_LEVEL=info \
  made-mcp-server:production
```

### Health Monitoring

```bash
# Check container health
docker ps --filter name=made-mcp-server

# View logs
docker-compose logs -f made-mcp-server

# Check health endpoint
curl http://localhost:3000/health

# Monitor resource usage
docker stats made-mcp-server
```

## 🔧 Development

### Local Development Setup

```bash
# Install dependencies
npm install

# Start development server with hot reload
npm run dev

# Run sync in development  
npm run sync -- --verbose

# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

### Project Structure

```
made-mcp/
├── src/
│   ├── server.ts              # MCP server entry point
│   ├── mcp-server.ts          # Core MCP server implementation  
│   ├── types.ts               # TypeScript type definitions
│   ├── parsers/               # CSS and Storybook parsers
│   │   ├── css-parser.ts
│   │   └── storybook-parser.ts
│   ├── indexing/              # Search indexing system
│   │   └── index-manager.ts
│   ├── linting/               # Markup validation
│   │   └── markup-linter.ts
│   ├── scaffolding/           # Component scaffolding
│   │   └── component-scaffolder.ts
│   ├── search/                # Search engine
│   │   └── search-engine.ts
│   ├── scripts/               # Build and sync scripts
│   │   ├── sync.ts
│   │   └── build-index.ts
│   └── utils/                 # Shared utilities
│       └── logger.ts
├── scripts/                   # Shell scripts
│   └── sync.sh               # Sync script
├── data/                     # Runtime data (git-ignored)
│   ├── made-repo/           # Cloned MADE repository  
│   ├── indexes/             # Search indexes
│   └── cache/               # Temporary cache
├── Dockerfile               # Production container
├── docker-compose.yml       # Container orchestration
└── package.json            # Dependencies and scripts
```

### Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Run specific test suite
npm test -- search-engine.test.ts

# Generate coverage report
npm run test:coverage
```

### Adding New Components

1. **Add Component Parser Logic**: Update `StorybookParser` to handle new component patterns
2. **Update Type Definitions**: Add new component types to `types.ts`  
3. **Test Component Scaffolding**: Ensure new components generate proper HTML
4. **Update Documentation**: Add examples to this README

## ⚙️ Configuration

### Environment Variables

```bash
# Logging
LOG_LEVEL=info              # debug, info, warn, error

# Repository Configuration  
REPO_URL=https://github.com/Mastercard/made.git
REPO_DIR=./data/made-repo
BRANCH=main

# Sync Behavior
FORCE_UPDATE=false          # Force updates even without changes
WATCH_MODE=false            # Enable continuous sync monitoring

# Server Configuration
NODE_ENV=production         # development, production
```

### Sync Configuration

```bash
# Manual sync
npm run sync

# Force sync (ignore cache)
npm run sync -- --force

# Watch mode (continuous updates)
npm run sync -- --watch

# Custom repository
npm run sync -- --repo https://github.com/custom/made-fork.git --branch develop

# Sync specific branch
npm run sync -- --branch feature/new-components
```

### Build Configuration

```bash
# Build indexes from local repository
npm run build-index

# Verbose build output
npm run build-index -- --verbose  

# Dry run (don't save)
npm run build-index -- --dry-run

# Export indexes for backup
npm run build-index -- export ./backup.json

# Import indexes from backup
npm run build-index -- import ./backup.json
```

## 🔍 Troubleshooting

### Common Issues

#### Server Won't Start
```bash
# Check if indexes are built
ls -la data/indexes/

# Rebuild indexes
npm run build-index

# Check logs
npm run dev  # Development mode with verbose logging
```

#### Sync Failures
```bash  
# Check repository access
git clone https://github.com/Mastercard/made.git test-clone

# Clear cache and retry
npm run sync -- reset
npm run sync -- --force

# Check network connectivity
curl -I https://github.com/Mastercard/made.git
```

#### Docker Issues
```bash
# Check container logs
docker-compose logs made-mcp-server

# Rebuild container
docker-compose build --no-cache made-mcp-server

# Check volumes
docker volume ls | grep made

# Reset data
docker-compose down -v
docker-compose up -d
```

#### Performance Issues
```bash
# Check index sizes
du -sh data/indexes/*

# Rebuild optimized indexes
npm run build-index -- --verbose

# Monitor memory usage
docker stats made-mcp-server
```

### Debug Mode

```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev

# Docker debug mode
docker-compose exec made-mcp-server bash
LOG_LEVEL=debug node dist/server.js
```

### Health Diagnostics

```bash
# Server health check
curl -X POST http://localhost:3000/health  # If running with HTTP endpoint
# OR
node dist/server.js --health-check

# Component availability
node -e "
const { MADEMCPServer } = require('./dist/mcp-server.js');
const server = new MADEMCPServer();
server.initialize().then(() => {
  console.log('Components:', server.listComponents().length);
  console.log('Tokens:', server.listTokens().length);
});
"
```

## 📚 API Examples

### Using MCP Tools Programmatically

```javascript
import { MADEMCPServer } from './dist/mcp-server.js';

const server = new MADEMCPServer();
await server.initialize();

// List all design tokens
const tokens = await server.listTokens();
console.log(`Found ${tokens.tokens.length} design tokens`);

// Get color tokens only
const colorTokens = await server.listTokens('color');
console.log('Color tokens:', colorTokens.tokens.slice(0, 3));

// Get component information
const buttonInfo = await server.getComponent('Button');
console.log('Button variants:', buttonInfo.variants);

// Generate custom button
const customButton = await server.scaffoldComponent('Button', {
  variant: 'primary',
  size: 'lg',
  text: 'Get Started',
  className: 'hero-button'
});
console.log('Generated HTML:', customButton.html);

// Search for examples
const searchResults = await server.searchExamples('dark theme button');
console.log(`Found ${searchResults.results.length} examples`);

// Lint markup
const lintResults = await server.lintMarkup('<button>Click</button>');
console.log('Validation issues:', lintResults.issues);
```

### Integration with Build Tools

```javascript
// Webpack plugin example
class MADEComponentPlugin {
  constructor(options = {}) {
    this.server = new MADEMCPServer();
    this.initialized = false;
  }

  apply(compiler) {
    compiler.hooks.beforeCompile.tapAsync('MADEComponentPlugin', async (params, callback) => {
      if (!this.initialized) {
        await this.server.initialize();
        this.initialized = true;
      }
      callback();
    });

    compiler.hooks.normalModuleFactory.tap('MADEComponentPlugin', (factory) => {
      factory.hooks.resolver.tap('MADEComponentPlugin', (resolver) => {
        resolver.hooks.resolve.tapAsync('MADEComponentPlugin', (request, resolveContext, callback) => {
          // Resolve MADE component imports
          if (request.request.startsWith('@made/')) {
            const componentName = request.request.replace('@made/', '');
            this.server.getComponent(componentName).then(component => {
              // Return component HTML or scaffold
              callback(null, component);
            });
          } else {
            callback();
          }
        });
      });
    });
  }
}
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)  
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/mastercard/made-mcp-server/issues)
- **Documentation**: [MADE Design System](https://github.com/Mastercard/made)
- **MCP Specification**: [Model Context Protocol](https://modelcontextprotocol.io/)

---

**Made with ❤️ for the MADE design system community**