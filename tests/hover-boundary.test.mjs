import test from 'node:test';
import assert from 'node:assert/strict';
import { initMouseEffects } from '../src/utils/mouseEffects.js';

function harness() {
  const documentEvents = new Map();
  const windowEvents = new Map();
  const properties = new Map();
  const classes = new Set();
  const card = {
    classList: { add: (v) => classes.add(v), remove: (v) => classes.delete(v), contains: (v) => classes.has(v) },
    style: { setProperty: (k, v) => properties.set(k, v), removeProperty: (k) => properties.delete(k) },
    getBoundingClientRect: () => classes.has('is-hovered')
      ? { left: 100, top: 96, width: 200, height: 200 } // simulated hover movement
      : { left: 100, top: 100, width: 200, height: 200 },
  };
  const buttonStyles = { translate: '' };
  const button = {
    offsetWidth: 100,
    style: buttonStyles,
    getBoundingClientRect: () => buttonStyles.translate
      ? { left: 198, top: 192, width: 100, height: 40 }
      : { left: 200, top: 200, width: 100, height: 40 },
  };
  const home = { style: { setProperty: () => {} }, getBoundingClientRect: () => ({ top: 9999, bottom: 10000, height: 1 }) };
  globalThis.document = {
    addEventListener: (name, callback) => documentEvents.set(name, callback),
    removeEventListener: (name) => documentEvents.delete(name),
    documentElement: {
      addEventListener: (name, callback) => documentEvents.set(name, callback),
      removeEventListener: (name) => documentEvents.delete(name),
    },
    getElementById: (id) => id === 'home' ? home : null,
  };
  globalThis.window = {
    scrollX: 0, scrollY: 0,
    addEventListener: (name, callback) => windowEvents.set(name, callback),
    removeEventListener: (name) => windowEvents.delete(name),
  };
  globalThis.innerWidth = 1440;
  globalThis.matchMedia = (q) => ({ matches: q.includes('hover: hover') });
  let pending = null;
  globalThis.requestAnimationFrame = (callback) => { pending = callback; return 1; };
  globalThis.cancelAnimationFrame = () => { pending = null; };
  const flush = () => { if (pending) { const fn = pending; pending = null; fn(); } };
  const target = (c = null, b = null) => ({ closest: (selector) => selector === '.card-hover' ? c : b });
  const move = (x, y, t = target()) => { documentEvents.get('pointermove')({ clientX: x, clientY: y, target: t, pointerType: 'mouse' }); flush(); };
  return { card, button, classes, properties, buttonStyles, documentEvents, windowEvents, move, target };
}

test('edge hover stays active as the moved card briefly leaves browser hit-testing', () => {
  const h = harness();
  const stop = initMouseEffects();
  h.move(299, 299, h.target(h.card));
  assert.equal(h.classes.has('is-hovered'), true);
  h.move(299, 299, h.target()); // Browser sees the original parent after card lifts 4px
  assert.equal(h.classes.has('is-hovered'), true, 'card should not jump back under the cursor');
  assert.ok(h.properties.has('--ry'), 'tilt animation remains active');
  h.move(316, 320, h.target()); // past the 12px stable-edge grace
  assert.equal(h.classes.has('is-hovered'), false);
  stop();
});

test('button magnetic motion remains stable at its edge', () => {
  const h = harness();
  const stop = initMouseEffects();
  h.move(298, 238, h.target(null, h.button));
  assert.notEqual(h.buttonStyles.translate, '');
  h.move(298, 238, h.target());
  assert.notEqual(h.buttonStyles.translate, '', 'magnet should not snap back at the edge');
  h.move(333, 259, h.target());
  assert.equal(h.buttonStyles.translate, '');
  stop();
});

test('leaving the browser clears hover and mouse handlers', () => {
  const h = harness();
  const stop = initMouseEffects();
  h.move(270, 240, h.target(h.card));
  assert.equal(h.classes.has('is-hovered'), true);
  h.documentEvents.get('mouseleave')();
  assert.equal(h.classes.has('is-hovered'), false);
  stop();
  assert.equal(h.documentEvents.has('pointermove'), false);
});
