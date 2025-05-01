import { handle } from "hono/vercel";
import app from "./app";
import "dotenv/config";

const handler = handle(app);

export const GET = handler;
export const OPTIONS = handler;
