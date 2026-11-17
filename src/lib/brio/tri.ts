/**
 * Motor estatístico do GUERRA DE BRIO — TRI (Teoria de Resposta ao Item).
 *
 * PURO: sem I/O, sem rede, sem React. Testável com jiti.
 *
 * Modelo logístico de 3 parâmetros (3PL):
 *
 *     P(acerto | θ) = c + (1 − c) / (1 + e^(−a(θ − b)))
 *
 *   a = discriminação (quanto o item separa habilidades diferentes)
 *   b = dificuldade (θ em que a curva sobe; em logits)
 *   c = acerto casual (1/6 = 0,1667, pois há SEIS alternativas A–F)
 *   θ = habilidade do jogador (logits)
 *
 * A estimativa de θ é feita por EAP (Expected A Posteriori): integra a
 * posterior sobre uma grade de quadratura com prior N(0, 1). Isso é estável
 * em sessões curtas — diferente da máxima verossimilhança, que não converge
 * com poucas respostas (acertos/erros perfeitos).
 *
 * DUAS MÉTRICAS SEPARADAS (§5.5 do documento):
 *   • PONTUAÇÃO DA PARTIDA — quem ganha o duelo (ver duelo.ts).
 *   • ÍNDICE DE CONHECIMENTO — estimativa de habilidade (este arquivo).
 * O índice NUNCA é apresentado como QI oficial.
 */

import type { Dificuldade } from "./categorias";
import { ordemDificuldade } from "./categorias";

/** Parâmetros de um item. `provisorio` = ainda não calibrado pelo servidor. */
export interface ParametrosItem {
  a: number;
  b: number;
  c: number;
  provisorio: boolean;
}

/** 6 alternativas (A–F) → probabilidade de acerto por chute. */
export const ACERTO_CASUAL = 1 / 6;

/** Dificuldade declarada → `b` inicial (logits). Estimativa, não verdade. */
const B_INICIAL: Record<Dificuldade, number> = {
  facil: -1.5,
  intermediaria: -0.7,
  dificil: 0.0,
  avancada: 0.8,
  especialista: 1.7,
};

export const A_INICIAL = 1.0;

/** Parâmetros provisórios a partir da dificuldade declarada da questão. */
export function parametrosIniciais(dificuldade: Dificuldade): ParametrosItem {
  return { a: A_INICIAL, b: B_INICIAL[dificuldade], c: ACERTO_CASUAL, provisorio: true };
}

/** Aceita `b` vindo do banco (coluna numérica) e cai no inicial se ausente. */
export function parametrosDoBanco(
  dificuldade: Dificuldade,
  a: number | null | undefined,
  b: number | null | undefined,
  c: number | null | undefined,
  provisorio: boolean | null | undefined,
): ParametrosItem {
  const ini = parametrosIniciais(dificuldade);
  return {
    a: sanearA(a ?? ini.a),
    b: sanearB(b ?? ini.b),
    c: sanearC(c ?? ini.c),
    provisorio: provisorio ?? true,
  };
}

function sanearA(a: number): number {
  if (!Number.isFinite(a)) return A_INICIAL;
  return Math.min(2.5, Math.max(0.3, a));
}

function sanearB(b: number): number {
  if (!Number.isFinite(b)) return 0;
  return Math.min(4, Math.max(-4, b));
}

function sanearC(c: number): number {
  if (!Number.isFinite(c)) return ACERTO_CASUAL;
  return Math.min(0.35, Math.max(0.05, c));
}

/**
 * P(acerto | θ) no modelo 3PL.
 *   P = c + (1 − c) / (1 + e^(−a(θ − b)))
 * O expoente é NEGATIVO: sem o sinal, a curva fica invertida (a probabilidade
 * cairia conforme a habilidade sobe). θ = b ⇒ P = (c + 1)/2.
 */
export function probabilidadeAcerto(theta: number, item: ParametrosItem): number {
  const z = -item.a * (theta - item.b);
  // Guarda contra overflow de exp em θ muito extremo.
  const e = z > 40 ? Math.exp(40) : z < -40 ? Math.exp(-40) : Math.exp(z);
  return item.c + (1 - item.c) / (1 + e);
}

/** Informação de Fisher do item — usada para erro-padrão e para diagnóstico. */
export function informacaoItem(theta: number, item: ParametrosItem): number {
  const p = probabilidadeAcerto(theta, item);
  const denom = Math.max(1e-6, 1 - item.c);
  const num = item.a ** 2 * (p - item.c) ** 2 * (1 - p);
  return num / (p * denom ** 2);
}

export interface RespostaItem {
  item: ParametrosItem;
  acertou: boolean;
}

/** Grade de quadratura (θ de −4 a 4, passo 0,1) com prior N(0,1). */
const PASSO = 0.1;
const THETA_MIN = -4;
const THETA_MAX = 4;
const GRADE: number[] = Array.from(
  { length: Math.round((THETA_MAX - THETA_MIN) / PASSO) + 1 },
  (_, i) => THETA_MIN + i * PASSO,
);

function logPrior(theta: number): number {
  // N(0,1) — normalizações constantes não afetam o argmax/posterior relativa.
  return -0.5 * theta * theta;
}

export interface EstimativaHabilidade {
  /** Habilidade em logits (EAP). */
  theta: number;
  /** Desvio-padrão posterior (precisão da estimativa). */
  erroPadrao: number;
  /** Índice de Conhecimento 0–100 (escala da Cidadela). */
  indice: number;
  /** Quantas respostas entraram na estimativa. */
  n: number;
  /** Confiabilidade: 0–1, cresce com n e com a informação dos itens. */
  confiabilidade: number;
}

/** Converte θ (logits) → Índice de Conhecimento 0–100. */
export function thetaParaIndice(theta: number): number {
  return Math.min(100, Math.max(0, Math.round(50 + theta * 15)));
}

/** Converte Índice de Conhecimento → θ (inverso de thetaParaIndice). */
export function indiceParaTheta(indice: number): number {
  return (Math.min(100, Math.max(0, indice)) - 50) / 15;
}

/**
 * Estimativa EAP da habilidade a partir de um conjunto de respostas.
 * Sem respostas → prior puro (θ = 0, índice 50, confiabilidade 0).
 */
export function estimarHabilidade(respostas: RespostaItem[]): EstimativaHabilidade {
  if (respostas.length === 0) {
    return { theta: 0, erroPadrao: 1, indice: 50, n: 0, confiabilidade: 0 };
  }

  const logPost: number[] = [];
  let somaPeso = 0;
  let somaTheta = 0;
  let somaTheta2 = 0;

  for (const theta of GRADE) {
    let lp = logPrior(theta);
    for (const r of respostas) {
      const p = Math.min(1 - 1e-9, Math.max(1e-9, probabilidadeAcerto(theta, r.item)));
      lp += r.acertou ? Math.log(p) : Math.log(1 - p);
    }
    logPost.push(lp);
  }

  // Normaliza antes de exponenciar (evita underflow).
  const maxLp = Math.max(...logPost);
  const pesos = logPost.map((lp) => Math.exp(lp - maxLp));
  const total = pesos.reduce((a, b) => a + b, 0);

  for (let i = 0; i < GRADE.length; i += 1) {
    const w = (pesos[i] ?? 0) / total;
    const th = GRADE[i] ?? 0;
    somaPeso += w;
    somaTheta += w * th;
    somaTheta2 += w * th * th;
  }

  const theta = somaTheta / Math.max(1e-9, somaPeso);
  const variancia = Math.max(0, somaTheta2 / Math.max(1e-9, somaPeso) - theta * theta);
  const erroPadrao = Math.sqrt(variancia);

  // Confiabilidade = variância do prior explicada pela posterior, ajustada
  // pela quantidade de evidência (uma única resposta nunca é "confiável").
  const infoMedia =
    respostas.reduce((acc, r) => acc + informacaoItem(theta, r.item), 0) / respostas.length;
  const confiabilidade = Math.min(0.99, Math.max(0, 1 - erroPadrao) * (1 - 1 / (1 + infoMedia * respostas.length)));

  return {
    theta,
    erroPadrao,
    indice: thetaParaIndice(theta),
    n: respostas.length,
    confiabilidade: Number.isFinite(confiabilidade) ? confiabilidade : 0,
  };
}

/** Estimativa de habilidade restrita a uma área/disciplina (§5.3). */
export function estimarPorArea(
  respostas: Array<RespostaItem & { areaSlug: string }>,
): Record<string, EstimativaHabilidade> {
  const porArea = new Map<string, RespostaItem[]>();
  for (const r of respostas) {
    const lista = porArea.get(r.areaSlug);
    if (lista) lista.push({ item: r.item, acertou: r.acertou });
    else porArea.set(r.areaSlug, [{ item: r.item, acertou: r.acertou }]);
  }
  const saida: Record<string, EstimativaHabilidade> = {};
  for (const [area, lista] of porArea) saida[area] = estimarHabilidade(lista);
  return saida;
}

export interface RespostaCalibracao {
  /** Habilidade estimada do jogador que respondeu (logits). */
  theta: number;
  acertou: boolean;
}

export interface ResultadoCalibracao {
  item: ParametrosItem;
  /** Amostra usada (respostas válidas). */
  n: number;
  /** Proporção observada de acertos. */
  proporcao: number;
  /** Discriminação ponto-bisserial (correlação θ × acerto). */
  discriminacao: number;
  /** Item com comportamento suspeito (revisar ou retirar da avaliação). */
  suspeito: boolean;
  motivoSuspeita: string | null;
}

/**
 * Calibração de UM item (§5.4).
 *
 * Método: máxima verossimilhança por grade para `b` (com `a`/`c` correntes),
 * com SHRINKAGE para o valor provisório proporcional ao tamanho da amostra —
 * um item com poucas respostas NÃO é declarado calibrado. A discriminação é a
 * correlação ponto-bisserial entre a habilidade dos respondentes e o acerto.
 *
 * `K_MINIMO` é o mínimo de respostas para o item deixar de ser provisório.
 */
export const K_MINIMO = 30;
/** Constante de shrinkage: peso do valor provisório na amostra pequena. */
const K_SHRINK = 30;

export function calibrarItem(
  respostas: RespostaCalibracao[],
  atual: ParametrosItem,
): ResultadoCalibracao {
  const n = respostas.length;
  const acertos = respostas.filter((r) => r.acertou).length;
  const proporcao = n > 0 ? acertos / n : 0;

  if (n < 5) {
    return {
      item: { ...atual, provisorio: true },
      n,
      proporcao,
      discriminacao: 0,
      suspeito: false,
      motivoSuspeita: null,
    };
  }

  // ---- discriminação ponto-bisserial ----
  const mediaTheta = respostas.reduce((a, r) => a + r.theta, 0) / n;
  const varTheta = respostas.reduce((a, r) => a + (r.theta - mediaTheta) ** 2, 0) / n;
  let discriminacao = 0;
  if (varTheta > 1e-9 && proporcao > 0 && proporcao < 1) {
    const cov =
      respostas.reduce((a, r) => a + (r.theta - mediaTheta) * ((r.acertou ? 1 : 0) - proporcao), 0) /
      n;
    discriminacao = cov / Math.sqrt(varTheta * proporcao * (1 - proporcao));
  }
  const aNova = sanearA(
    (n / (n + K_SHRINK)) * (A_INICIAL + 1.6 * discriminacao) +
      (K_SHRINK / (n + K_SHRINK)) * atual.a,
  );

  // ---- dificuldade por máxima verossimilhança em grade ----
  let melhorB = atual.b;
  let melhorLl = -Infinity;
  for (let b = THETA_MIN; b <= THETA_MAX + 1e-9; b += PASSO) {
    const candidato: ParametrosItem = { a: aNova, b, c: atual.c, provisorio: true };
    let ll = 0;
    for (const r of respostas) {
      const p = Math.min(1 - 1e-9, Math.max(1e-9, probabilidadeAcerto(r.theta, candidato)));
      ll += r.acertou ? Math.log(p) : Math.log(1 - p);
    }
    if (ll > melhorLl) {
      melhorLl = ll;
      melhorB = b;
    }
  }
  const peso = n / (n + K_SHRINK);
  const bNova = sanearB(peso * melhorB + (1 - peso) * atual.b);

  // ---- diagnóstico de qualidade ----
  const limiarChute = Math.max(atual.c, ACERTO_CASUAL) - 0.03;
  let suspeito = false;
  let motivoSuspeita: string | null = null;
  if (proporcao < limiarChute && n >= K_MINIMO) {
    suspeito = true;
    motivoSuspeita = "acerto abaixo do esperado por chute (possível erro de gabarito)";
  } else if (discriminacao < -0.1 && n >= K_MINIMO) {
    suspeito = true;
    motivoSuspeita = "discriminação negativa (melhores jogadores erram mais)";
  }

  return {
    item: { a: aNova, b: bNova, c: sanearC(atual.c), provisorio: n < K_MINIMO },
    n,
    proporcao,
    discriminacao,
    suspeito,
    motivoSuspeita,
  };
}

/** Compara habilidades de dois jogadores na MESMA escala (§5.6). */
export function compararHabilidades(
  a: EstimativaHabilidade,
  b: EstimativaHabilidade,
): { diferenca: number; favoravel: "a" | "b" | "equilibrado"; confianca: number } {
  const diferenca = a.theta - b.theta;
  const ruido = Math.sqrt(a.erroPadrao ** 2 + b.erroPadrao ** 2);
  const z = ruido > 1e-9 ? Math.abs(diferenca) / ruido : 0;
  const favoravel = z < 1 ? "equilibrado" : diferenca > 0 ? "a" : "b";
  return { diferenca, favoravel, confianca: Math.min(1, z / 3) };
}

/** Rótulo textual do índice — nunca chamado de "QI". */
export function rotuloIndice(indice: number): string {
  if (indice >= 85) return "Domínio excepcional";
  if (indice >= 70) return "Domínio avançado";
  if (indice >= 58) return "Domínio consistente";
  if (indice >= 45) return "Domínio em formação";
  if (indice >= 35) return "Domínio inicial";
  return "Domínio a construir";
}

/** Ordem de dificuldade exportada para o seletor (evita import circular). */
export { ordemDificuldade };
