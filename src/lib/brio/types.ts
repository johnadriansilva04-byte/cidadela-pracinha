/**
 * Tipos do GUERRA DE BRIO — duelo intelectual 1×1 da Cidadela dos Clássicos.
 *
 * Módulo INDEPENDENTE: tem motor, banco e regras próprias, mas reutiliza a
 * autenticação, o celular, a economia SOV e os componentes visuais da
 * Cidadela. Nenhum outro jogo é tocado.
 */
import type { Dificuldade, Modalidade } from "./categorias";

export const DUELO = {
  /** Perguntas por partida (a fase de grupos do duelo). */
  PERGUNTAS_POR_PARTIDA: 10,
  /** Segundos por pergunta — o SERVIDOR é a autoridade do relógio. */
  SEGUNDOS_POR_PERGUNTA: 7,
  /** Alternativas por pergunta (A–F). */
  ALTERNATIVAS: 6,
  /** Pontos por acerto. */
  PONTOS_ACERTO: 10,
  /** Bônus por responder antes do adversário (mantém o fator "duelo"). */
  PONTOS_RAPIDEZ: 3,
  /** Perguntas extras de desempate (§4.5). */
  MAX_DESEMPATE: 3,
  VERSION: 1,
} as const;

/** 6 alternativas identificadas por letra (A–F). */
export const LETRAS = ["A", "B", "C", "D", "E", "F"] as const;
export type Letra = (typeof LETRAS)[number];

export interface Alternativa {
  letra: Letra;
  texto: string;
}

/**
 * Pergunta como o cliente a recebe — SEM o gabarito.
 * O índice correto NUNCA viaja para o navegador durante a partida: a
 * revelação vem do servidor (`brio_revelar_rodada`).
 */
export interface PerguntaPublica {
  id: string;
  areaSlug: string;
  subcategoriaSlug: string;
  dificuldade: Dificuldade;
  /** 1..5 — a partida sobe a dificuldade ao longo das rodadas. */
  ordem: number;
  enunciado: string;
  alternativas: Alternativa[];
}

/** Alternativa correta + explicação, entregues só na revelação. */
export interface Revelacao {
  rodada: number;
  perguntaId: string;
  letraCorreta: Letra;
  explicacao: string;
  referencia: string | null;
}

export interface JogadorDuelo {
  id: string;
  nome: string;
  /** 0 = desafiante (esquerda), 1 = desafiado (direita). */
  assento: 0 | 1;
  /** Adversário controlado pelo servidor (sem segundo humano na sala). */
  bot?: boolean;
}

export type StatusDuelo = "aguardando" | "em_andamento" | "revelacao" | "finalizado";

export interface EstadoRodada {
  rodada: number;
  /** Momento (ISO do servidor) em que a pergunta foi liberada. */
  liberadaEm: string;
  /** Resposta por jogador — null enquanto não respondeu. */
  respostas: Record<string, Letra | null>;
  /** Momento da resposta, para o bônus de rapidez. */
  tempos: Record<string, number | null>;
  /** Quem respondeu primeiro nesta rodada. */
  primeiro: string | null;
  revelacao: Revelacao | null;
}

export interface PlacarRodada {
  rodada: number;
  perguntaId: string;
  acertos: Record<string, boolean | null>;
  /** Pontos ganhos nesta rodada, por jogador. */
  pontos: Record<string, number>;
}

export interface ResultadoDuelo {
  partidaId: string;
  status: StatusDuelo;
  placar: Record<string, number>;
  acertos: Record<string, number>;
  erros: Record<string, number>;
  aproveitamento: Record<string, number>;
  rodadas: PlacarRodada[];
  vencedorId: string | null;
  empate: boolean;
  /** Estimativa de habilidade (Índice de Conhecimento) por jogador. */
  indiceConhecimento: Record<string, number>;
  /** Índice por área, por jogador (§5.3/§5.6). */
  indicePorArea: Record<string, Record<string, number>>;
  desempate: boolean;
}

/** Configuração escolhida no lobby. */
export interface ConfiguracaoDuelo {
  modalidade: Modalidade;
  /** Preenchido quando modalidade = categoria. */
  areaSlug: string | null;
  /** Preenchido quando modalidade = subcategoria. */
  subcategoriaSlug: string | null;
  /** Nível do adversário virtual (1..4). */
  nivelAdversario: number;
}

/** Resumo de uma partida para o histórico do perfil. */
export interface ResumoPartida {
  partidaId: string;
  modalidade: Modalidade;
  areaSlug: string | null;
  subcategoriaSlug: string | null;
  meuPlacar: number;
  placarOponente: number;
  acertos: number;
  totalPerguntas: number;
  aproveitamento: number;
  indiceConhecimento: number;
  vencedor: boolean;
  empate: boolean;
  contraBot: boolean;
  iniciadaEm: string;
  finalizadaEm: string | null;
}

/** Motivo pelo qual o modo servidor não está disponível (degradação segura). */
export interface AvisoModoLocal {
  ativo: boolean;
  mensagem: string;
}
