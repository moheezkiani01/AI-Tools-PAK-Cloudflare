// Fast in-page navigation without a full reload.
export const navigate = (path) => {
  const next = new URL(path, window.location.href);
  if (next.origin !== window.location.origin) return;
  if (next.href === window.location.href) return;
  const samePage = next.pathname === window.location.pathname && next.search === window.location.search;
  history.pushState({}, "", next.pathname + next.search + next.hash);
  if (samePage && next.hash) {
    requestAnimationFrame(() => {
      document.getElementById(decodeURIComponent(next.hash.slice(1)))?.scrollIntoView({ behavior: "instant" });
    });
  } else {
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
};
