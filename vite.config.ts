import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@client": path.resolve(__dirname, "src/client"),
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
      "/ws": { target: "ws://localhost:3000", ws: true, changeOrigin: true },
    },
  },
  build: {
    outDir: "dist/client",
    sourcemap: true,
    // 大 chunk 切分阈值降到 200KB，避免单 chunk 过大阻塞首屏
    chunkSizeWarningLimit: 250,
    rollupOptions: {
      output: {
        // 显式分块：react、router 单独拆，缓存命中更稳
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
});
