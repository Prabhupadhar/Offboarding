import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// `--mode artifact` inlines everything into one HTML file so the prototype
// can be shared as a single page; the normal build stays multi-file.
export default defineConfig(({ mode }) => ({
  plugins: mode === "artifact" ? [react(), viteSingleFile()] : [react()],
  base: "./",
  build: { outDir: mode === "artifact" ? "dist-artifact" : "dist" },
}));
