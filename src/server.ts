import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express, { Request, Response } from "express";
import { z } from "zod";

const app = express();
app.use(express.json());

const server = new McpServer({
    name: "gcp-calculator",
    version: "1.0.0",
});

// ── Tools ──────────────────────────────────────────────

server.tool(
    "add",
    "Add a list of numbers",
    { numbers: z.array(z.number()).describe("Numbers to add") },
    async ({ numbers }) => ({
        content: [{ type: "text", text: `Result: ${numbers.reduce((a, b) => a + b, 0)}` }],
    })
);

server.tool(
    "subtract",
    "Subtract from the first number",
    { numbers: z.array(z.number()).describe("First = base, rest subtracted") },
    async ({ numbers }) => ({
        content: [{ type: "text", text: `Result: ${numbers.reduce((a, b, i) => (i === 0 ? b : a - b), 0)}` }],
    })
);

server.tool(
    "multiply",
    "Multiply a list of numbers",
    { numbers: z.array(z.number()) },
    async ({ numbers }) => ({
        content: [{ type: "text", text: `Result: ${numbers.reduce((a, b) => a * b, 1)}` }],
    })
);

server.tool(
    "divide",
    "Divide the first number by the rest",
    { numbers: z.array(z.number()) },
    async ({ numbers }) => {
        if (numbers.slice(1).some((n) => n === 0))
            return { content: [{ type: "text", text: "Error: Division by zero" }] };
        return {
            content: [{ type: "text", text: `Result: ${numbers.reduce((a, b, i) => (i === 0 ? b : a / b), 1)}` }],
        };
    }
);

server.tool(
    "power",
    "Raise base to an exponent",
    { base: z.number(), exponent: z.number() },
    async ({ base, exponent }) => ({
        content: [{ type: "text", text: `Result: ${Math.pow(base, exponent)}` }],
    })
);

server.tool(
    "sqrt",
    "Square root of a number",
    { number: z.number() },
    async ({ number }) => {
        if (number < 0)
            return { content: [{ type: "text", text: "Error: Cannot sqrt a negative number" }] };
        return { content: [{ type: "text", text: `Result: ${Math.sqrt(number)}` }] };
    }
);

server.tool(
    "modulo",
    "Remainder of division",
    { dividend: z.number(), divisor: z.number() },
    async ({ dividend, divisor }) => ({
        content: [{ type: "text", text: `Result: ${dividend % divisor}` }],
    })
);

// ── SSE Transport ──────────────────────────────────────

const transports: Record<string, SSEServerTransport> = {};

app.get("/sse", async (req: Request, res: Response) => {
    const transport = new SSEServerTransport("/messages", res);
    transports[transport.sessionId] = transport;
    res.on("close", () => delete transports[transport.sessionId]);
    await server.connect(transport);
});

app.post("/messages", async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports[sessionId];
    if (!transport) { res.status(404).json({ error: "Session not found" }); return; }
    await transport.handlePostMessage(req, res);
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`MCP server running on :${PORT}`));