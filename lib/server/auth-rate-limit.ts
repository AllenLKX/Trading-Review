type RateLimitEntry = {
  count: number;
  resetsAt: number;
};

const buckets = new Map<string, RateLimitEntry>();

export function checkAuthRateLimit(request: Request, action: "login" | "register") {
  const now = Date.now();
  const windowMs = action === "login" ? 15 * 60 * 1000 : 60 * 60 * 1000;
  const limit = action === "login" ? 10 : 5;
  const key = `${action}:${readClientAddress(request)}`;
  const existing = buckets.get(key);

  if (!existing || existing.resetsAt <= now) {
    buckets.set(key, { count: 1, resetsAt: now + windowMs });
    pruneExpired(now);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((existing.resetsAt - now) / 1000)) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

function readClientAddress(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

function pruneExpired(now: number) {
  if (buckets.size < 500) return;
  for (const [key, entry] of buckets) {
    if (entry.resetsAt <= now) buckets.delete(key);
  }
  while (buckets.size > 1000) {
    const oldestKey = buckets.keys().next().value as string | undefined;
    if (!oldestKey) break;
    buckets.delete(oldestKey);
  }
}
