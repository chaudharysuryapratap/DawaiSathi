const sensitiveAssignment =
  /\b(password|passwd|token|secret|authorization|api[_-]?key)\b(\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi;
const bearerCredential = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const jwtCredential = /\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;

export function sanitizeErrorMessage(message: string): string {
  return message
    .replace(bearerCredential, "Bearer [redacted]")
    .replace(jwtCredential, "[redacted]")
    .replace(sensitiveAssignment, "$1$2[redacted]")
    .trim();
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string") return sanitizeErrorMessage(error) || fallback;
  if (error instanceof Error) return sanitizeErrorMessage(error.message) || fallback;
  if (!error || typeof error !== "object") return fallback;

  try {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? sanitizeErrorMessage(message) || fallback : fallback;
  } catch {
    return fallback;
  }
}
