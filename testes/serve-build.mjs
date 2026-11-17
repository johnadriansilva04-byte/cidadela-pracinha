/**
 * Servidor do BUILD de produção para os testes E2E.
 *
 * Serve `.vercel/output/static` e delega as rotas SSR ao handler do Nitro
 * (`.vercel/output/functions/__server.func/index.mjs`). O `vite dev` não serve
 * atrás do proxy deste ambiente, por isso os E2E usam o build.
 *
 * Uso: node testes/serve-build.mjs [porta]
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { pathToFileURL } from "node:url";

const PORTA = Number(process.argv[2] ?? 3417);
const RAIZ = join(process.cwd(), ".vercel/output/static");
const HANDLER = join(process.cwd(), ".vercel/output/functions/__server.func/index.mjs");

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};

// O handler do Nitro exporta `default.fetch` (objeto com a função dentro).
const mod = await import(pathToFileURL(HANDLER).href);
const handlerFetch = mod.fetch ?? mod.default?.fetch ?? mod.default;

async function arquivoEstatico(caminho) {
  try {
    const alvo = join(RAIZ, caminho);
    // Impede escapar da raiz do build.
    if (!alvo.startsWith(RAIZ)) return null;
    const info = await stat(alvo);
    if (!info.isFile()) return null;
    return await readFile(alvo);
  } catch {
    return null;
  }
}

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORTA}`);

  // 1) Assets estáticos primeiro (rápido e evita SSR desnecessário).
  const estatico = await arquivoEstatico(decodeURIComponent(url.pathname));
  if (estatico) {
    res.writeHead(200, { "content-type": TIPOS[extname(url.pathname)] ?? "application/octet-stream" });
    res.end(estatico);
    return;
  }

  // 2) SSR pelo handler do Nitro.
  try {
    const corpo =
      req.method === "GET" || req.method === "HEAD" ? undefined : await lerCorpo(req);
    const resposta = await handlerFetch(
      new Request(url.href, {
        method: req.method,
        headers: req.headers,
        body: corpo,
      }),
    );
    const headers = {};
    resposta.headers.forEach((v, k) => {
      headers[k] = v;
    });
    res.writeHead(resposta.status, headers);
    const buffer = Buffer.from(await resposta.arrayBuffer());
    res.end(buffer);
  } catch (erro) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(`Erro no SSR: ${erro?.message ?? erro}`);
  }
});

function lerCorpo(req) {
  return new Promise((resolve) => {
    const pedacos = [];
    req.on("data", (c) => pedacos.push(c));
    req.on("end", () => resolve(Buffer.concat(pedacos)));
  });
}

servidor.listen(PORTA, () => {
  console.log(`build servido em http://localhost:${PORTA}`);
});
