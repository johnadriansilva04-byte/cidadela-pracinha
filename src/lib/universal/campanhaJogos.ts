/**
 * Campanha e progressão dos jogos da Cidadela — motor PURO e determinístico.
 *
 * Cada jogo tem uma campanha de fases com história contada pelos NPCs que já
 * existem no projeto (Pracinha, Cícero Ramos, Valéria, John Adrian, Dir.
 * Aldemir). Vencer a fase libera a próxima, dá SOV uma única vez (chave
 * idempotente por fase) e sobe a força da IA.
 *
 * Sem importações com alias `@/` de propósito: assim o módulo roda no jiti
 * (`testes/campanha-jogos.test.mts`) sem bundler.
 *
 * Jogos que JÁ têm campanha própria (futebol, trilha, brio, car brawl) NÃO
 * ganham campanha duplicada aqui — o painel aponta para o modo que existe.
 */

export type ResultadoPartida = "vitoria" | "derrota" | "empate";

/** Força da IA por fase — vira configuração real do MCTS na partida. */
export type ForcaIa = "recruta" | "sargento" | "general" | "especialista";

export const FORCA_IA: Record<ForcaIa, { maxIterations: number; timeBudgetMs: number }> = {
  recruta: { maxIterations: 400, timeBudgetMs: 250 },
  sargento: { maxIterations: 1500, timeBudgetMs: 800 },
  general: { maxIterations: 3000, timeBudgetMs: 1500 },
  especialista: { maxIterations: 6000, timeBudgetMs: 2500 },
};

export const FORCA_LABEL: Record<ForcaIa, string> = {
  recruta: "Recruta",
  sargento: "Sargento",
  general: "General",
  especialista: "Especialista",
};

export type FaseCampanha = {
  numero: number;
  titulo: string;
  objetivo: string;
  forca: ForcaIa;
  /** SOV pago UMA vez, ao vencer a fase pela primeira vez. */
  recompensa: number;
  /** Fala do patrono ao entrar na fase. */
  historia: string;
  /** Texto de vitória da fase. */
  desfecho: string;
};

export type Campanha = {
  jogoId: string;
  nome: string;
  /** Quem narra a campanha (NPC canônico da Cidadela). */
  patrono: string;
  patronoAvatar: string;
  /** Jogos com modo próprio não recebem fases aqui. */
  modoProprio?: boolean;
  /** Explicação do modo próprio (quando `modoProprio`). */
  modoProprioTexto?: string;
  fases: FaseCampanha[];
};

export type ProgressoJogo = {
  jogoId: string;
  /** Fase atual (1-based). */
  fase: number;
  vitorias: number;
  derrotas: number;
  empates: number;
  /** Venceu todas as fases. */
  concluida: boolean;
  /** SOV total já ganho nesta campanha. */
  sovGanha: number;
};

export type ResultadoFase = {
  progresso: ProgressoJogo;
  /** Subiu de fase nesta partida. */
  avancou: boolean;
  /** Fechou a campanha inteira nesta partida. */
  concluiu: boolean;
  /** SOV a pagar agora (0 se não houve avanço). */
  recompensa: number;
  /** Texto mostrado ao jogador no fim da partida. */
  mensagem: string;
};

/** Campanha do Futebol é a Carreira; a Trilha tem fases; o Brio é duelo. */
const MODO_PROPRIO: Record<string, string> = {
  botao: "A campanha do Futebol é a Carreira no Campus: temporadas, promoção, Copa do Brasil e história própria.",
  trilha: "A Trilha já tem campanha de 3 fases com troféus de Bronze a Lendário.",
  brio: "O Guerra de Brio é um duelo: o progresso é o Índice de Conhecimento por área, não fases.",
  carbrawl: "O Car Brawl tem campeonatos e arenas próprias.",
};

export const CAMPANHAS: Record<string, Campanha> = {
  xadrez: {
    jogoId: "xadrez",
    nome: "Xadrez",
    patrono: "Pracinha",
    patronoAvatar: "🤖",
    fases: [
      {
        numero: 1,
        titulo: "A Abertura",
        objetivo: "Vença o Recruta",
        forca: "recruta",
        recompensa: 3,
        historia:
          "O Pracinha encosta a bengala no tabuleiro: — Toda guerra se decide antes do primeiro movimento. Mostre que você enxerga o tabuleiro inteiro.",
        desfecho: "— Você abriu bem. Mas abrir bem é o fácil.",
      },
      {
        numero: 2,
        titulo: "O Meio-Jogo",
        objetivo: "Vença o Sargento",
        forca: "sargento",
        recompensa: 5,
        historia:
          "— Você venceu quem não pensa. Agora enfrenta quem pensa duas jogadas à frente de você.",
        desfecho: "— Duas jogadas já não bastam contra você. Anotado.",
      },
      {
        numero: 3,
        titulo: "O Final",
        objetivo: "Vença o General",
        forca: "general",
        recompensa: 8,
        historia:
          "— O general não perde peças por descuido. Ele as entrega de propósito. Não morda a isca.",
        desfecho: "— Você não mordeu. Isso é raro nesta Cidadela.",
      },
      {
        numero: 4,
        titulo: "Xeque-Mate do Guardião",
        objetivo: "Vença o Especialista",
        forca: "especialista",
        recompensa: 15,
        historia:
          "O Pracinha senta do outro lado. — Chegou a hora. Eu mesmo jogo, e não espero piedade.",
        desfecho:
          "— Então é isso. O tabuleiro é seu, Guardião. Que ninguém mais o derrube.",
      },
    ],
  },
  dama: {
    jogoId: "dama",
    nome: "Dama",
    patrono: "Dir. Aldemir",
    patronoAvatar: "🎩",
    fases: [
      {
        numero: 1,
        titulo: "Cerco de Pedra",
        objetivo: "Vença o Recruta",
        forca: "recruta",
        recompensa: 3,
        historia:
          "O dirigente bate o charuto na mesa: — Dama é paciência com fome. Quem come primeiro, come errado.",
        desfecho: "— Comeu sem se expor. Melhor do que eu esperava.",
      },
      {
        numero: 2,
        titulo: "Corredor Aberto",
        objetivo: "Vença o Sargento",
        forca: "sargento",
        recompensa: 5,
        historia:
          "— Agora o adversário vai abrir corredor de propósito. Corredor aberto é convite pra cova.",
        desfecho: "— Você não entrou no corredor. A diretoria agradece.",
      },
      {
        numero: 3,
        titulo: "Dama contra Dama",
        objetivo: "Vença o General",
        forca: "general",
        recompensa: 8,
        historia: "— Ele vai coroar. E dama coroada sem escolta morre sozinha.",
        desfecho: "— Coroou e caiu. O clube anota seus movimentos.",
      },
      {
        numero: 4,
        titulo: "O Cerco Fechado",
        objetivo: "Vença o Especialista",
        forca: "especialista",
        recompensa: 15,
        historia: "O dirigente apaga o charuto: — Eu fecho o cerco. Ninguém sai.",
        desfecho: "— Você saiu. Assine o contrato: a Cidadela tem um novo estrategista.",
      },
    ],
  },
  domino: {
    jogoId: "domino",
    nome: "Dominó",
    patrono: "Cícero Ramos",
    patronoAvatar: "📰",
    fases: [
      {
        numero: 1,
        titulo: "A Mesa do Porto",
        objetivo: "Vença o Recruta",
        forca: "recruta",
        recompensa: 3,
        historia:
          "O jornalista embaralha as pedras: — No porto ninguém joga sozinho. Quem fecha as pontas, bate primeiro.",
        desfecho: "— Fechou a mesa. Amanhã isso vira manchete.",
      },
      {
        numero: 2,
        titulo: "Pedra na Mão",
        objetivo: "Vença o Sargento",
        forca: "sargento",
        recompensa: 5,
        historia:
          "— Segurar pedra boa é vantagem. Segurar pedra boa até o fim é enterro. Aprenda a hora de soltar.",
        desfecho: "— Soltou na hora certa. A coluna confere.",
      },
      {
        numero: 3,
        titulo: "Mesa Truncada",
        objetivo: "Vença o General",
        forca: "general",
        recompensa: 8,
        historia:
          "— Ele vai trancar a mesa pra te obrigar a comprar. Cada compra é uma linha que você escreve contra si.",
        desfecho: "— Comprou pouco e venceu muito. Isso é ofício.",
      },
      {
        numero: 4,
        titulo: "A Banca do Ramos",
        objetivo: "Vença o Especialista",
        forca: "especialista",
        recompensa: 15,
        historia: "Cícero tira o paletó: — Eu sou a banca. Aqui se joga a sério.",
        desfecho: "— A banca caiu. Você entra no meu caderno como lenda do porto.",
      },
    ],
  },
  yahtzee: {
    jogoId: "yahtzee",
    nome: "Yahtzee",
    patrono: "Valéria",
    patronoAvatar: "💃",
    fases: [
      {
        numero: 1,
        titulo: "A Sala dos Dados",
        objetivo: "Vença o Recruta",
        forca: "recruta",
        recompensa: 3,
        historia:
          "Valéria gira um dado entre os dedos: — Cinco dados, treze jogadas, nenhuma desculpa. Vamos ver no que você aposta.",
        desfecho: "— Apostou certo. Não é só sorte, eu vi.",
      },
      {
        numero: 2,
        titulo: "Três Rolagens",
        objetivo: "Vença o Sargento",
        forca: "sargento",
        recompensa: 5,
        historia:
          "— Você tem três rolagens e uma escolha. Guardar o que serve é mais difícil que rolar de novo.",
        desfecho: "— Guardou o essencial. Aprendeu rápido.",
      },
      {
        numero: 3,
        titulo: "Sequência Perfeita",
        objetivo: "Vença o General",
        forca: "general",
        recompensa: 8,
        historia: "— Sequência não se persegue: se prepara. Ele prepara melhor que você.",
        desfecho: "— Você preparou melhor que ele. Estou impressionada.",
      },
      {
        numero: 4,
        titulo: "A Cartela Completa",
        objetivo: "Vença o Especialista",
        forca: "especialista",
        recompensa: 15,
        historia: "Valéria senta na mesa: — Cartela cheia é caráter. Joga comigo.",
        desfecho:
          "— Cartela fechada, sem buraco. Se eu fosse apostar em alguém, seria em você.",
      },
    ],
  },
  blackjack: {
    jogoId: "blackjack",
    nome: "Blackjack",
    patrono: "John Adrian",
    patronoAvatar: "🎩",
    fases: [
      {
        numero: 1,
        titulo: "A Casa Noturna",
        objetivo: "Vença o Recruta",
        forca: "recruta",
        recompensa: 3,
        historia:
          "John Adrian corta o baralho sem olhar: — Vinte e um não é sobre coragem. É sobre saber parar.",
        desfecho: "— Você parou antes de estourar. Boa noite começa assim.",
      },
      {
        numero: 2,
        titulo: "A Carta Virada",
        objetivo: "Vença o Sargento",
        forca: "sargento",
        recompensa: 5,
        historia: "— A banca mostra uma carta e esconde outra. A metade que você vê nunca é a história.",
        desfecho: "— Você contou a carta escondida sem vê-la. Isso tem nome: leitura.",
      },
      {
        numero: 3,
        titulo: "A Contagem",
        objetivo: "Vença o General",
        forca: "general",
        recompensa: 8,
        historia: "— Quando o baralho fica pesado de cartas altas, a banca sorri. Desconfie do sorriso.",
        desfecho: "— Você desconfiou do sorriso e levou o pote.",
      },
      {
        numero: 4,
        titulo: "A Mesa do Dono",
        objetivo: "Vença o Especialista",
        forca: "especialista",
        recompensa: 15,
        historia: "John Adrian senta do outro lado: — Esta é minha mesa. Mostre por que devo respeitá-lo.",
        desfecho:
          "— Está respeitado. E olhe: eu não respeito muita gente nesta cidade.",
      },
    ],
  },
};

/** Jogos com modo próprio — o painel manda para o que já existe. */
export const JOGOS_MODO_PROPRIO: Record<string, string> = MODO_PROPRIO;

export function campanhaDe(jogoId: string): Campanha | null {
  return CAMPANHAS[jogoId] ?? null;
}

export function progressoInicial(jogoId: string): ProgressoJogo {
  return {
    jogoId,
    fase: 1,
    vitorias: 0,
    derrotas: 0,
    empates: 0,
    concluida: false,
    sovGanha: 0,
  };
}

/** Saneia o que veio do banco (JSONB pode estar velho, nulo ou torto). */
export function normalizarProgresso(jogoId: string, bruto: unknown): ProgressoJogo {
  const base = progressoInicial(jogoId);
  if (!bruto || typeof bruto !== "object") return base;
  const p = bruto as Partial<ProgressoJogo>;
  const campanha = campanhaDe(jogoId);
  const totalFases = campanha ? campanha.fases.length : 1;
  const num = (v: unknown, min: number, max: number, padrao: number) =>
    typeof v === "number" && Number.isFinite(v)
      ? Math.min(max, Math.max(min, Math.floor(v)))
      : padrao;

  return {
    jogoId,
    fase: num(p.fase, 1, totalFases, 1),
    vitorias: num(p.vitorias, 0, 1_000_000, 0),
    derrotas: num(p.derrotas, 0, 1_000_000, 0),
    empates: num(p.empates, 0, 1_000_000, 0),
    concluida: p.concluida === true,
    sovGanha: num(p.sovGanha, 0, 1_000_000, 0),
  };
}

export function faseAtual(progresso: ProgressoJogo): FaseCampanha | null {
  const campanha = campanhaDe(progresso.jogoId);
  if (!campanha) return null;
  return campanha.fases.find((f) => f.numero === progresso.fase) ?? null;
}

/** Chave idempotente da recompensa: uma fase paga UMA vez por jogador. */
export function chaveRecompensa(jogoId: string, fase: number): string {
  return `jogo:${jogoId}:fase:${fase}`;
}

/**
 * Aplica o resultado de uma partida da campanha.
 *
 * Vitória na fase atual → avança (e paga). Derrota/empate → só contabiliza,
 * a fase continua a mesma. Repetir a mesma fase não paga de novo.
 */
export function aplicarResultado(
  progresso: ProgressoJogo,
  resultado: ResultadoPartida,
): ResultadoFase {
  const p: ProgressoJogo = { ...progresso };
  if (resultado === "vitoria") p.vitorias += 1;
  else if (resultado === "derrota") p.derrotas += 1;
  else p.empates += 1;

  const campanha = campanhaDe(p.jogoId);
  const fase = campanha ? campanha.fases.find((f) => f.numero === p.fase) : null;

  // Sem campanha (modo próprio) ou campanha já concluída: só contabiliza.
  if (!campanha || !fase || p.concluida) {
    return {
      progresso: p,
      avancou: false,
      concluiu: false,
      recompensa: 0,
      mensagem: p.concluida
        ? "Campanha concluída — esta partida foi só pela glória."
        : "Resultado registrado.",
    };
  }

  if (resultado !== "vitoria") {
    return {
      progresso: p,
      avancou: false,
      concluiu: false,
      recompensa: 0,
      mensagem:
        resultado === "empate"
          ? "Empate não abre porta. A fase continua — volte e vença."
          : "A fase não abre com derrota. Reorganize e volte.",
    };
  }

  const ultima = p.fase >= campanha.fases.length;
  p.fase = ultima ? campanha.fases.length : p.fase + 1;
  p.concluida = ultima;
  p.sovGanha += fase.recompensa;

  return {
    progresso: p,
    avancou: true,
    concluiu: ultima,
    recompensa: fase.recompensa,
    mensagem: ultima
      ? `${fase.desfecho} Campanha concluída!`
      : `${fase.desfecho} Fase ${p.fase} liberada.`,
  };
}

export type ResumoCampanha = {
  nome: string;
  patrono: string;
  patronoAvatar: string;
  fase: number;
  totalFases: number;
  tituloFase: string;
  objetivo: string;
  forca: ForcaIa;
  forcaLabel: string;
  historia: string;
  vitorias: number;
  derrotas: number;
  empates: number;
  concluida: boolean;
  sovGanha: number;
};

export function resumoCampanha(progresso: ProgressoJogo): ResumoCampanha | null {
  const campanha = campanhaDe(progresso.jogoId);
  if (!campanha) return null;
  const fase =
    campanha.fases.find((f) => f.numero === progresso.fase) ??
    campanha.fases[campanha.fases.length - 1]!;
  return {
    nome: campanha.nome,
    patrono: campanha.patrono,
    patronoAvatar: campanha.patronoAvatar,
    fase: progresso.fase,
    totalFases: campanha.fases.length,
    tituloFase: fase.titulo,
    objetivo: fase.objetivo,
    forca: fase.forca,
    forcaLabel: FORCA_LABEL[fase.forca],
    historia: fase.historia,
    vitorias: progresso.vitorias,
    derrotas: progresso.derrotas,
    empates: progresso.empates,
    concluida: progresso.concluida,
    sovGanha: progresso.sovGanha,
  };
}

/** Missão diária que cada jogo alimenta (chaves reais de `cidadela_missoes_diarias`). */
export const MISSAO_DO_JOGO: Record<string, string> = {
  botao: "botao_partida",
  trilha: "trilha_jogo",
  brio: "brio_duelo",
  xadrez: "jogo_tabuleiro",
  dama: "jogo_tabuleiro",
  domino: "jogo_tabuleiro",
  yahtzee: "jogo_dados",
  blackjack: "jogo_cartas",
  carbrawl: "jogo_corrida",
};
