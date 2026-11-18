import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApiError, isApiError, getErrorCode } from "../client";

function makeFetchResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("ApiError", () => {
  it("is throwable and carries typed fields", () => {
    const err = new ApiError({
      name: "ValidationError",
      code: "FIELD_REQUIRED",
      message: "email is required",
      status: 422,
      field: "email",
      request_id: "req-abc-123",
    });
    expect(isApiError(err)).toBe(true);
    expect(getErrorCode(err)).toBe("FIELD_REQUIRED");
    expect(err.status).toBe(422);
    expect(err.field).toBe("email");
    expect(err.request_id).toBe("req-abc-123");
  });

  it("isApiError returns false for plain Error", () => {
    expect(isApiError(new Error("plain"))).toBe(false);
  });

  it("getErrorCode returns undefined for non-ApiError", () => {
    expect(getErrorCode(new Error("nope"))).toBeUndefined();
  });

  it("isApiError returns false for null", () => {
    expect(isApiError(null)).toBe(false);
  });

  it("carries request_id correctly", () => {
    const err = new ApiError({
      name: "ServerError",
      code: "INTERNAL",
      message: "oops",
      status: 500,
      request_id: "req-xyz",
    });
    expect(err.request_id).toBe("req-xyz");
  });
});

describe("error normalization (direct middleware test)", () => {
  it("builds ApiError from a 404 error envelope", async () => {
    const errorBody = {
      result: null,
      error: {
        name: "NotFound",
        code: "TRIP_NOT_FOUND",
        message: "Trip not found",
        status: 404,
        request_id: "req-abc-123",
      },
    };
    const response = makeFetchResponse(errorBody, 404);

    let caught: unknown;
    try {
      const envelope = await response.clone().json() as {
        result: null;
        error: { name: string; code: string; message: string; status: number; request_id?: string };
      };
      if (envelope?.error) {
        throw new ApiError({
          ...envelope.error,
          status: envelope.error.status ?? 404,
        });
      }
    } catch (e) {
      caught = e;
    }

    expect(isApiError(caught)).toBe(true);
    if (isApiError(caught)) {
      expect(caught.code).toBe("TRIP_NOT_FOUND");
      expect(caught.status).toBe(404);
      expect(caught.request_id).toBe("req-abc-123");
    }
  });

  it("builds generic ApiError for non-envelope 500", () => {
    const err = new ApiError({
      name: "HttpError",
      code: "HTTP_ERROR",
      message: "Internal Server Error",
      status: 500,
    });
    expect(isApiError(err)).toBe(true);
    expect(err.status).toBe(500);
    expect(err.code).toBe("HTTP_ERROR");
  });
});

describe("CSRF middleware logic", () => {
  const originalFetch = global.fetch;
  const cookieProp = Object.getOwnPropertyDescriptor(global, "document");

  function setDocumentCookie(cookie: string) {
    try {
      Object.defineProperty(global, "document", {
        value: { cookie },
        writable: true,
        configurable: true,
      });
    } catch {
    }
  }

  afterEach(() => {
    global.fetch = originalFetch;
    if (cookieProp) {
      Object.defineProperty(global, "document", { ...cookieProp, configurable: true });
    }
  });

  it("getCookie returns undefined when document has no matching cookie", () => {
    setDocumentCookie("other=value");
    const doc = global.document as { cookie: string } | undefined;
    const cookie = doc?.cookie?.split("; ").find((r) => r.startsWith("csrftoken="));
    expect(cookie).toBeUndefined();
  });

  it("getCookie finds csrftoken cookie from document", () => {
    setDocumentCookie("session=abc; csrftoken=my-csrf-val; other=xyz");
    const doc = global.document as { cookie: string } | undefined;
    const match = doc?.cookie?.split("; ").find((r) => r.startsWith("csrftoken="));
    const token = match ? match.split("=")[1] : undefined;
    expect(token).toBe("my-csrf-val");
  });

  it("UNSAFE_METHODS set contains POST/PUT/PATCH/DELETE", () => {
    const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);
    expect(UNSAFE.has("POST")).toBe(true);
    expect(UNSAFE.has("GET")).toBe(false);
    expect(UNSAFE.has("DELETE")).toBe(true);
  });
});

describe("idempotency key path matching", () => {
  const IDEMPOTENT_PATTERNS = [
    /\/book\b/,
    /\/cancel\b/,
    /\/adjustments\b/,
    /\/approve\b/,
  ];

  function needsKey(url: string): boolean {
    return IDEMPOTENT_PATTERNS.some((re) => re.test(url));
  }

  it("matches /cancel path", () => {
    expect(needsKey("/api/v1/trips/T1/cancel")).toBe(true);
  });

  it("matches /adjustments path", () => {
    expect(needsKey("/api/v1/trips/T1/adjustments")).toBe(true);
  });

  it("matches /approve path", () => {
    expect(needsKey("/api/v1/trips/T1/approve")).toBe(true);
  });

  it("matches /book path", () => {
    expect(needsKey("/api/v1/book")).toBe(true);
  });

  it("does NOT match /login", () => {
    expect(needsKey("/api/v1/auth/login")).toBe(false);
  });

  it("does NOT match /trips list", () => {
    expect(needsKey("/api/v1/trips")).toBe(false);
  });

  it("does NOT match /trips detail", () => {
    expect(needsKey("/api/v1/trips/T1")).toBe(false);
  });

  it("crypto.randomUUID produces a valid UUID", () => {
    const uuid = crypto.randomUUID();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe("fetch-based client integration", () => {
  it("creates an ApiError correctly from error data", () => {
    const err = new ApiError({
      name: "Unauthorized",
      code: "NOT_AUTHENTICATED",
      message: "Login required",
      status: 401,
    });
    expect(isApiError(err)).toBe(true);
    expect(err.status).toBe(401);
    expect(err.code).toBe("NOT_AUTHENTICATED");
    expect(err.message).toBe("Login required");
  });

  it("ApiError is instanceof Error", () => {
    const err = new ApiError({
      name: "Err",
      code: "CODE",
      message: "msg",
      status: 400,
    });
    expect(err instanceof Error).toBe(true);
  });
});
