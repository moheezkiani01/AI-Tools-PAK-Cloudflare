// Shared CDN caching ONLY for anonymous, identical read-only responses.
// Never call this for checkout, admin, customer-specific data, or errors.
// Vercel consumes s-maxage / stale-while-revalidate at the CDN; browsers
// revalidate instead of keeping an unchangeable local price snapshot.
export const publicCacheHeader = (seconds = 15, staleSeconds = 15) => {
  const ttl = Number.isFinite(seconds) ? Math.max(1, Math.min(60, Math.floor(seconds))) : 15;
  const stale = Number.isFinite(staleSeconds) ? Math.max(0, Math.min(60, Math.floor(staleSeconds))) : 15;
  return `public, max-age=0, s-maxage=${ttl}, stale-while-revalidate=${stale}`;
};

export function cachePublicResponse(res, seconds = 15, staleSeconds = 15) {
  res.set('Cache-Control', publicCacheHeader(seconds, staleSeconds));
  return res;
}
