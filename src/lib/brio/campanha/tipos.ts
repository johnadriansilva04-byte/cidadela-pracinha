/**
 * Tipos do MODO HISTÓRIA do Guerra de Brio — campanha narrativa.
 *
 * Módulo independente dentro do mesmo jogo: tem atos, roteiro e progressão
 * próprios, mas reutiliza o acervo, o motor de duelo (adversário virtual) e a
 * TRI do Guerra de Brio. Nenhuma plataforma nova.
 *
 * RIGOR HISTÓRICO: todo trecho que afirma algo sobre o passado carrega uma
 * `ClassificacaoFonte` (o mesmo vocabulário da história do Futebol, em
 * `components/botao/career/historia/types.ts`). O jogo NUNCA apresenta
 * hipótese como fato nem ficção como história.
 */
import type { Modalidade } from "../categorias";

export type ClassificacaoFonte =
  | "HISTORICAL_FACT"
  | "SECONDARY_SOURCE"
  | "HYPOTHESIS"
  | "FICTION"
  | "UNVERIFIED_CLAIM";

export const CLASSIFICACAO_LABEL: Record<ClassificacaoFonte, string> = {
  HISTORICAL_FACT: "Fato histórico",
  SECONDARY_SOURCE: "Fonte secundária",
  HYPOTHESIS: "Hipótese",
  FICTION: "Ficção do universo",
  UNVERIFIED_CLAIM: "Alegação não verificada",
};

/** Referência verificável que sustenta um trecho da campanha. */
export interface ReferenciaCampanha {
  id: string;
  titulo: string;
  resumo: string;
  fonte: string;
  classificacao: ClassificacaoFonte;
}

/** Identidade do protagonista — CONFIGURÁVEL pelo jogador. */
export interface Protagonista {
  /** Nome de guerra / como o pelotão o chama. */
  nome: string;
  /** Identidade que o jogador assume. */
  posto: string;
  /** Frase de apresentação (primeira pessoa). */
  apresentacao: string;
}

/**
 * Padrão do jogo: o pracinha expedicionário. Quem jogou a campanha do
 * Futebol já conhece o "Pracinha" como o NPC que convida para a Trilha —
 * aqui ele é o próprio jogador, o que amarra os dois módulos sem criar
 * personagem concorrente.
 */
export const PROTAGONISTA_PADRAO: Protagonista = {
  nome: "Pracinha",
  posto: "Soldado expedicionário da FEB",
  apresentacao:
    "Você embarcou para a Itália com o 6º Regimento de Infantaria. " +
    "Monte Castello, Montese, o frio, os companheiros. E então você acordou " +
    "— não num posto de socorro, mas aqui, num século que não é o seu.",
};

/** Uma escolha do jogador dentro de uma cena narrativa. */
export interface EscolhaCena {
  id: string;
  texto: string;
  /** Consequência narrativa (texto imediato). */
  resposta: string;
  /** Ajuste de traço de caráter (o perfil acumula ao longo da campanha). */
  efeito?: Partial<TracosCarater>;
  /** Concede uma "leitura" extra (revela a classificação da fonte). */
  revelaFonte?: boolean;
}

/** Traços de caráter acumulados pelas escolhas (não são pontos de herói). */
export interface TracosCarater {
  /** Rigor: cobrar a fonte antes de aceitar a versão. */
  rigor: number;
  /** Empatia: ouvir quem sofreu antes de teorizar. */
  empatia: number;
  /** Coragem civil: discordar de uma versão conveniente. */
  coragem: number;
}

export const TRACOS_ZERO: TracosCarater = { rigor: 0, empatia: 0, coragem: 0 };

/** Configuração do duelo de um ato — alimenta `criarPartidaLocal`. */
export interface DueloDoAto {
  /** Título do confronto (ex.: "Prova de História"). */
  titulo: string;
  modalidade: Modalidade;
  areaSlug: string | null;
  subcategoriaSlug: string | null;
  /** Nível do adversário virtual (1..4, como no duelo livre). */
  nivelAdversario: number;
  total: number;
  /** Acertos mínimos para o ato ser vencido. */
  acertosMinimos: number;
}

/**
 * CLIMA da cena — a atmosfera visual e sonora.
 *
 * O mesmo jogo não pode ter a mesma cara na Itália de 1944, no porão do navio
 * e na sala do tribunal. O clima é DADO do roteiro (não decisão do componente):
 * assim a direção de arte acompanha o texto em vez de brigar com ele.
 */
export type ClimaCena =
  /** Campo de batalha: fumaça, ferrugem, luz dura. */
  | "guerra"
  /** Deslocamento no tempo: instabilidade, azul frio, vertigem. */
  | "deslocamento"
  /** Século XXI visto por quem vem de fora: neon, excesso, ironia. */
  | "presente"
  /** Arquivo, documento, prova material: papel, poeira, luz de lâmpada. */
  | "arquivo"
  /** Porão de navio: escuridão total, som de casco, claustrofobia. */
  | "porao"
  /** Sala de aula/estudo racial: madeira, silêncio, o horror burocrático. */
  | "laboratorio"
  /** Tribunal: madeira escura, eco, luz vertical. */
  | "tribunal"
  /** Fecho: amanhecer contido, sem catarse fácil. */
  | "veredito";

/** Intensidade da ambiência sonora (0 desliga). */
export const CLIMA_AMBIENCIA: Record<ClimaCena, number> = {
  guerra: 0.5,
  deslocamento: 0.75,
  presente: 0.15,
  arquivo: 0.25,
  porao: 0.9,
  laboratorio: 0.6,
  tribunal: 0.45,
  veredito: 0.3,
};

export const CLIMA_LABEL: Record<ClimaCena, string> = {
  guerra: "Itália, 1944",
  deslocamento: "Fora do tempo",
  presente: "Século XXI",
  arquivo: "Arquivo",
  porao: "Porão",
  laboratorio: "Instituto",
  tribunal: "Tribunal",
  veredito: "Veredito",
};

/** Cena narrativa — o coração do RPG de texto. */
export interface Cena {
  id: string;
  /** Título curto mostrado no cabeçalho. */
  titulo: string;
  /**
   * Blocos de texto em 1ª pessoa. A voz é a do protagonista, nunca uma
   * narração em 3ª pessoa sobre ele.
   */
  texto: string[];
  /** Referência que sustenta o trecho (quando afirma algo sobre o passado). */
  referenciaId?: string;
  /** Atmosfera visual/sonora da cena. Ausente = herda o clima do ato. */
  clima?: ClimaCena;
  /** Escolhas apresentadas ao jogador. */
  escolhas: EscolhaCena[];
  /** Duelo do ato, quando a cena o abre. */
  duelo?: DueloDoAto;
}

/** Um ato da campanha: cenas em sequência + o duelo que o fecha. */
export interface Ato {
  id: string;
  numero: number;
  titulo: string;
  /** Subtema histórico. */
  subtema: string;
  /** Emoji do card. */
  icone: string;
  /** Clima padrão do ato (a cena pode sobrepor com o seu). */
  clima: ClimaCena;
  cenas: Cena[];
  referencias: ReferenciaCampanha[];
}

/** Estado persistido da campanha. */
export interface EstadoCampanha {
  versao: number;
  protagonista: Protagonista;
  /** Id do ato atual. */
  atoAtual: string;
  /** Índice da cena dentro do ato. */
  cenaAtual: number;
  /** Atos concluídos (id do ato → acertos no duelo). */
  concluidos: Record<string, number>;
  /** Escolhas feitas (id da cena → id da escolha), para o histórico. */
  escolhas: Record<string, string>;
  tracos: TracosCarater;
  /** Perguntas já vistas nos duelos da campanha (antirrepetição). */
  historicoPerguntas: string[];
  iniciadaEm: string | null;
  atualizadaEm: string | null;
}

/** Situação do ato na campanha. */
export type SituacaoAto = "concluido" | "atual" | "bloqueado";

export interface ProgressoAto {
  ato: Ato;
  situacao: SituacaoAto;
  acertos: number | null;
}
