import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

test('extra cursor ring, trail, and bubbles are not loaded', () => {
  assert.doesNotMatch(app, /CursorEffects|showCursor/);
  assert.doesNotMatch(styles, /cursor-ring|cursor-dot/);
  assert.equal(existsSync(new URL('../src/components/CursorEffects.jsx', import.meta.url)), false);
});

test('decorative animations can run without reinstating mouse-driven effects', () => {
  assert.doesNotMatch(app, /initMouseEffects|IntersectionObserver\(\(entries\) => entries\.forEach/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /brand-marquee-loop/);
  assert.match(styles, /\.card-hover\.is-hovered/);
});
