#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { MADEMCPServer } from "./mcp-server.js";
import { logger } from "./utils/logger.js";

const server = new Server(
  {
    name: "made-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const madeServer = new MADEMCPServer();

// Initialize the server
await madeServer.initialize();

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_tokens",
        description: "List CSS variable tokens with categories and values",
        inputSchema: {
          type: "object",
          properties: {
            scope: {
              type: "string",
              description:
                "Filter tokens by category (color, spacing, typography, etc.)",
            },
          },
        },
      },
      {
        name: "list_components",
        description: "List available MADE components with metadata",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_component",
        description:
          "Get detailed component information including HTML scaffold and usage",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: 'Component name (e.g., "Button", "Card", "Alert")',
            },
          },
          required: ["name"],
        },
      },
      {
        name: "scaffold_component",
        description:
          "Generate ready-to-use HTML scaffold for a component with props",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Component name",
            },
            props: {
              type: "object",
              description: "Component properties and variants",
              additionalProperties: true,
            },
          },
          required: ["name"],
        },
      },
      {
        name: "search_examples",
        description: "Search for component examples and usage patterns",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query for examples",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "lint_markup",
        description:
          "Validate HTML markup against MADE design system standards",
        inputSchema: {
          type: "object",
          properties: {
            html: {
              type: "string",
              description: "HTML markup to validate",
            },
          },
          required: ["html"],
        },
      },
      {
        name: "health_check",
        description: "Check server health and component availability",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "version",
        description:
          "Get server and upstream MADE design system version information",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_tokens":
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                await madeServer.listTokens(args?.scope as string),
                null,
                2
              ),
            },
          ],
        };

      case "list_components":
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(await madeServer.listComponents(), null, 2),
            },
          ],
        };

      case "get_component":
        if (!args?.name || typeof args.name !== "string") {
          throw new Error("Component name is required");
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                await madeServer.getComponent(args.name),
                null,
                2
              ),
            },
          ],
        };

      case "scaffold_component":
        if (!args?.name || typeof args.name !== "string") {
          throw new Error("Component name is required");
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                await madeServer.scaffoldComponent(
                  args.name,
                  args?.props as Record<string, any>
                ),
                null,
                2
              ),
            },
          ],
        };

      case "search_examples":
        if (!args?.query || typeof args.query !== "string") {
          throw new Error("Search query is required");
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                await madeServer.searchExamples(args.query),
                null,
                2
              ),
            },
          ],
        };

      case "lint_markup":
        if (!args?.html || typeof args.html !== "string") {
          throw new Error("HTML markup is required");
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                await madeServer.lintMarkup(args.html),
                null,
                2
              ),
            },
          ],
        };

      case "health_check":
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(await madeServer.healthCheck(), null, 2),
            },
          ],
        };

      case "version":
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(await madeServer.version(), null, 2),
            },
          ],
        };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error(`Tool ${name} failed:`, errorMessage);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: errorMessage,
              tool: name,
              timestamp: new Date().toISOString(),
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
});

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);

logger.info("MADE MCP Server started and ready for connections");

// Handle graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Shutting down MADE MCP Server...");
  await server.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down MADE MCP Server...");
  await server.close();
  process.exit(0);
});
