import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Đọc PORT từ server/.env để proxy trùng cổng Nest (mặc định 3173 trong main.ts).
  // Nếu cố định 3173 trong khi Nest chạy PORT khác (vd. 3000) → ECONNREFUSED.
  const serverEnv = loadEnv(mode, resolve(__dirname, '../server'), '');
  const apiPort = serverEnv.PORT || '3173';

  return {
    plugins: [react()],
    build: {
      outDir: resolve(__dirname, '../dist'),
      emptyOutDir: true,
      rollupOptions: {
        output: {
          // Vite's default heuristics were dumping React, antd, framer-motion,
          // axios, dayjs etc. into a single ~1.2MB chunk loaded on every page
          // (including /login). Splitting rarely-changing vendor code out
          // means a redeploy only invalidates the browser cache for the
          // (much smaller) app-code chunk, not this whole bundle.
          manualChunks: {
            // antd/@ant-design/icons are deliberately left out: Rollup's
            // default per-route/per-icon splitting already keeps most icons
            // out of the eager path, and forcing the whole package into one
            // static chunk pulled icons used only by lazy routes into the
            // eager bundle too, making the initial load bigger, not smaller.
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-query': ['@tanstack/react-query'],
            'vendor-motion': ['framer-motion'],
          },
        },
      },
    },
    server: {
      // Cho phép truy cập từ điện thoại / máy khác cùng WiFi (mặc định chỉ localhost)
      host: true,
      // Cố định 5174 (tránh đụng TokenWallet 5173): nếu cổng bị chiếm, báo lỗi thay vì nhảy bừa.
      port: 5174,
      strictPort: true,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});
