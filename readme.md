# Calculator MCP Server

This is a Model Context Protocol (MCP) server that provides calculator capabilities for AI tools, enabling them to execute mathematical operations securely and efficiently.

## Integration Approaches

There are two ways to integrate this MCP server with your AI tools. 

---

### Approach 1: Using the Deployed URL (Recommended)

Many AI tools (like Cursor, Windsurf, or other MCP-compatible clients) support connecting to a hosted MCP server via SSE (Server-Sent Events) directly over the internet.

You don't need to download or install anything locally. Simply configure your AI tool to connect to this URL:
```text
https://calculator-mcp-sztyx4r5lq-ts.a.run.app/mcp
```

---

### Approach 2: Cloning the Repo and Running Locally

If you prefer to run the server on your own machine, or if your AI tool (like Claude Desktop) requires a local executable using `stdio`, follow these steps:

#### Prerequisites

- Node.js
- npm (Node Package Manager)
- Git

#### 1. Clone and Setup

Open your terminal and run:

```bash
git clone <your-repository-url>
cd calculator-mcp
npm install
npm run build
```

#### 2. AI Tool Configuration (e.g., Claude Desktop)

Once the project is built, you can configure your local AI tool to use it. For Claude Desktop, add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "calculator": {
      "command": "node",
      "args": [
        "/absolute/path/to/calculator-mcp/dist/server.js"
      ]
    }
  }
}
```

*Note: Make sure to replace `/absolute/path/to/calculator-mcp` with the actual absolute path to where you cloned the repository on your system.*

#### Running for Development

To run the server locally while making changes to the code:

```bash
npm run dev
```

---

## Configuring Claude Desktop

To configure Claude Desktop to use this MCP, you need to edit its configuration file located at:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

If the file doesn't exist, create it. Add your server configuration (using either Approach 2 for local execution, or an SSE proxy for Approach 1) inside the `mcpServers` object, then **completely restart Claude Desktop** for the changes to take effect.

---

## Example Prompts

Once the calculator MCP is connected to your AI tool, you can try asking it questions that require mathematical computation. Here are a few example prompts:

- *"Please calculate 1,459 multiplied by 34 using the calculator tool."*
- *"Add 153.5 and 992.8, then divide the result by 4."*
- *"Calculate the compound interest for $1000 over 5 years at 5% interest rate. Break down the math and use the calculator to compute the final result."*
