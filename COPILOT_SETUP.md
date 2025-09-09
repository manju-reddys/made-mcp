# GitHub Copilot + MADE MCP Server Setup

This guide helps you set up the MADE design system MCP server to work with GitHub Copilot.

## 🚀 Quick Start

1. **Ensure Docker is running** and the MADE MCP server image is built:
   ```bash
   ./scripts/docker-build.sh v3.0.0
   ```

2. **Test the setup**:
   ```bash
   ./start-made-mcp.sh
   ```

3. **Configure GitHub Copilot** to use the MCP server (see configuration below)

## 📁 Configuration Files

The setup creates these configuration files:

- `.copilot/mcp.json` - MCP server configuration for GitHub Copilot
- `.copilot/made-design-system.md` - Context documentation for Copilot
- `mcp-config.json` - Alternative configuration format
- `start-made-mcp.sh` - Startup and test script

## ⚙️ GitHub Copilot Configuration

### Option 1: Workspace Configuration
Place the `.copilot/mcp.json` file in your project root. GitHub Copilot will automatically detect and use it.

### Option 2: Global Configuration
Copy the MCP configuration to your global Copilot settings:

```json
{
  "mcpServers": {
    "made-design-system": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "made-mcp-server:v3.0.0"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

## 🛠️ Available MCP Tools

The MADE MCP server provides these tools to GitHub Copilot:

| Tool | Description |
|------|-------------|
| `list_tokens` | List CSS variable tokens with categories |
| `list_components` | List available MADE components |
| `get_component` | Get detailed component information |
| `scaffold_component` | Generate HTML scaffold for components |
| `search_examples` | Search component examples |
| `lint_markup` | Validate HTML against MADE standards |
| `health_check` | Check server health |
| `version` | Get version information |

## 💡 Usage Examples

### Ask Copilot to use MADE components:

**Prompt**: "Create a button using MADE design system"
**Expected**: Copilot will generate HTML with proper MADE classes

**Prompt**: "Show me MADE color tokens for error states"
**Expected**: Copilot will use the MCP server to fetch error color tokens

**Prompt**: "Create a form with MADE components"
**Expected**: Copilot will generate a form using MADE form classes

### Use in comments to guide Copilot:

```html
<!-- Use MADE design system primary button -->
<button class="made-c-button made-c-button--primary">Click me</button>

<!-- Create MADE card component with shadow -->
<div class="made-c-card made-c-card--shadow">
  <h3>Card Title</h3>
  <p>Card content</p>
</div>
```

## 🔍 Troubleshooting

### MCP Server Not Found
```bash
# Build the Docker image
./scripts/docker-build.sh v3.0.0

# Verify image exists
docker images | grep made-mcp-server
```

### Docker Not Running
```bash
# Start Docker Desktop or Docker daemon
# Then test again
./start-made-mcp.sh
```

### Copilot Not Using MCP Server
1. Ensure `.copilot/mcp.json` is in your project root
2. Restart VS Code or your editor
3. Try explicit prompts mentioning "MADE design system"

## 📊 Verification

To verify the setup is working:

1. **Test MCP server directly**:
   ```bash
   echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | docker run -i --rm made-mcp-server:v3.0.0
   ```

2. **Check Copilot integration**:
   - Ask Copilot: "List MADE design system components"
   - Ask Copilot: "Show me MADE color tokens"
   - Ask Copilot: "Create a MADE button component"

3. **Monitor MCP usage**:
   - Look for Docker containers starting when Copilot makes requests
   - Check that Copilot suggestions include MADE CSS classes

## 🎯 Best Practices

1. **Be specific in prompts**: Mention "MADE design system" explicitly
2. **Use context files**: Reference `.copilot/made-design-system.md` in comments
3. **Validate output**: Use the `lint_markup` tool to check generated HTML
4. **Stay updated**: Rebuild the Docker image when MADE updates

## 🔗 Related Files

- `Dockerfile` - MCP server container definition
- `scripts/docker-build.sh` - Build script for the MCP server
- `src/` - MCP server source code
- `.copilot/` - Copilot configuration and context files