/**
 * Serve o build de produção (.vercel/output) numa porta local.
 * O `vite dev` não hidrata atrás do proxy do work-host; o build sim.
 *
 * Uso: node testes/serve-build.mjs [porta]
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const porta = Number(process.argv[2] ?? 3417);
const estatico = path.join(raiz, ".vercel/output/static");
const handlerPath = path.join(raiz, ".vercel/output/functions/__server.func/index.mjs");

const { default: handler } = await import(handlerPath);
const fetchHandler = handler?.fetch ?? handler;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

async function arquivoEstatico(caminho) {
  try {
    const alvo = path.join(estatico, caminho);
    if (!alvo.startsWith(estatico)) return null;
    const info = await stat(alvo);
    if (!info.isFile()) return null;
    return { corpo: await readFile(alvo), tipo: MIME[path.extname(alvo)] ?? "application/octet-stream" };
  } catch {
    return null;
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const estaticoAchado = await arquivoEstatico(url.pathname);
  if (estaticoAchado) {
    res.writeHead(200, { "content-type": estaticoAchado.tipo });
    res.end(estaticoAchado.corpo);
    return;
  }

  const corpo = req.method === "GET" || req.method === "HEAD" ? undefined : await lerCorpo(req);
  const resposta = await fetchHandler(
    new Request(url, { method: req.method, headers: req.headers, body: corpo, duplex: "half" }),
  );
  res.writeHead(resposta.status, Object.fromEntries(resposta.headers));
  res.end(Buffer.from(await resposta.arrayBuffer()));
}).listen(porta, () => console.log(`servindo build em http://localhost:${porta}`));

function lerCorpo(req) {
  return new Promise((resolve) => {
    const partes = [];
    req.on("data", (c) => partes.push(c));
    req.on("end", () => resolve(Buffer.concat(partes)));
  });
}
