// A small in-memory limit for one server process.
// Cloud Run can run more than one instance, so this is a backstop, not a global quota.

type Bucket = { hits: number[] };

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 4000;

export function tooManyAttempts(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((at) => now - at < windowMs);
  if (bucket.hits.length >= limit) {
    buckets.set(key, bucket);
    return true;
  }
  bucket.hits.push(now);
  buckets.set(key, bucket);
  if (buckets.size > MAX_KEYS) {
    const oldest = buckets.keys().next().value;
    if (oldest) buckets.delete(oldest);
  }
  return false;
}
