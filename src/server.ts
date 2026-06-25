import { InMemoryEventStore } from "@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
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

// Map to store transports by session ID
const transports: { [sessionId: string]: NodeStreamableHTTPServerTransport } = {};

// MCP POST endpoint with optional auth
const mcpPostHandler = async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (sessionId) {
        console.log(`Received MCP request for session: ${sessionId}`);
    } else {
        console.log('Request body:', req.body);
    }


    try {
        let transport: NodeStreamableHTTPServerTransport;
        if (sessionId && transports[sessionId]) {
            // Reuse existing transport
            transport = transports[sessionId];
        } else if (!sessionId && isInitializeRequest(req.body)) {
            // New initialization request
            const eventStore = new InMemoryEventStore();
            transport = new NodeStreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                eventStore, // Enable resumability
                onsessioninitialized: (sessionId: string | number) => {
                    // Store the transport by session ID when session is initialized
                    // This avoids race conditions where requests might come in before the session is stored
                    console.log(`Session initialized with ID: ${sessionId}`);
                    transports[sessionId] = transport;
                }
            });

            // Set up onclose handler to clean up transport when closed
            transport.onclose = () => {
                const sid = transport.sessionId;
                if (sid && transports[sid]) {
                    console.log(`Transport closed for session ${sid}, removing from transports map`);
                    delete transports[sid];
                }
            };

            // Connect the transport to the MCP server BEFORE handling the request
            // so responses can flow back through the same transport
            const server = createServer();
            await server.connect(transport);

            await transport.handleRequest(req, res, req.body);
            return; // Already handled
        } else if (sessionId) {
            res.status(404).json({
                jsonrpc: '2.0',
                error: { code: -32_001, message: 'Session not found' },
                id: null
            });
            return;
        } else {
            res.status(400).json({
                jsonrpc: '2.0',
                error: { code: -32_000, message: 'Bad Request: Session ID required' },
                id: null
            });
            return;
        }

        // Handle the request with existing transport - no need to reconnect
        // The existing transport is already connected to the server
        await transport.handleRequest(req, res, req.body);
    } catch (error) {
        console.error('Error handling MCP request:', error);
        if (!res.headersSent) {
            res.status(500).json({
                jsonrpc: '2.0',
                error: {
                    code: -32_603,
                    message: 'Internal server error'
                },
                id: null
            });
        }
    }
};

app.all("/mcp", mcpPostHandler);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`MCP server running on :${PORT}`));