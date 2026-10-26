# AI Tools PAK — Cloudflare Workers + existing Supabase

This is a **PATCH** to your CURRENT AI-Tools-PAK checkout, not a standalone project.
It keeps the Vercel configuration and preserves your existing Supabase tables, products, orders, prices and admin features.

## Replace files once

1. Unzip the patch.
2. Copy ALL its files and folders (including the **new** `cloudflare/` directory and root `wrangler.jsonc`) into `C:\Users\hp\Desktop\AI-Tools-PAK`.
3. If Windows asks, choose **Replace files in destination**.
4. Do not delete `vercel.json`, `api/`, your existing project files, or your Supabase database.

## Your existing project has Vite/React + Express + Supabase

- Cloudflare Workers Static Assets hosts the full built frontend including pre-rendered collection/product pages.
- The single Cloudflare Worker serves `/api/*` via the same Express backend; no need for D1.
- Supabase stays the only production database. It is shared with Vercel if you use the same project URL and secret key.
- Your existing `npm run dev`, `npm test`, `npm run build` and Vercel setup still work.

## Easiest: test and deploy from your Windows terminal

Install prerequisites: Node 20+, Git, and an existing Cloudflare account.

```
cd C:\Users\hp\Desktop\AI-Tools-PAK
npm ci
npm --prefix server ci
npm test
npm run build
```

For **local** Cloudflare runtime testing, copy `.dev.vars.example` to `.dev.vars` and fill in your SAME Supabase URL and SAME secret key used on Vercel. The `.dev.vars` file is Git-ignored. Use a safe test database if you intend to submit test orders.

```
# Test the Cloudflare Worker locally on http://localhost:8787
npm run cloudflare:dev
```

Visit `http://localhost:8787/api/health` and verify `ok: true` and `storage: supabase`.
Do not deploy until the Worker health endpoint, product collection and admin login work locally.

For public deployment, login once:

```
npx --yes wrangler@4 login
```

Set all runtime secrets in Cloudflare Dashboard -> Workers & Pages -> your Worker -> Settings -> Variables and Secrets:

- `SUPABASE_URL` = your existing `https://PROJECT.supabase.co` (Text; not a secret unless you prefer)
- `SUPABASE_SECRET_KEY` = existing `sb_secret_...` **Secret** (not `VITE_...`)
- `ADMIN_PASSWORD` = the password you choose for this deployment **Secret**
- Optional SMTP settings: Cloudflare outbound SMTP compatibility has not been verified in this patch. Leave SMTP unset if you do not use email notifications.
- `CLOUDFLARE_WORKER=1` and `ORDER_STORAGE_V2=false` are already in `wrangler.jsonc`.

### First deploy / adding secrets

Cloudflare may need to create the Worker before its dashboard variables appear. You can first deploy **without opening it to customers**, then immediately set secrets, then deploy once more. With Supabase unconfigured, the app **fails closed** and cannot write local JSON orders.

```
npm run cloudflare:check
npm run cloudflare:deploy
```

The `cloudflare:check` command creates a dry-run bundle, not a live deployment.
Cloudflare returns a `https://ai-tools-pak.<account>.workers.dev` URL when deployed; use the exact URL it displays.

### Build-time SEO URL

Set `SITE_URL=https://your-real-cloudflare-domain` **in your local Windows terminal before `npm run build` / `npm run cloudflare:deploy`**, or as a **Build environment variable** for Cloudflare Git deployment. Otherwise the pre-render script uses the placeholder `https://YOUR-DOMAIN.com` and will warn. This is different from runtime secrets.

On Windows PowerShell:

```
$env:SITE_URL="https://your-actual-cloudflare-url.workers.dev"
npm run cloudflare:deploy
```

If using Cloudflare automatic Git deploy instead of terminal:
- Select **Workers & Pages -> Create -> Import a repository**; connect the SAME `moheezkiani01/AI-Tools-PAK` repo.
- Keep root directory as repository root.
- Build command: `npm ci --no-audit --no-fund && npm --prefix server ci --no-audit --no-fund && npm run build`
- Deploy command: `npx --yes wrangler@4 deploy`
- Add `SITE_URL` as a **Build variable** (its value is the Cloudflare production URL).
- Add your Supabase and admin secrets in the Worker's **Variables and Secrets** settings, then redeploy.
- A Cloudflare deploy does NOT require migrating or reinitializing any Supabase data.

## Production checks

1. Frontend opens; deep URL `/product/...` or `/tools/...` loads directly.
2. `https://YOUR-CLOUDFLARE-URL/api/health` returns `ok: true` and `storage: supabase`.
3. Product Catalogue shows all categories and grouped product cards. Open plans and pricing.
4. Admin login works. Check that admin pages, reviews, editing and orders load.
5. Review checkout inputs and totals without creating unnecessary real orders.
6. Check browser mobile layout and Cloudflare Worker logs for errors.

## Important limitations and precautions

- **Do not create a new Supabase project or run SQL migrations** just to deploy the same application. Using the same credentials is intentional, including shared orders.
- **Never** put `SUPABASE_SECRET_KEY` or `ADMIN_PASSWORD` in frontend env variables, GitHub or the `wrangler.jsonc` file.
- Worker memory/CPU caps and SMTP support differ from Vercel. This patch supplies a Workers-compatible Express entry, but the *actual Cloudflare Worker bundle and live API execution must still be verified* with `npm run cloudflare:check`, `cloudflare:dev`, and `/api/health`.
- If anything fails, keep your already-working Vercel deployment active; this patch does not remove it.
- Do not direct both production domains to Google Search index unless you set the proper canonical URL; use one primary domain for SEO.
