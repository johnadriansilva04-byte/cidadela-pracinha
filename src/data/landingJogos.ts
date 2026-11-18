/**
 * Conteúdo das PÁGINAS INICIAIS dos jogos da Cidadela.
 *
 * REGRA DE UX (o problema que isto resolve): a entrada de um jogo NÃO despeja
 * todas as opções de uma vez. A primeira tela é uma página de apresentação —
 * nome, promessa, pilares e o que o jogo tem de diferente. O detalhe completo
 * ("como jogar", regras, economia) fica ATRÁS DE UM CLIQUE, em modal.
 *
 * É o mesmo padrão que a Cidadela já usa em `CidadelaIntro` (hero + InfoButton/
 * InfoModal) e o mesmo princípio do `loadingContent` (UMA informação por vez).
 *
 * Tudo aqui é dado puro: o componente `LandingJogo` só renderiza.
 */
import type { LucideIcon } from "lucide-react";

export interface PilarJogo {
  icone: string;
  titulo: string;
  texto: string;
}

export interface SecaoAjuda {
  titulo: string;
  /** Parágrafos simples. */
  paragrafos?: string[];
  /** Lista com marcador (quando o conteúdo é enumerável). */
  itens?: string[];
}

export interface ConteudoLanding {
  /** Nome do jogo (título grande). */
  nome: string;
  /** Linha de chamada, curta e instigante. */
  chamada: string;
  /** Frase de apresentação em 1-2 linhas. */
  apresentacao: string;
  /** Selo do topo (ex.: "1v1 · TEMPO REAL"). */
  selo: string;
  /** Gênero curto. */
  genero: string;
  /** Cores do gradiente (mesmas do card da grade). */
  cor: string;
  cor2: string;
  /** 3 pilares do jogo — o "porquê jogar". */
  pilares: PilarJogo[];
  /** Seções do modal "Como jogar". */
  comoJogar: SecaoAjuda[];
  /** Seções do modal "Modos de jogo" (quando o jogo tem mais de um). */
  modos?: SecaoAjuda[];
  /** Seções do modal "Regras e detalhes". */
  detalhes?: SecaoAjuda[];
  /** Aviso honesto (ex.: estimativa estatística não é QI oficial). */
  aviso?: string;
}

export const LANDING_JOGOS: Record<string, ConteudoLanding> = {
  // ================================================================ BRIO
  brio: {
    nome: "Guerra de Brio",
    chamada: "Dois competidores. Uma pergunta. Quinze segundos.",
    apresentacao:
      "Um duelo intelectual 1×1: os dois jogadores recebem a mesma pergunta ao mesmo tempo e quem domina o assunto leva a rodada.",
    selo: "1v1 · DUELO INTELECTUAL",
    genero: "Conhecimento",
    cor: "#c084fc",
    cor2: "#6366f1",
    pilares: [
      {
        icone: "⚔️",
        titulo: "Duelo de verdade",
        texto: "A mesma pergunta para os dois, ao mesmo tempo. Ninguém vê a resposta do outro antes da revelação.",
      },
      {
        icone: "🎯",
        titulo: "Do fácil ao especialista",
        texto: "A partida sobe de dificuldade sozinha — da primeira à última rodada, sem você configurar nada.",
      },
      {
        icone: "📊",
        titulo: "Índice de Conhecimento",
        texto: "Avaliação estatística por área: acertar difícil vale mais, mas um acerto isolado não vira domínio.",
      },
    ],
    comoJogar: [
      {
        titulo: "A partida em 6 etapas",
        itens: [
          "A mesma pergunta aparece para os dois jogadores ao mesmo tempo.",
          "Você tem 15 segundos para escolher entre as alternativas A a F.",
          "Ao responder, sua escolha é registrada e não pode ser alterada.",
          "Quem respondeu primeiro aguarda o adversário — sem ver a resposta dele.",
          "Quando os dois respondem (ou o tempo acaba), as escolhas são reveladas juntas.",
          "A resposta correta aparece com a explicação, e a rodada seguinte começa.",
        ],
      },
      {
        titulo: "Como se pontua",
        itens: [
          "Acerto vale pontos; responder antes do adversário dá um bônus de rapidez.",
          "Se os dois acertam, os dois pontuam. Se os dois erram, ninguém pontua.",
          "Empate no fim leva a perguntas extras de desempate.",
        ],
      },
      {
        titulo: "O tempo é do servidor",
        paragrafos: [
          "O relógio não é o do seu celular: é o do servidor. Isso existe para que ninguém consiga vantagem mexendo no aparelho, e para que os dois vejam exatamente a mesma contagem.",
          "Se você perder a conexão, pode voltar — a partida continua de onde estava e a sua resposta já registrada não muda.",
        ],
      },
    ],
    modos: [
      {
        titulo: "Duelo livre",
        paragrafos: [
          "Partidas soltas. Você escolhe o assunto, o nível do adversário e joga na hora.",
          "Contra o adversário virtual, o bot responde de verdade — ele leva entre 1 e 5 segundos para decidir, como um humano.",
        ],
      },
      {
        titulo: "Convidar um amigo (online)",
        paragrafos: [
          "Você cria a sala e recebe um link. Quem abrir o link entra na sua partida.",
          "Os dois recebem as mesmas perguntas, na mesma ordem, com o relógio do servidor. Um joga no aparelho dele, o outro no seu.",
          "Precisa de conta na Cidadela — é a mesma conta dos outros jogos, não existe cadastro separado aqui.",
        ],
      },
      {
        titulo: "Modo história",
        paragrafos: [
          "Uma campanha narrativa em 6 atos, na voz de um soldado expedicionário da FEB que acorda no século XXI.",
          "Você lê, escolhe, vê a consequência — e cada ato fecha com uma prova usando o mesmo motor do duelo.",
          "Todo trecho que afirma algo sobre o passado diz se é fato histórico, fonte secundária, hipótese ou ficção do jogo.",
        ],
      },
    ],
    detalhes: [
      {
        titulo: "Sobre o Índice de Conhecimento",
        paragrafos: [
          "Ele é uma estimativa estatística inspirada na Teoria de Resposta ao Item: cada pergunta tem dificuldade, poder de discriminação e chance de acerto casual, e o seu resultado é calculado a partir do padrão de respostas — não só da contagem de acertos.",
          "Por isso acertar uma questão muito difícil não te torna automaticamente especialista naquela área, e acertar várias fáceis não te torna avançado. O sistema olha o conjunto.",
          "Ele é separado da pontuação da partida: a pontuação decide quem vence o duelo; o índice estima o seu nível naquele assunto ao longo do tempo.",
        ],
      },
      {
        titulo: "Antirrepetição",
        paragrafos: [
          "A seleção evita repetir perguntas na mesma partida e evita repetir o que você viu há pouco. O acervo é escolhido por dificuldade e por raridade de uso, não por sorteio simples.",
        ],
      },
    ],
    aviso:
      "O Índice de Conhecimento é uma estimativa estatística da própria Cidadela — não é um QI oficial nem um teste psicológico validado.",
  },

  // ============================================================== TRILHA
  trilha: {
    nome: "Trilha",
    chamada: "Cerque, alinhe três e aniquile.",
    apresentacao:
      "O clássico jogo de trilha da Cidadela: posicione, mova e capture as peças do adversário.",
    selo: "CLÁSSICO · ESTRATÉGIA",
    genero: "Estratégia",
    cor: "#a3e635",
    cor2: "#22c55e",
    pilares: [
      { icone: "♟️", titulo: "Regras clássicas", texto: "Posicionamento, movimentação e captura — como no tabuleiro de sempre." },
      { icone: "🏆", titulo: "Troféus por fase", texto: "Campanha com fases e troféus de Bronze a Lendário." },
      { icone: "🌐", titulo: "Online", texto: "Jogue contra outro cidadão ou contra a IA." },
    ],
    comoJogar: [
      {
        titulo: "Objetivo",
        paragrafos: [
          "Reduza o adversário a duas peças ou bloqueie todos os movimentos dele. Você também perde se isso acontecer com você.",
        ],
      },
      {
        titulo: "As três fases do jogo",
        itens: [
          "Colocação: cada jogador posiciona as peças no tabuleiro, uma por vez.",
          "Movimentação: as peças andam pelas linhas para casas vizinhas livres.",
          "Final: com três peças, você pode voar para qualquer casa livre (regra do voo).",
        ],
      },
      {
        titulo: "Como capturar",
        paragrafos: [
          "Ao alinhar três peças suas numa linha, você remove uma peça do adversário.",
          "Só peças INIMIGAS podem ser removidas — o seu próprio moinho nunca é alvo válido.",
        ],
      },
    ],
    detalhes: [
      {
        titulo: "Fim de jogo",
        paragrafos: [
          "O jogo termina quando o adversário fica com duas peças (aniquilação) ou quando ele tem três mas não consegue mover nenhuma (bloqueio).",
        ],
      },
    ],
  },

  // ============================================================== FUTEBOL
  botao: {
    nome: "Futebol de Botão",
    chamada: "Domine o estádio e suba de divisão.",
    apresentacao:
      "O jogo principal da Cidadela: toque na bola para chutar e construa uma carreira de técnico, temporada após temporada.",
    selo: "CARREIRA · TEMPORADAS",
    genero: "Esporte",
    cor: "#22d3ee",
    cor2: "#0ea5e9",
    pilares: [
      { icone: "⚽", titulo: "Partida em campo", texto: "Física de botão: toque na bola e mire o gol adversário." },
      { icone: "📅", titulo: "Carreira infinita", texto: "Temporadas, promoção e rebaixamento, Copa do Brasil." },
      { icone: "💰", titulo: "Economia real", texto: "Caixa do clube separado do seu saldo pessoal." },
    ],
    comoJogar: [
      {
        titulo: "Jogando a partida",
        itens: [
          "Toque no disco (botão) para dar o impulso na direção do toque.",
          "A partida é dividida em turnos — cada jogador tem suas jogadas.",
          "Gol é gol: a bola precisa cruzar a linha entre as traves.",
        ],
      },
      {
        titulo: "A carreira",
        paragrafos: [
          "Você assume um clube e joga temporadas. Vitórias dão pontos na tabela; a posição final define promoção ou rebaixamento.",
          "A receita esportiva entra no caixa do CLUBE. O seu dinheiro pessoal vem do salário, pago por rodada conforme a divisão.",
        ],
      },
    ],
    detalhes: [
      {
        titulo: "Dívida não trava o jogo",
        paragrafos: [
          "Se você não conseguir pagar a manutenção, a temporada seguinte começa mesmo assim e o saldo fica negativo. Dívida é um estado válido — não um beco sem saída.",
        ],
      },
    ],
  },
};

/**
 * Conteúdo de um jogo. Jogos sem landing própria recebem um texto genérico
 * montado a partir do card — nunca uma tela vazia.
 */
export function landingDoJogo(
  id: string,
  fallback: { label: string; description: string; genero: string; chamada: string; cor: string; cor2?: string; icon: LucideIcon },
): ConteudoLanding {
  const proprio = LANDING_JOGOS[id];
  if (proprio) return proprio;
  return {
    nome: fallback.label,
    chamada: fallback.chamada,
    apresentacao: fallback.description,
    selo: fallback.genero.toUpperCase(),
    genero: fallback.genero,
    cor: fallback.cor,
    cor2: fallback.cor2 ?? fallback.cor,
    pilares: [],
    comoJogar: [
      {
        titulo: "Como jogar",
        paragrafos: [
          "Este jogo usa os mesmos controles da Cidadela: toque para agir, arraste para mirar quando houver mira.",
        ],
      },
    ],
  };
}
