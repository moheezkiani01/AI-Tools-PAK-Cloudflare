// Mouse-driven effects: card glow + tilt, magnetic buttons, hero depth.
// Keep hover targets stable at the edges so a moving card/button cannot cause flicker.
// Skipped on touch screens and for people who prefer reduced motion.
export function initMouseEffects() {
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};

  const EDGE_GRACE = 12; // Pixels the pointer can leave the resting hitbox without resetting hover.
  const clamp = (value, max) => Math.max(-max, Math.min(max, value));
  let tiltCard = null;
  let tiltBounds = null;
  let magnet = null;
  let magnetBounds = null;
  let frame = 0;
  let lastEvent = null;

  // Measure once before applying transforms. Measuring the tilted/moved box on
  // every move makes its edges oscillate under a stationary mouse pointer.
  const boundsOf = (element) => {
    const box = element.getBoundingClientRect();
    return {
      left: box.left + window.scrollX,
      top: box.top + window.scrollY,
      width: box.width,
      height: box.height,
    };
  };
  const near = (bounds, x, y, padding = 0) => !!bounds &&
    x >= bounds.left - padding && x <= bounds.left + bounds.width + padding &&
    y >= bounds.top - padding && y <= bounds.top + bounds.height + padding;

  const resetCard = () => {
    if (tiltCard) {
      tiltCard.classList.remove("is-hovered");
      tiltCard.style.removeProperty("--rx");
      tiltCard.style.removeProperty("--ry");
    }
    tiltCard = null;
    tiltBounds = null;
  };
  const resetMagnet = () => {
    if (magnet) magnet.style.translate = "";
    magnet = null;
    magnetBounds = null;
  };
  const resetAll = () => {
    resetCard();
    resetMagnet();
    const home = document.getElementById("home");
    home?.style.setProperty("--px", 0);
    home?.style.setProperty("--py", 0);
  };

  const onMove = (e) => {
    if (!e || e.pointerType === "touch") return;
    const x = e.clientX + window.scrollX;
    const y = e.clientY + window.scrollY;

    // Prefer the original, stationary hitbox until the pointer has genuinely
    // left it. A card can now lift/tilt without toggling hover on/off at its edge.
    const targetCard = e.target.closest?.(".card-hover");
    if (tiltCard && !near(tiltBounds, x, y, EDGE_GRACE)) resetCard();
    if (!tiltCard && targetCard) {
      tiltBounds = boundsOf(targetCard);
      tiltCard = targetCard;
      tiltCard.classList.add("is-hovered");
    }
    if (tiltCard && tiltBounds) {
      const localX = x - tiltBounds.left;
      const localY = y - tiltBounds.top;
      const relX = clamp((localX / tiltBounds.width - 0.5) * 2, 1);
      const relY = clamp((localY / tiltBounds.height - 0.5) * 2, 1);
      tiltCard.style.setProperty("--mx", `${localX}px`);
      tiltCard.style.setProperty("--my", `${localY}px`);
      tiltCard.style.setProperty("--ry", `${relX * 4}deg`);
      tiltCard.style.setProperty("--rx", `${-relY * 4}deg`);
    }

    // Magnetic buttons get the same stable resting hitbox, so they don't chase
    // the pointer back and forth at their borders.
    const targetButton = e.target.closest?.(".btn-primary, .btn-light");
    if (magnet && !near(magnetBounds, x, y, EDGE_GRACE)) resetMagnet();
    if (!magnet && targetButton && targetButton.offsetWidth < 300) {
      magnet = targetButton;
      magnetBounds = boundsOf(targetButton);
    }
    if (magnet && magnetBounds) {
      const dx = x - magnetBounds.left - magnetBounds.width / 2;
      const dy = y - magnetBounds.top - magnetBounds.height / 2;
      magnet.style.translate = `${clamp(dx * 0.2, 7)}px ${clamp(dy * 0.3, 5)}px`;
    }

    // Existing hero parallax is intentionally preserved.
    const home = document.getElementById("home");
    if (home) {
      const box = home.getBoundingClientRect();
      const inside = e.clientY >= box.top && e.clientY <= box.bottom;
      home.style.setProperty("--px", inside ? (e.clientX / innerWidth - 0.5) * 2 : 0);
      home.style.setProperty("--py", inside ? ((e.clientY - box.top) / box.height - 0.5) * 2 : 0);
    }
  };

  // Work at most once per screen refresh.
  const onMoveThrottled = (e) => {
    lastEvent = e;
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; onMove(lastEvent); });
  };
  document.addEventListener("pointermove", onMoveThrottled);
  document.documentElement.addEventListener("mouseleave", resetAll);
  window.addEventListener("scroll", resetAll, { passive: true });
  window.addEventListener("resize", resetAll);
  return () => {
    document.removeEventListener("pointermove", onMoveThrottled);
    document.documentElement.removeEventListener("mouseleave", resetAll);
    window.removeEventListener("scroll", resetAll);
    window.removeEventListener("resize", resetAll);
    if (frame) cancelAnimationFrame(frame);
    resetAll();
  };
}
