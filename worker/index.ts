export interface Env {
  ASSETS: Fetcher;
}

const CSP_HEADER = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'none'",
  "frame-ancestors https://minipclab.com https://localairigs.com",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
].join("; ");

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const asset = await env.ASSETS.fetch(request);

    if (asset.status === 404) {
      return new Response("Not Found", { status: 404 });
    }

    const contentType = asset.headers.get("content-type") || "";
    const isHtml = contentType.includes("text/html");

    const response = new Response(asset.body, asset);

    if (isHtml) {
      response.headers.set("Content-Security-Policy", CSP_HEADER);
      response.headers.set("X-Content-Type-Options", "nosniff");
      response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
      response.headers.set("X-Frame-Options", "DENY");
    }

    return response;
  },
};
