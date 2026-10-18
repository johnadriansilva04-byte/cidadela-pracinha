/**
 * Compila os testes .tsx/.ts (JSX + alias "@/" + imports do projeto) num
 * bundle CommonJS executável pelo Node puro, e roda.
 *
 * jiti não entende JSX e o projeto não tem tsx/esbuild — rolldown (já
 * instalado como bundler do Vite) resolve os dois.
 *
 * Uso: node testes/run-tsx.mjs testes/render-jogos.tsx
 */
import { build } from "rolldown";
import { fileURLToPath } from "node:url";
import path from "node:path";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const alvo = process.argv[2];
if (!alvo) {
  console.error("uso: node testes/run-tsx.mjs <arquivo.tsx>");
  process.exit(2);
}

const entrada = path.resolve(raiz, alvo);
const saida = path.join(raiz, ".tmp-teste.cjs");

await build({
  input: entrada,
  output: { file: saida, format: "cjs", sourcemap: false },
  platform: "node",
  resolve: {
    extensions: [".tsx", ".ts", ".jsx", ".js", ".json"],
    alias: { "@": path.join(raiz, "src") },
  },
  external: (id) => !id.startsWith(".") && !id.startsWith("/") && !id.startsWith("@/"),
  transform: { jsx: { runtime: "automatic" } },
  logLevel: "silent",
});

await import(path.join("file://", saida));
