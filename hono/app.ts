import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { proxy } from "hono/proxy";
import { getUrl } from "./helpers";

const app = new Hono();

app.use(cors());

app.use(logger());

app.use(async (c, next) => {
  await next();
  c.res.headers.set("X-Accel-Buffering", "no");
});

app.get("/", (c) => c.text("A proxy for Zen.one static assets!"));

const fetchWithTimeout = async (
  url: string,
  { timeout, ...options }: RequestInit & { timeout: number }
) => {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    const res = await proxy(url, {
      ...options,
      signal: controller.signal,
      duplex: "half",
    });
    clearTimeout(timeoutId);
    return res;
  } catch (error) {
    clearTimeout(timeoutId);
    if (controller.signal.aborted) {
      return new Response("Request timeout", {
        status: 504,
      });
    }

    throw error;
  }
};

app.use(async (c) => {
  const url = new URL(c.req.url);
  const headers = new Headers(c.req.raw.headers);
  headers.delete("content-length");
  headers.delete("host");

  const { pathname } = url;
  const cloudflarePath = pathname.startsWith("/")
    ? pathname.slice(1)
    : pathname;
  const signedUrl = await getUrl(cloudflarePath);
  const res = await fetchWithTimeout(signedUrl, {
    method: c.req.method,
    headers,
    body: c.req.raw.body,
    timeout: 60000,
  });

  return new Response(res.body, {
    headers: res.headers,
    status: res.status,
  });
});

export default app;
