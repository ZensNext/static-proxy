// app.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { proxy } from "hono/proxy";

// helpers.ts
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z as z2 } from "zod";

// env.ts
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import { vercel } from "@t3-oss/env-core/presets-zod";
var env = createEnv({
  shared: {
    PORT: z.coerce.number().default(9527)
  },
  server: {
    S3_BUCKET: z.string().min(1),
    S3_REGION: z.string().min(1),
    S3_ACCESS_KEY: z.string().min(1),
    S3_SECRET_ACCESS_KEY: z.string().min(1),
    S3_ENDPOINT: z.string().min(1)
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  extends: [vercel()]
});

// s3.ts
import { S3Client } from "@aws-sdk/client-s3";
var s3Client = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  maxAttempts: 5,
  retryMode: "standard",
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY
  },
  forcePathStyle: true
});

// helpers.ts
function getUrl(filename, expires = 3600) {
  return getSignedUrl(s3Client, new GetObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: filename
  }), {
    expiresIn: expires
  });
}

// app.ts
var app = new Hono;
app.use(cors());
app.use(logger());
app.use(async (c, next) => {
  await next();
  c.res.headers.set("X-Accel-Buffering", "no");
});
app.get("/", (c) => c.text("A proxy for Zen.one static assets!"));
var fetchWithTimeout = async (url, { timeout, ...options }) => {
  const controller = new AbortController;
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeout);
  try {
    const res = await proxy(url, {
      ...options,
      signal: controller.signal,
      duplex: "half"
    });
    clearTimeout(timeoutId);
    return res;
  } catch (error) {
    clearTimeout(timeoutId);
    if (controller.signal.aborted) {
      return new Response("Request timeout", {
        status: 504
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
  const cloudflarePath = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  const signedUrl = await getUrl(cloudflarePath);
  const res = await fetchWithTimeout(signedUrl, {
    method: c.req.method,
    headers,
    body: c.req.raw.body,
    timeout: 60000
  });
  return new Response(res.body, {
    headers: res.headers,
    status: res.status
  });
});
var app_default = app;

// server.ts
import { serve } from "@hono/node-server";
var port = Number(env.PORT || "9527");
serve({
  fetch: app_default.fetch,
  port
});
console.log(`http://localhost:${port}`);
