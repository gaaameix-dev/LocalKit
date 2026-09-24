import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/LocalKit/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "LocalKit",
        short_name: "LocalKit",
        description: "Private offline-first supertools",
        start_url: "/LocalKit/",
        display: "standalone",
        background_color: "#f6f7fb",
        theme_color: "#0f172a",
        icons: [
          {
            src: "/LocalKit/icon.svg",
            sizes: "any",
            type: "image/svg+xml"
          }
        ]
      },
      workbox: {
        navigateFallback: "/LocalKit/index.html"
      }
    })
  ]
});
