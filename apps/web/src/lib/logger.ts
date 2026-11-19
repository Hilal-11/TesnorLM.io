/**
 * Structured JSON logs. Document text, prompts, tokens, codes and keys are redacted by key name;
 * emails are masked. Never log secrets on purpose — this is the safety net.
 */
const REDACT =
  /^(content|markdown|prompt|text|chunk|apikey|api_key|authorization|password|token|code|otp|access_token|refresh_token|secret|cookie)$/i;

/** h***@gmail.com */
export function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  return `${user.slice(0, 1)}***@${domain}`;
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[deep]";
  if (typeof value === "string") {
    return value.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, (m) => maskEmail(m));
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        REDACT.test(k) ? "[redacted]" : redact(v, depth + 1),
      ]),
    );
  }
  return value;
}

type Level = "debug" | "info" | "warn" | "error";

function log(level: Level, msg: string, meta: Record<string, unknown> = {}) {
  const line = JSON.stringify({
    level,
    msg,
    time: new Date().toISOString(),
    ...(redact(meta) as object),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => log("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => log("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log("error", msg, meta),
};
