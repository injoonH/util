import { fileURLToPath, URL } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  optimizeDeps: {
    include: [
      "react",
      "react-dom/client",
      "react-resizable-panels",
      "react-markdown",
      "remark-gfm",
      "rehype-highlight",
      "jsonc-parser",
      "zod",
      "pdf-lib",
      "pdfjs-dist/legacy/build/pdf.mjs",
      "fflate",
    ],
  },
  server: { watch: { ignored: ["**/playwright-report/**", "**/test-results/**"] } },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
    },
  },
});
