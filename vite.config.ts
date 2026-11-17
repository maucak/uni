import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
// .env içindeki PORT/WEB_PORT değerleri kabuğa aktarılmadan da okunur.
const env = { ...loadEnv("development", process.cwd(), ""), ...process.env };
export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(env.WEB_PORT || 5173),
    strictPort: true,
    proxy: { "/api": `http://127.0.0.1:${env.PORT || 3001}` },
  },
});
