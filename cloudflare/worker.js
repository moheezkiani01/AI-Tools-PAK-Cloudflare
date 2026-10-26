// Cloudflare Workers entry point: same Express API + Cloudflare's static Vite assets.
// Official Cloudflare Express integration, requires a recent compatibility date.
// wrangler.jsonc routes /api/* here and serves other URLs from dist/.
import { httpServerHandler } from "cloudflare:node";
import app from "../server/index.js";

// The Express app is not auto-listening when CLOUDFLARE_WORKER=1.
// Only this Worker entry point starts the HTTP handler.
app.listen(3000);
export default httpServerHandler({ port: 3000 });
