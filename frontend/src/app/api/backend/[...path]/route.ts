import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };

// Best-effort per-process protection for the public demo proxy. This is not a
// distributed rate limiter; use a shared gateway/Redis limiter before customer use.
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 30;
const requestWindows = new Map<string, { startedAt: number; count: number }>();

function getClientKey(request: NextRequest) {
  // Vercel supplies this header. Treat it only as a rate-limit hint, never as auth.
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown-client";
}

function isRateLimited(request: NextRequest) {
  const now = Date.now();
  const key = getClientKey(request);
  const current = requestWindows.get(key);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    requestWindows.set(key, { startedAt: now, count: 1 });
    if (requestWindows.size > 2_000) {
      for (const [candidate, value] of requestWindows) {
        if (now - value.startedAt >= WINDOW_MS) requestWindows.delete(candidate);
      }
    }
    return false;
  }
  current.count += 1;
  return current.count > MAX_REQUESTS_PER_WINDOW;
}

async function proxy(request: NextRequest, context: RouteContext) {
  if (isRateLimited(request)) {
    return NextResponse.json(
      { detail: "Too many requests. Please wait a minute and try again." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const baseUrl = process.env.AGENTFAULT_API_URL?.replace(/\/+$/, "");
  const apiKey = process.env.AGENTFAULT_API_KEY;

  if (!baseUrl || !apiKey) {
    return NextResponse.json(
      {
        detail:
          "The AgentFault API is not configured. Set AGENTFAULT_API_URL and AGENTFAULT_API_KEY in the frontend hosting environment.",
      },
      { status: 503 },
    );
  }

  const { path } = await context.params;
  const allowedEndpoints = new Set(["health", "scenarios", "runs", "experiments"]);
  if (path.length !== 1 || !allowedEndpoints.has(path[0])) {
    return NextResponse.json({ detail: "Endpoint not found." }, { status: 404 });
  }
  const encodedPath = path.map((part) => encodeURIComponent(part)).join("/");
  const target = new URL(`${baseUrl}/${encodedPath}`);
  target.search = request.nextUrl.search;

  const headers = new Headers({
    Accept: request.headers.get("accept") ?? "application/json",
    "X-API-Key": apiKey,
  });
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  let body: string | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.text();
    if (body && body.length > 32_768) {
      return NextResponse.json({ detail: "Request body is too large." }, { status: 413 });
    }
  }

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const responseHeaders = new Headers();
    const upstreamType = upstream.headers.get("content-type");
    if (upstreamType) responseHeaders.set("content-type", upstreamType);
    responseHeaders.set("Cache-Control", "no-store");
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      { detail: "The AgentFault API could not be reached. Please retry in a moment." },
      { status: 502 },
    );
  }
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
