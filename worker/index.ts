// Production edge for the vendor portal: static assets + the /api proxy to Django.
// Replaces the OpenNext Worker + Next middleware. The proxy keeps the trailing slash Django needs
// and stays same-origin, so the session cookie behaves exactly as before.
interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  API_ORIGIN: string;
}

const BASE = "/vendor";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === BASE) {
      return Response.redirect(`${url.origin}${BASE}/`, 302);
    }
    if (url.pathname.startsWith(`${BASE}/api/`)) {
      // /vendor/api/x -> API_ORIGIN/api/x/
      const rest = url.pathname.slice(BASE.length);
      const path = rest.endsWith("/") ? rest : `${rest}/`;
      return fetch(new Request(`${env.API_ORIGIN}${path}${url.search}`, request));
    }
    const asset = await env.ASSETS.fetch(request);
    if (asset.status === 404 && request.method === "GET" && url.pathname.startsWith(BASE)) {
      // client-side route under /vendor: serve the app shell
      return env.ASSETS.fetch(new Request(new URL(`${BASE}/index.html`, url), request));
    }
    return asset;
  },
};
