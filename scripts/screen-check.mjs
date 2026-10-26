/** AI Tools PAK — read-only browser audit. Never submits an order or edits data. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'screen-test-results');
fs.mkdirSync(output, { recursive: true });
const base = (process.env.SITE_URL || 'http://localhost:5000').replace(/\/$/, '');
const widths = [320, 360, 375, 390, 430, 600, 768, 820, 1024, 1280, 1440, 1920];
const paths = ['/', '/products', '/ai-tools', '/creative-tools', '/discounts', '/product/chatgpt-plus', '/product/chatgpt-plus/reviews', '/checkout', '/customer-faq', '/admin', '/compare'];
const results = [];
let browser;
try {
  const { chromium } = await import('playwright');
  try { browser = await chromium.launch({ channel: 'msedge', headless: true }); }
  catch (err) {
    try { browser = await chromium.launch({ channel: 'chrome', headless: true }); }
    catch { throw new Error('Microsoft Edge or Chrome is required for testing. ' + err.message); }
  }
  const res = await fetch(base, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`Website returned HTTP ${res.status} at ${base}`);
  console.log(`Testing ${base} on ${widths.length} viewport widths and ${paths.length} routes ...`);
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1, isMobile: false });
    const page = await context.newPage();
    let pageErrors = [];
    page.on('pageerror', e => pageErrors.push(String(e).slice(0, 350)));
    for (const route of paths) {
      pageErrors = [];
      let data = { width, route, status: 'PASS', errors: [] };
      try {
        const response = await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(350);
        const state = await page.evaluate(() => {
          const doc = document.documentElement;
          const width = window.innerWidth;
          const overflow = Math.max(doc.scrollWidth, document.body?.scrollWidth || 0) - width;
          const offenders = overflow > 2 ? [...document.querySelectorAll('body *')].filter(el => {
            const r = el.getBoundingClientRect();
            if (!r.width || r.width > 7000) return false;
            const style = getComputedStyle(el);
            return r.right > width + 2 && style.position !== 'fixed' && style.visibility !== 'hidden' && style.display !== 'none';
          }).slice(0, 6).map(el => el.tagName.toLowerCase() + '.' + String(el.className || '').slice(0, 75)) : [];
          return { screen: width, scrollWidth: doc.scrollWidth, bodyWidth: document.body?.scrollWidth, overflow, heading: document.querySelector('h1')?.textContent?.trim()?.slice(0, 100) || '', offenders };
        });
        data = { ...data, ...state, http: response?.status() };
        if ((response?.status() || 0) >= 400) data.errors.push(`HTTP ${response.status()}`);
        if (!state.heading) data.errors.push('No h1 heading rendered');
        if (state.overflow > 2) data.errors.push(`Horizontal page overflow: ${state.overflow}px`);
        if (pageErrors.length) data.errors.push(...pageErrors);
        if (route === '/') {
          await page.screenshot({ path: path.join(output, `home-${width}.png`), fullPage: true, animations: 'disabled' });
          const menu = page.getByRole('button', { name: 'Toggle menu' });
          const visible = await menu.isVisible().catch(() => false);
          if (width < 1280 && !visible) data.errors.push('Mobile navigation toggle not visible');
          if (width >= 1280 && visible) data.errors.push('Mobile navigation toggle remains visible on desktop');
          if (visible) {
            await menu.click();
            if (!(await page.getByRole('button', { name: 'Toggle menu' }).getAttribute('aria-expanded') === 'true')) data.errors.push('Mobile menu failed to open');
            await menu.click();
          }
          const cart = page.getByRole('button', { name: 'Cart', exact: true });
          if (await cart.count()) {
            await cart.click();
            if (!(await page.getByRole('heading', { name: 'Your Cart' }).isVisible())) data.errors.push('Cart drawer did not open');
            await page.getByRole('button', { name: 'Close cart' }).click();
          }
        }
      } catch (e) { data.errors.push(String(e).slice(0, 400)); }
      data.status = data.errors.length ? 'CHECK' : 'PASS';
      results.push(data);
      process.stdout.write(data.status === 'PASS' ? '.' : 'X');
    }
    console.log(` ${width}px`);
    await context.close();
  }
} catch (err) {
  console.error('Browser test could not start:', err.message);
  fs.writeFileSync(path.join(output, 'SETUP-ERROR.txt'), err.stack || err.message);
  process.exitCode = 1;
} finally { await browser?.close(); }
const flagged = results.filter(r => r.errors?.length);
fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ url: base, date: new Date().toISOString(), widthList: widths, testedRoutes: paths, total: results.length, checksNeeded: flagged.length, results }, null, 2));
const quote = s => '"' + String(s ?? '').replace(/"/g, '""') + '"';
fs.writeFileSync(path.join(output, 'report.csv'), ['width,route,status,horizontalOverflow,heading,errors', ...results.map(r => [r.width, quote(r.route), r.status, r.overflow ?? '', quote(r.heading), quote((r.errors || []).join(' | '))].join(','))].join('\n'));
console.log(`\nChecked ${results.length} screen/route combinations. ${flagged.length} flagged for review.`);
console.log(`Results: ${output}`);
if (flagged.length) process.exitCode = 1;
