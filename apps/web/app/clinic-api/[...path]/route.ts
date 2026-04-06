import { assertWebProductionConfig, getInternalApiBaseUrl } from "../../../lib/env";

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

function buildTargetUrl(path: string[], search: string): string {
  const pathname = path.join("/");
  return `${getInternalApiBaseUrl()}/${pathname}${search}`;
}

async function proxyRequest(
  request: Request,
  context: RouteContext
): Promise<Response> {
  assertWebProductionConfig();

  const url = new URL(request.url);
  const { path } = await context.params;
  const targetUrl = buildTargetUrl(path, url.search);
  const headers = new Headers();

  request.headers.forEach((value, key) => {
    if (["host", "content-length"].includes(key.toLowerCase())) {
      return;
    }
    headers.set(key, value);
  });

  headers.set("x-forwarded-host", url.host);
  headers.set("x-forwarded-proto", url.protocol.replace(":", ""));

  const method = request.method.toUpperCase();
  const body =
    method === "GET" || method === "HEAD"
      ? undefined
      : await request.arrayBuffer();

  const upstream = await fetch(targetUrl, {
    method,
    headers,
    body
  });

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      return;
    }
    responseHeaders.set(key, value);
  });

  const setCookies =
    (upstream.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  for (const value of setCookies) {
    responseHeaders.append("set-cookie", value);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders
  });
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  return proxyRequest(request, context);
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  return proxyRequest(request, context);
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  return proxyRequest(request, context);
}

export async function PUT(request: Request, context: RouteContext): Promise<Response> {
  return proxyRequest(request, context);
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  return proxyRequest(request, context);
}

export async function HEAD(request: Request, context: RouteContext): Promise<Response> {
  return proxyRequest(request, context);
}
