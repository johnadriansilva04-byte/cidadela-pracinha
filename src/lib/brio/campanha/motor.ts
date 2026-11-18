/**
 * MOTOR da campanha do Guerra de Brio (modo história).
 *
 * PURO: sem I/O, sem React, sem alias "@/". Testável com jiti.
 *
 * O motor NÃO reimplementa o duelo: monta a configuração do ato e entrega para
 * `criarPartidaLocal` (o mesmo motor do adversário virtual). A campanha é uma
 * camada narrativa sobre o jogo que já existe.
 */
import { atoPorId, ATOS, VERSAO_CAMPANHA } from "./atos";
import { referenciaPorId } from "./referencias";
import {
  PROTAGONISTA_PADRAO,
  TRACOS_ZERO,
  type Ato,
  type Cena,
  type DueloDoAto,
  type EscolhaCena,
  type EstadoCampanha,
  type ProgressoAto,
  type Protagonista,
  type ReferenciaCampanha,
  type SituacaoAto,
  type TracosCarater,
} from "./tipos";

export const CHAVE_CAMPANHA = "brio:campanha:v1";

/** Estado inicial: ato 1, primeira cena, traços zerados. */
export function campanhaInicial(protagonista?: Partial<Protagonista>): EstadoCampanha {
  const p: Protagonista = {
    nome: protagonista?.nome?.trim() || PROTAGONISTA_PADRAO.nome,
    posto: protagonista?.posto?.trim() || PROTAGONISTA_PADRAO.posto,
    apresentacao: protagonista?.apresentacao?.trim() || PROTAGONISTA_PADRAO.apresentacao,
  };
  const primeiro = ATOS[0];
  return {
    versao: VERSAO_CAMPANHA,
    protagonista: p,
    atoAtual: primeiro?.id ?? "ato-1",
    cenaAtual: 0,
    concluidos: {},
    escolhas: {},
    tracos: { ...TRACOS_ZERO },
    historicoPerguntas: [],
    iniciadaEm: null,
    atualizadaEm: null,
  };
}

/** A campanha foi começada? (iniciadaEm marcado) */
export function campanhaIniciada(e: EstadoCampanha | null): boolean {
  return !!e?.iniciadaEm;
}

/**
 * Sanitiza estado vindo do armazenamento. Nunca confia no que veio:
 * ids de ato inexistentes, índices fora de faixa e traços não-numéricos são
 * corrigidos em vez de derrubar a campanha.
 */
export function normalizarCampanha(bruto: unknown): EstadoCampanha | null {
  if (!bruto || typeof bruto !== "object") return null;
  const o = bruto as Record<string, unknown>;
  const base = campanhaInicial(
    typeof o["protagonista"] === "object" && o["protagonista"]
      ? (o["protagonista"] as Partial<Protagonista>)
      : undefined,
  );

  const ato = typeof o["atoAtual"] === "string" && atoPorId(o["atoAtual"]) ? o["atoAtual"] : base.atoAtual;
  const cenas = atoPorId(ato)?.cenas.length ?? 1;
  const cenaBruta = typeof o["cenaAtual"] === "number" ? o["cenaAtual"] : 0;
  const cenaAtual = Math.min(Math.max(0, Math.trunc(cenaBruta)), Math.max(0, cenas - 1));

  const concluidos: Record<string, number> = {};
  if (o["concluidos"] && typeof o["concluidos"] === "object") {
    for (const [k, v] of Object.entries(o["concluidos"] as Record<string, unknown>)) {
      if (atoPorId(k) && typeof v === "number" && Number.isFinite(v)) concluidos[k] = Math.max(0, Math.trunc(v));
    }
  }

  const escolhas: Record<string, string> = {};
  if (o["escolhas"] && typeof o["escolhas"] === "object") {
    for (const [k, v] of Object.entries(o["escolhas"] as Record<string, unknown>)) {
      if (typeof v === "string") escolhas[k] = v;
    }
  }

  const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? Math.max(0, Math.trunc(x)) : 0);
  const t = (o["tracos"] ?? {}) as Record<string, unknown>;
  const tracos: TracosCarater = {
    rigor: num(t["rigor"]),
    empatia: num(t["empatia"]),
    coragem: num(t["coragem"]),
  };

  const historico = Array.isArray(o["historicoPerguntas"])
    ? (o["historicoPerguntas"] as unknown[]).filter((x): x is string => typeof x === "string").slice(-500)
    : [];

  return {
    versao: VERSAO_CAMPANHA,
    protagonista: base.protagonista,
    atoAtual: ato,
    cenaAtual,
    concluidos,
    escolhas,
    tracos,
    historicoPerguntas: historico,
    iniciadaEm: typeof o["iniciadaEm"] === "string" ? o["iniciadaEm"] : null,
    atualizadaEm: typeof o["atualizadaEm"] === "string" ? o["atualizadaEm"] : null,
  };
}

/** Marca o início da campanha (idempotente). */
export function iniciarCampanha(e: EstadoCampanha, agora: string): EstadoCampanha {
  return {
    ...e,
    iniciadaEm: e.iniciadaEm ?? agora,
    atualizadaEm: agora,
  };
}

/** Ato atual e a cena atual. */
export function atoAtualDe(e: EstadoCampanha): Ato | null {
  return atoPorId(e.atoAtual);
}

export function cenaAtualDe(e: EstadoCampanha): Cena | null {
  const ato = atoAtualDe(e);
  if (!ato) return null;
  return ato.cenas[e.cenaAtual] ?? null;
}

/** Referência que sustenta a cena atual (null quando a cena não afirma nada). */
export function referenciaDaCena(cena: Cena | null): ReferenciaCampanha | null {
  return referenciaPorId(cena?.referenciaId);
}

/**
 * Aplica uma escolha. Registra o histórico, soma os traços e devolve o texto
 * da consequência — que a UI mostra antes de avançar.
 *
 * NÃO avança a cena: quem decide avançar é o jogador (ler a consequência
 * primeiro é parte da experiência).
 */
export function escolher(
  e: EstadoCampanha,
  cena: Cena,
  escolhaId: string,
  agora: string,
): { estado: EstadoCampanha; escolha: EscolhaCena | null } {
  const escolha = cena.escolhas.find((c) => c.id === escolhaId) ?? null;
  if (!escolha) return { estado: e, escolha: null };

  const tracos: TracosCarater = {
    rigor: e.tracos.rigor + (escolha.efeito?.rigor ?? 0),
    empatia: e.tracos.empatia + (escolha.efeito?.empatia ?? 0),
    coragem: e.tracos.coragem + (escolha.efeito?.coragem ?? 0),
  };

  return {
    estado: {
      ...e,
      tracos,
      escolhas: { ...e.escolhas, [cena.id]: escolha.id },
      atualizadaEm: agora,
    },
    escolha,
  };
}

/** A escolha já registrada nesta cena (para restaurar a UI pós-F5). */
export function escolhaFeita(e: EstadoCampanha, cena: Cena): EscolhaCena | null {
  const id = e.escolhas[cena.id];
  if (!id) return null;
  return cena.escolhas.find((c) => c.id === id) ?? null;
}

/**
 * Avança uma cena. Ao passar da última cena do ato, NÃO conclui o ato: o ato
 * só é concluído pelo resultado do duelo (`concluirAto`). Devolve o novo estado
 * e se o duelo do ato deve ser aberto.
 */
export function avancarCena(
  e: EstadoCampanha,
  agora: string,
): { estado: EstadoCampanha; abrirDuelo: boolean; fimDaCampanha: boolean } {
  const ato = atoAtualDe(e);
  if (!ato) return { estado: e, abrirDuelo: false, fimDaCampanha: true };

  const ultima = e.cenaAtual >= ato.cenas.length - 1;
  if (!ultima) {
    return {
      estado: { ...e, cenaAtual: e.cenaAtual + 1, atualizadaEm: agora },
      abrirDuelo: false,
      fimDaCampanha: false,
    };
  }

  // Última cena do ato: o ato tem duelo?
  const cena = ato.cenas[e.cenaAtual];
  if (cena?.duelo) {
    return { estado: { ...e, atualizadaEm: agora }, abrirDuelo: true, fimDaCampanha: false };
  }

  // Ato sem duelo: conclui direto (o ato 1 fecha na cena com duelo, então isso
  // só vale para atos futuros sem prova).
  const concluido = concluirAto(e, ato.id, 0, agora);
  return { estado: concluido, abrirDuelo: false, fimDaCampanha: !proximoAto(ato) };
}

/** O duelo do ato (a última cena com duelo), ou null. */
export function dueloDoAto(ato: Ato): DueloDoAto | null {
  for (let i = ato.cenas.length - 1; i >= 0; i -= 1) {
    const d = ato.cenas[i]?.duelo;
    if (d) return d;
  }
  return null;
}

/**
 * Aplica o resultado do duelo do ato.
 *
 * O ato é concluído se o jogador atingiu `acertosMinimos`. Se não atingiu, ele
 * PODE repetir a prova — a campanha não trava por desempenho (mesma decisão do
 * modo carreira do Futebol: dívida e derrota são estados válidos, não becos).
 */
export function aplicarResultadoDuelo(
  e: EstadoCampanha,
  acertos: number,
  agora: string,
): { estado: EstadoCampanha; venceu: boolean; proximo: Ato | null } {
  const ato = atoAtualDe(e);
  if (!ato) return { estado: e, venceu: false, proximo: null };
  const cfg = dueloDoAto(ato);
  const minimo = cfg?.acertosMinimos ?? 0;
  const venceu = acertos >= minimo;
  if (!venceu) return { estado: { ...e, atualizadaEm: agora }, venceu: false, proximo: null };

  const estado = concluirAto(e, ato.id, acertos, agora);
  return { estado, venceu: true, proximo: proximoAto(ato) };
}

/** Marca o ato como concluído e posiciona o cursor no próximo. */
export function concluirAto(e: EstadoCampanha, atoId: string, acertos: number, agora: string): EstadoCampanha {
  const concluidos = { ...e.concluidos, [atoId]: acertos };
  const atual = atoPorId(atoId);
  const proximo = atual ? proximoAto(atual) : null;
  return {
    ...e,
    concluidos,
    atoAtual: proximo ? proximo.id : atoId,
    cenaAtual: proximo ? 0 : e.cenaAtual,
    atualizadaEm: agora,
  };
}

/** O ato seguinte na ordem da lista, ou null (fim da campanha). */
export function proximoAto(ato: Ato): Ato | null {
  return ATOS.find((a) => a.numero === ato.numero + 1) ?? null;
}

/** Registra as perguntas vistas num duelo (antirrepetição). */
export function registrarPerguntas(e: EstadoCampanha, ids: readonly string[], agora: string): EstadoCampanha {
  if (ids.length === 0) return e;
  const set = new Set([...e.historicoPerguntas, ...ids]);
  return {
    ...e,
    // Janela de histórico: mantém as últimas 500 para o estado não crescer sem fim.
    historicoPerguntas: [...set].slice(-500),
    atualizadaEm: agora,
  };
}

/** Progresso de todos os atos, para o painel da campanha. */
export function progressoDosAtos(e: EstadoCampanha): ProgressoAto[] {
  const indiceAtual = ATOS.findIndex((a) => a.id === e.atoAtual);
  return ATOS.map((ato, i) => {
    const acertos = e.concluidos[ato.id];
    let situacao: SituacaoAto;
    if (acertos !== undefined) situacao = "concluido";
    else if (i === indiceAtual) situacao = "atual";
    else situacao = i < indiceAtual ? "atual" : "bloqueado";
    return { ato, situacao, acertos: acertos ?? null };
  });
}

/** Percentual de conclusão da campanha (0-100). */
export function percentualCampanha(e: EstadoCampanha): number {
  if (ATOS.length === 0) return 0;
  const feitos = ATOS.filter((a) => e.concluidos[a.id] !== undefined).length;
  return Math.round((feitos / ATOS.length) * 100);
}

/** A campanha terminou? */
export function campanhaConcluida(e: EstadoCampanha): boolean {
  const ultimo = ATOS[ATOS.length - 1];
  return !!ultimo && e.concluidos[ultimo.id] !== undefined;
}

/**
 * Traço dominante do jogador — usado no fecho da campanha. Sem traço (empate),
 * devolve "equilibrado": não inventa personalidade que o jogador não mostrou.
 */
export function tracoDominante(t: TracosCarater): keyof TracosCarater | "equilibrado" {
  const entradas: Array<[keyof TracosCarater, number]> = [
    ["rigor", t.rigor],
    ["empatia", t.empatia],
    ["coragem", t.coragem],
  ];
  entradas.sort((a, b) => b[1] - a[1]);
  const primeiro = entradas[0];
  const segundo = entradas[1];
  if (!primeiro || !segundo) return "equilibrado";
  if (primeiro[1] === 0 || primeiro[1] === segundo[1]) return "equilibrado";
  return primeiro[0];
}

export const ROTULO_TRACO: Record<keyof TracosCarater | "equilibrado", string> = {
  rigor: "Rigor — você cobrou a fonte antes de aceitar a versão",
  empatia: "Empatia — você ouviu quem sofreu antes de teorizar",
  coragem: "Coragem civil — você discordou da versão conveniente",
  equilibrado: "Equilíbrio — você não deixou um só critério decidir por você",
};
