import { serve } from "@hono/node-server";
import { env } from "./env";
import app from "./app";

// For running locally, use `vercel dev` to run index.ts
const port = Number(env.PORT || "9527");

serve({
  fetch: app.fetch,
  port,
});

console.log(`http://localhost:${port}`);
