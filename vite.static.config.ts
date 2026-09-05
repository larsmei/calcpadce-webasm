import path from "node:path";
import { rmSync } from "node:fs";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  root: path.resolve("spa"),
  publicDir: path.resolve("public"),
  plugins: [
    tailwindcss(),
    viteReact(),
    {
      name: "strip-host-chrome",
      closeBundle() {
        rmSync(path.resolve("dist-web/__grok"), { recursive: true, force: true });
      },
    },
  ],
  resolve: {
    tsconfigPaths: true,
    alias: { "@": path.resolve("src") },
  },
  build: {
    outDir: path.resolve("dist-web"),
    emptyOutDir: true,
    assetsDir: "assets",
  },
});
