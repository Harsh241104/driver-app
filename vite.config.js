import { defineConfig } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const frontendRoot = resolve(projectRoot, "frontend");

export default defineConfig({
  root: frontendRoot,
  server: {
    proxy: {
      "/api": "http://localhost:3001",
      "/driver": "http://localhost:3001"
    }
  },
  build: {
    outDir: resolve(projectRoot, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        app: resolve(frontendRoot, "index.html"),
        login: resolve(frontendRoot, "login.html"),
        register: resolve(frontendRoot, "register.html"),
        earnings: resolve(frontendRoot, "earnings.html")
      }
    }
  }
});
