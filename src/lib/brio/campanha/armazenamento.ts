/**
 * Persistência local do progresso da campanha do Guerra de Brio.
 *
 * O progresso é do JOGADOR e do APARELHO: guarda em localStorage por usuário
 * (mesma decisão do "Meu Time" do Futebol, que também é local). Não cria
 * tabela nova nem autenticação paralela.
 *
 * Sem `window` (SSR) tudo devolve null/vazio — nunca quebra o render.
 */
import { CHAVE_CAMPANHA, normalizarCampanha } from "./motor";
import type { EstadoCampanha } from "./tipos";

function temStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

/** Chave por usuário: trocar de conta não herda o progresso do anterior. */
function chave(userId: string | null): string {
  return `${CHAVE_CAMPANHA}:${userId ?? "visitante"}`;
}

export function carregarCampanha(userId: string | null): EstadoCampanha | null {
  if (!temStorage()) return null;
  try {
    const bruto = window.localStorage.getItem(chave(userId));
    if (!bruto) return null;
    return normalizarCampanha(JSON.parse(bruto));
  } catch {
    // Estado corrompido não pode impedir de jogar: descarta e recomeça.
    return null;
  }
}

export function salvarCampanha(userId: string | null, estado: EstadoCampanha): void {
  if (!temStorage()) return;
  try {
    window.localStorage.setItem(chave(userId), JSON.stringify(estado));
  } catch {
    // Cota cheia ou modo privado: a campanha segue em memória nesta sessão.
  }
}

export function limparCampanha(userId: string | null): void {
  if (!temStorage()) return;
  try {
    window.localStorage.removeItem(chave(userId));
  } catch {
    /* nada a fazer */
  }
}
