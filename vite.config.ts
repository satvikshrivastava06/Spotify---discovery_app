import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Standard Tauri + Vite pairing: a fixed dev server port (Tauri points at
// it directly rather than discovering it), and file-watching excludes
// src-tauri so a Rust rebuild doesn't also trigger a frontend HMR reload.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
