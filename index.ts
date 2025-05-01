import { handle } from "hono/vercel";
import app from "./app";

const handler = handle(app);

export const GET = handler;
export const OPTIONS = handler;
