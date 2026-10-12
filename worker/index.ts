// Production edge: static assets (SPA fallback is handled by wrangler's assets config) plus the
// /api/* proxy to Django. Keeps the trailing slash the API requires and stays same-origin so the
// session cookie keeps working. Equivalent of the dev proxy in vite.config.ts.
interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  API_ORIGIN: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      const path = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
      return fetch(new Request(`${env.API_ORIGIN}${path}${url.search}`, request));
    }
    return env.ASSETS.fetch(request);
  },
};
