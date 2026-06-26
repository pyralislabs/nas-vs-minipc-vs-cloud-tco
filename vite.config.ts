import { defineConfig } from "vite";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: "src/widget",
  build: {
    outDir: resolve(__dirname, "dist/widget"),
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, "src/widget/embed.ts"),
      name: "TcoCompare",
      formats: ["es"],
      fileName: () => "embed.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
    target: "es2022",
    cssMinify: true,
    minify: "esbuild",
    sourcemap: false,
    cssCodeSplit: false,
  },
});
