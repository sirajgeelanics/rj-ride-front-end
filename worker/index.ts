// Production edge for the admin portal: static assets + the /api proxy to Django.
// Replaces the OpenNext Worker + Next middleware. The proxy keeps the trailing slash Django needs
// and stays same-origin, so the session cookie behaves exactly as before.
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
    return env.ASSETS.fetch(request); // wrangler's single-page-application fallback serves index.html
  },
};
