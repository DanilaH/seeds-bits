import { defineConfig } from "vite";
export default defineConfig(({ mode }) => ({
  base: "./",
  build: {
    outDir: mode === "yandex" ? "dist-yandex" : "dist",
    target: "es2022",
  },
  plugins: [
    {
      name: "yandex-sdk",
      transformIndexHtml(html) {
        return mode === "yandex"
          ? html.replace("</head>", '<script src="/sdk.js"></script></head>')
          : html;
      },
    },
  ],
}));
