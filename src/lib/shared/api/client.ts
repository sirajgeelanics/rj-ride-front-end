import createClient, { type Middleware } from "openapi-fetch";
import { uuidv4 } from "../uuid";
import type { paths } from "./schema.d";
import { BASE_PATH, apiUrl } from "./basePath";

export interface ApiErrorData {
  name: string;
  code: string;
  message: string;
  status: number;
  field?: string;
  request_id?: string;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly field?: string;
  readonly request_id?: string;

  constructor(data: ApiErrorData) {
    super(data.message);
    this.name = data.name;
    this.code = data.code;
    this.status = data.status;
    this.field = data.field;
    this.request_id = data.request_id;
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

export function getErrorCode(err: unknown): string | undefined {
  return isApiError(err) ? err.code : undefined;
}

// Must mirror the backend's opt-ins: IdempotencyMixin / idempotency_required = True, plus the
// billing actions that call _require_idempotency_key() directly. A path missing here fails at
// runtime with "This endpoint requires an Idempotency-Key header" — which is how `/adjustments`
// (plural) hid the fact that the real endpoint is `/adjust` (singular).
//
// `\b` matters: /\/offer\b/ matches `/trips/vehicles/{id}/offer` but NOT `/pricing/offers`,
// which is a plain quote call and needs no key.
const IDEMPOTENT_PATH_PATTERNS = [
  /\/book\b/, // partner book, ritmo/book
  /\/cancel\b/,
  /\/adjust\b/, // billing adjust (also covers /adjustments)
  /\/void\b/, // billing line void
  /\/approve\b/, // payout approve
  /\/mark-paid\b/, // payout mark-paid
  /\/run\b/, // payout run
  /\/offer\b/, // ops offers a slot to a vendor
  /\/accept\b/, // vendor accepts an offer
  /\/withdraw\b/, // ops withdraws an offer
  /\/bulk\/commit\b/,
];

function needsIdempotencyKey(url: string): boolean {
  return IDEMPOTENT_PATH_PATTERNS.some((re) => re.test(url));
}

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? match.split("=")[1] : undefined;
}

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

let csrfFetchPromise: Promise<void> | null = null;


async function ensureCsrfCookie(): Promise<void> {
  if (getCookie("csrftoken")) return;
  if (!csrfFetchPromise) {
    csrfFetchPromise = fetch(apiUrl("/api/v1/auth/csrf/"), {
      credentials: "include",
    }).then(
      () => { csrfFetchPromise = null; },
      () => { csrfFetchPromise = null; },
    );
  }
  await csrfFetchPromise;
}

/**
 * `fetch` drop-in for the handful of call sites that build requests by hand instead of
 * through `apiClient` (trip quote/book, bulk upload, clone, cancel, quote simulator).
 * It defaults `credentials: "include"` and — for unsafe methods — ensures the CSRF cookie
 * exists and attaches the `X-CSRFToken` header, exactly like `csrfMiddleware` does for the
 * typed client. Without it Django rejects those POSTs with 403 "CSRF token missing".
 */
export async function csrfFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (UNSAFE_METHODS.has(method)) {
    await ensureCsrfCookie();
    const token = getCookie("csrftoken");
    if (token && !headers.has("X-CSRFToken")) {
      headers.set("X-CSRFToken", token);
    }
  }
  // Callers pass root-relative paths ("/api/v1/vendor/offers/"), which need the basePath.
  // Request/URL objects are already absolute, so they are passed through untouched.
  const target = typeof input === "string" ? apiUrl(input) : input;
  return fetch(target, { credentials: "include", ...init, headers });
}

const csrfMiddleware: Middleware = {
  async onRequest({ request }) {
    if (!UNSAFE_METHODS.has(request.method)) return request;
    await ensureCsrfCookie();
    const token = getCookie("csrftoken");
    if (token) {
      const headers = new Headers(request.headers);
      headers.set("X-CSRFToken", token);
      return new Request(request, { headers });
    }
    return request;
  },
};

const idempotencyMiddleware: Middleware = {
  onRequest({ request }) {
    if (request.method !== "POST") return request;
    const url = new URL(request.url);
    if (!needsIdempotencyKey(url.pathname)) return request;
    const headers = new Headers(request.headers);
    if (!headers.has("Idempotency-Key")) {
      headers.set("Idempotency-Key", uuidv4());
    }
    return new Request(request, { headers });
  },
};

const trailingSlashMiddleware: Middleware = {
  async onRequest({ request }) {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/") || url.pathname.includes(".")) {
      return request;
    }
    url.pathname += "/";
    // NOTE: `new Request(newUrl, request)` silently drops the body of POST/PATCH
    // requests (the body ReadableStream is not transferable across a URL change
    // without `duplex`), which made the proxied write arrive body-less and fail
    // (503 at the Next rewrite proxy). Read the body first and rebuild the request
    // explicitly so the payload survives the trailing-slash rewrite.
    const hasBody = request.method !== "GET" && request.method !== "HEAD";
    const body = hasBody ? await request.arrayBuffer() : undefined;
    return new Request(url.toString(), {
      method: request.method,
      headers: request.headers,
      body,
      credentials: request.credentials,
      mode: request.mode,
      cache: request.cache,
      redirect: request.redirect,
      referrer: request.referrer,
      integrity: request.integrity,
      keepalive: request.keepalive,
      signal: request.signal,
    });
  },
};

const errorNormalizationMiddleware: Middleware = {
  async onResponse({ response }) {
    let text: string;
    try {
      text = await response.text();
    } catch {
      return response;
    }

    let envelope: { result: unknown; error: ApiErrorData | null } | null = null;
    try {
      envelope = JSON.parse(text);
    } catch {
    }

    if (!response.ok) {
      if (envelope?.error) {
        throw new ApiError({
          ...envelope.error,
          status: envelope.error.status ?? response.status,
        });
      }
      throw new ApiError({
        name: "HttpError",
        code: "HTTP_ERROR",
        message: response.statusText || `HTTP ${response.status}`,
        status: response.status,
      });
    }

    const body = (envelope && "result" in envelope)
      ? JSON.stringify(envelope.result)
      : text;

    return new Response(body, {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  },
};

export const apiClient = createClient<paths>({
  baseUrl: `${BASE_PATH}/api`,
  credentials: "include",
});

apiClient.use(trailingSlashMiddleware);
apiClient.use(csrfMiddleware);
apiClient.use(idempotencyMiddleware);
apiClient.use(errorNormalizationMiddleware);

export { apiClient as client };
export type { paths };
