// Refresh frequently-read public data before its short TTL expires.
// A cache hit never serves expired data: after expiry, readers wait for a
// fresh result. Failed background refreshes are swallowed only while the
// previous snapshot is still valid. Do not use for checkout/admin reads.
export function createRefreshAheadCache(loader, { ttlMs, refreshAheadMs = 0, now = Date.now } = {}) {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0 || !Number.isFinite(refreshAheadMs) ||
      refreshAheadMs < 0 || refreshAheadMs >= ttlMs) {
    throw new RangeError('Invalid public-cache freshness settings');
  }
  let snapshot = null;
  let pending = null;
  let revision = 0;

  const refresh = () => {
    if (pending) return pending;
    const generation = revision;
    let running;
    running = Promise.resolve().then(loader).then(
      (value) => {
        if (generation === revision) snapshot = { value, expires: now() + ttlMs };
        return value;
      }
    ).finally(() => {
      if (pending === running) pending = null;
    });
    pending = running;
    return running;
  };

  return {
    get() {
      const current = now();
      if (snapshot && current < snapshot.expires) {
        if (refreshAheadMs && current >= snapshot.expires - refreshAheadMs && !pending) {
          // A failed refresh must not generate an unhandled rejection.
          void refresh().catch(() => {});
        }
        return Promise.resolve(snapshot.value);
      }
      return refresh();
    },
    invalidate() {
      revision++;
      snapshot = null;
      pending = null;
    },
  };
}
