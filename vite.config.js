import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// In development, /api requests go to the Express server in /server
export default defineConfig({ plugins: [react(), tailwindcss()], server: { proxy: { "/api": "http://localhost:5000" } } });
