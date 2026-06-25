import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "crypto";
import express, { Request, Response } from "express";
import { z } from "zod";

const app = express();
app.use(express.json());

function createServer() {
    const server = new McpServer({
        name: "gcp-calculator",
        version: "1.0.0",
    });

    // ── Tools ──────────────────────────────────────────────

    server.registerTool(
        "add",
        {
            description: "Add a list of numbers",
            inputSchema: { numbers: z.array(z.number()).describe("Numbers to add") }
        },
        async ({ numbers }) => ({
            content: [{ type: "text", text: `Result: ${numbers.reduce((a, b) => a + b, 0)}` }],
        })
    );

    server.registerTool(
        "subtract",
        {
            description: "Subtract from the first number",
            inputSchema: { numbers: z.array(z.number()).describe("First = base, rest subtracted") }
        },
        async ({ numbers }) => ({
            content: [{ type: "text", text: `Result: ${numbers.reduce((a, b, i) => (i === 0 ? b : a - b), 0)}` }],
        })
    );

    server.registerTool(
        "multiply",
        {
            description: "Multiply a list of numbers",
            inputSchema: { numbers: z.array(z.number()) }
        },
        async ({ numbers }) => ({
            content: [{ type: "text", text: `Result: ${numbers.reduce((a, b) => a * b, 1)}` }],
        })
    );

    server.registerTool(
        "divide",
        {
            description: "Divide the first number by the rest",
            inputSchema: { numbers: z.array(z.number()) }
        },
        async ({ numbers }) => {
            if (numbers.slice(1).some((n) => n === 0))
                return { content: [{ type: "text", text: "Error: Division by zero" }] };
            return {
                content: [{ type: "text", text: `Result: ${numbers.reduce((a, b, i) => (i === 0 ? b : a / b), 1)}` }],
            };
        }
    );

    server.registerTool(
        "power",
        {
            description: "Raise base to an exponent",
            inputSchema: { base: z.number(), exponent: z.number() }
        },
        async ({ base, exponent }) => ({
            content: [{ type: "text", text: `Result: ${Math.pow(base, exponent)}` }],
        })
    );

    server.registerTool(
        "sqrt",
        {
            description: "Square root of a number",
            inputSchema: { number: z.number() }
        },
        async ({ number }) => {
            if (number < 0)
                return { content: [{ type: "text", text: "Error: Cannot sqrt a negative number" }] };
            return { content: [{ type: "text", text: `Result: ${Math.sqrt(number)}` }] };
        }
    );

    server.registerTool(
        "modulo",
        {
            description: "Remainder of division",
            inputSchema: { dividend: z.number(), divisor: z.number() }
        },
        async ({ dividend, divisor }) => ({
            content: [{ type: "text", text: `Result: ${dividend % divisor}` }],
        })
    );

    return server;
}

// ── SSE Transport ──────────────────────────────────────

const transports: Record<string, StreamableHTTPServerTransport> = {};

app.all("/mcp", async (req: Request, res: Response) => {
    try {
        const sessionId = req.headers["mcp-session-id"] as string;
        let transport: StreamableHTTPServerTransport;

        if (sessionId && transports[sessionId]) {
            transport = transports[sessionId];
        } else if (!sessionId && req.method === "POST" && isInitializeRequest(req.body)) {
            transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                onsessioninitialized: (sid) => {
                    transports[sid] = transport;
                },
            });

            transport.onclose = () => {
                const sid = transport.sessionId;
                if (sid && transports[sid]) {
                    delete transports[sid];
                }
            };

            const serverInstance = createServer();
            await serverInstance.connect(transport);
        } else {
            res.status(400).json({
                jsonrpc: "2.0",
                error: {
                    code: -32000,
                    message: "Bad Request: No valid session ID provided",
                },
                id: null,
            });
            return;
        }

        await transport.handleRequest(req, res, req.body);
    } catch (error) {
        console.error("Error handling MCP request:", error);
        if (!res.headersSent) {
            res.status(500).json({
                jsonrpc: "2.0",
                error: {
                    code: -32603,
                    message: "Internal server error",
                },
                id: null,
            });
        }
    }
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`MCP server running on :${PORT}`));