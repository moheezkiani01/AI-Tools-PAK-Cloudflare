> **October 2026 catalog upgrade:** Read [UPGRADE_GUIDE.md](./UPGRADE_GUIDE.md) before applying the additive Supabase migration and importing supplier products.

# AI Tools PAK — GitHub + Vercel Hobby + Supabase Free

Study/demo website: React + Vite storefront, Node.js/Express serverless API, password-protected admin and **Supabase PostgreSQL** storage. No Upstash, no paid database, no credit card or domain purchase is required for the basic project. Custom cursor tails and bubble effects remain removed.

The project uses **Supabase Free + Vercel Hobby**. Vercel Hobby only permits **personal/non-commercial** projects; it is suitable for this study/demo project, not live paid subscription sales. Each platform has usage limits. Supabase Free may pause after about seven days of low activity; resume it from the Supabase dashboard if required.

## 1 — Create a Supabase database (free)

1. Open https://supabase.com/dashboard and sign up/log in.
2. **New project** → choose the **Free** plan. Wait until the project is ready.
3. Open **SQL Editor → New query**. Copy **all the content** of [`supabase/schema.sql`](supabase/schema.sql) and press **Run**. This is required; creating a project alone is not sufficient. You can rerun the SQL safely without deleting orders.
4. Copy the **Project URL** (`https://YOUR-PROJECT.supabase.co`) from the project's Connect dialog or Settings > API.
5. Copy an **API Secret key** (starts `sb_secret_`) from **Settings → API Keys**. This key is for the Node backend ONLY. **Never commit the key to GitHub, paste it in React code, or prefix it with `VITE_`.** You do **not** need the publishable/anon key for this project.

The SQL makes the data tables private with Row Level Security, and adds atomic Postgres functions for saving changes and throttling admin password attempts. The Express API is the only part that accesses the private database.

## 2 — Run the website yourself on Windows / VS Code

Install Node.js **22.x**, then extract the ZIP and open the `AI-Tools-PAK` folder in VS Code.

```bash
npm run setup
npm run dev
```

- Website: http://localhost:5173
- Admin: http://localhost:5173/admin
- Setup asks you to create a long (12+ character) admin password.
- By default, local development stores data privately in `server/db.json` without Supabase.
- To test the real Supabase database locally, open `server/.env` (created by `npm run setup`) and set `SUPABASE_URL` and `SUPABASE_SECRET_KEY`, then restart `npm run dev`. **Local operations will then use that cloud database**.
- Run `npm test` and `npm run build` to check the code. `npm run backup -- --cloud` downloads a private backup when the cloud variables are present.

## 3 — Push the files to your own GitHub repository

Create a **new empty** repository on https://github.com/new. In the extracted `AI-Tools-PAK` directory, use:

```bash
git init
git add .
git commit -m "Free Vercel and Supabase deployment"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/AI-Tools-PAK.git
git push -u origin main
```

Replace the GitHub URL. If the repo already has Git configured, skip `git init` and `git remote add`, and commit/push normally. `.gitignore` excludes secrets, customer data, backups, `dist`, `node_modules`, and Vercel local files.

## 4 — Deploy on Vercel's Hobby (free) plan

1. Go to https://vercel.com/new → Import your GitHub repository.
2. Choose **Hobby (free)** for your **personal, non-commercial study project**.
3. Root Directory: `./` (repository root, **not** `server`, `src` or `dist`). Framework: **Vite**. Node.js: **22.x**.
4. `vercel.json` supplies the installation command, build command, output folder, and serverless API routes. Usually you should not override these settings.
5. Add these **Environment Variables** before you deploy. They must be **server-side** settings, without the `VITE_` prefix:

   | Name | Value |
   | --- | --- |
   | `SUPABASE_URL` | `https://YOUR-PROJECT.supabase.co` |
   | `SUPABASE_SECRET_KEY` | `sb_secret_...` from Supabase API Keys → Secret keys |
   | `ADMIN_PASSWORD` | Your own unique admin password, **12+ characters** |
   | `SITE_URL` | Optional: your public site URL, once available |

6. Apply them to **Production**. If using Preview, consider leaving it disabled or use a separate Supabase free project to avoid test data modifying your live database.
7. Press **Deploy**. Every new `git push` will trigger another deployment.

**Note:** `ADMIN_PASSWORD` in your local `server/.env` is **not** automatically copied to Vercel. Set it separately in Vercel → Project → Settings → Environment Variables.

## 5 — Check your live website

Visit these URLs after deployment:

- `https://YOUR-SITE.vercel.app/` — homepage works.
- `https://YOUR-SITE.vercel.app/product/gemini-pro` — direct product link works.
- `https://YOUR-SITE.vercel.app/api/health` — must return JSON such as `{"ok":true,"storage":"supabase","orders":0}`.
- `https://YOUR-SITE.vercel.app/api/discounts` — returns JSON.
- `https://YOUR-SITE.vercel.app/admin` — log in with `ADMIN_PASSWORD`. Try an incorrect password as well.
- Change one price, description, discount or stock setting in admin; refresh to confirm the change persists.
- Place a **sample checkout**, then verify it appears in Admin → Website orders, and test changing its status. Don't enter real customer info for a demo.

If `/api/health` fails, **don't accept checkout submissions** until you fix it.

## Troubleshooting

| Error | Solution |
| --- | --- |
| `/api/health` is 503 and mentions credentials | Set **both** `SUPABASE_URL` and `SUPABASE_SECRET_KEY` on Vercel, then **Redeploy**. |
| 503 and mentions `schema.sql` | Open Supabase SQL Editor, run the whole `supabase/schema.sql` file, then retry. |
| Supabase HTTP 401/403 | Check the project's **Secret** key, not the publishable key, and check the URL. |
| `/api/health` is HTML/404 | Ensure `api/index.js` and `vercel.json` were pushed and Vercel root is `./`. |
| `Cannot find module 'express'` | Use the custom Install Command in `vercel.json` so the `server` packages install. |
| Build error | Use Node 22.x and include both `package-lock.json` files. Inspect the Vercel deployment logs. |
| Admin disabled | Set `ADMIN_PASSWORD` (12+ characters) in Vercel and redeploy. |
| Database stopped responding after inactivity | Free Supabase projects can be paused. Resume in Supabase dashboard. |
| Recent admin edit conflict (409) | Another update happened at the same time. Refresh and retry. |

## Important notes

- No Supabase keys are stored in this repository or frontend JavaScript. Your database connection lives only in the Node backend.
- Website changes, orders, reviews and discounts are persisted in one PostgreSQL `JSONB` record for simplicity. This is appropriate for a small study project, not a high-traffic relational-commerce platform.
- The SQL applies Row Level Security and grants access only to the backend's `service_role`.
- Use free subdomains like `YOUR-SITE.vercel.app`; a custom domain is optional and usually costs money.
- Vercel/Supabase free tier quotas and restrictions may change. A successful local test cannot guarantee Vercel and Supabase will never have outages.
- Keep `server/.env` private; export backups with `npm run backup -- --cloud` and store them somewhere safe. Supabase free does not offer automatic database backups.
