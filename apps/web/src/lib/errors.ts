import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { logger } from "@/lib/logger";

/** An error that is safe to show: `message` is written for the person, `code` for code. */
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export const badRequest = (message = "That request wasn't valid.", code = "bad_request") =>
  new AppError(code, message, 400);
export const unauthorized = (message = "Sign in to continue.") =>
  new AppError("unauthorized", message, 401);
export const forbidden = (message = "You don't have access to this.") =>
  new AppError("forbidden", message, 403);
export const notFound = (message = "We couldn't find that.") =>
  new AppError("not_found", message, 404);
export const rateLimited = (message = "Too many attempts. Try again in a minute.") =>
  new AppError("rate_limited", message, 429);
export const upstreamError = (
  message = "A service we rely on didn't respond. Try again shortly.",
) => new AppError("upstream", message, 502);

/** JSON error body { error, code }. Unknown errors never leak details. */
export function toErrorResponse(err: unknown, requestId?: string) {
  const headers = requestId ? { "x-request-id": requestId } : undefined;
  if (err instanceof AppError) {
    return Response.json({ error: err.message, code: err.code }, { status: err.status, headers });
  }
  return Response.json(
    { error: "We couldn't finish that. Try again in a moment.", code: "internal" },
    { status: 500, headers },
  );
}

type RouteHandler<C> = (request: Request, context: C) => Promise<Response>;

/** Route handler wrapper: request id, structured error logging, safe JSON errors. */
export function withErrorHandling<C>(route: string, handler: RouteHandler<C>): RouteHandler<C> {
  return async (request, context) => {
    const requestId = crypto.randomUUID();
    const started = Date.now();
    try {
      const response = await handler(request, context);
      response.headers.set("x-request-id", requestId);
      return response;
    } catch (err) {
      unstable_rethrow(err);
      if (!(err instanceof AppError) || err.status >= 500) {
        logger.error("request failed", {
          route,
          requestId,
          durationMs: Date.now() - started,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      return toErrorResponse(err, requestId);
    }
  };
}

/** Result of a server action: never throws to the client (redirects still work). */
export type ActionState<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | {
      ok: false;
      error: string;
      code: string;
      fieldErrors?: Record<string, string>;
      /** Fresh state the person should see instead (e.g. the latest row after a "conflict"). */
      data?: T;
    }
  | null;

/**
 * Server action with zod validation of FormData or a plain object, AppError → friendly result,
 * and Next.js redirects/notFound passed through.
 */
export function defineAction<S extends z.ZodType, T>(
  schema: S,
  run: (input: z.infer<S>) => Promise<ActionState<T> | void>,
) {
  return async (_prev: ActionState<T>, payload: FormData | z.input<S>): Promise<ActionState<T>> => {
    const raw = payload instanceof FormData ? Object.fromEntries(payload) : payload;
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        fieldErrors[key] ??= issue.message;
      }
      return {
        ok: false,
        error: "Check the highlighted fields.",
        code: "invalid_input",
        fieldErrors,
      };
    }
    try {
      return (await run(parsed.data)) ?? { ok: true };
    } catch (err) {
      unstable_rethrow(err);
      if (err instanceof AppError) return { ok: false, error: err.message, code: err.code };
      logger.error("action failed", { error: err instanceof Error ? err.message : String(err) });
      return {
        ok: false,
        error: "We couldn't finish that. Try again in a moment.",
        code: "internal",
      };
    }
  };
}
