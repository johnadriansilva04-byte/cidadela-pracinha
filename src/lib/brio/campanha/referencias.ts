/**
 * Referências históricas da campanha do Guerra de Brio.
 *
 * REGRA: todo trecho narrativo que afirma algo sobre o passado aponta para uma
 * destas referências, e cada uma declara a FORÇA da afirmação
 * (`ClassificacaoFonte`). Hipótese não vira fato; ficção do jogo não vira
 * história.
 *
 * Fontes primárias/secundárias usadas: US Holocaust Memorial Museum, Arquivo
 * Nacional (Brasil), Ministério da Defesa, UNESCO (Rota do Escravo),
 * historiografia sobre a FEB e sobre eugenia no Brasil.
 */
import type { ReferenciaCampanha } from "./tipos";

export const REFERENCIAS: ReferenciaCampanha[] = [
  // ---------------------------------------------------------------- FEB
  {
    id: "ref-feb-italia",
    titulo: "A FEB na Campanha da Itália",
    resumo:
      "O Brasil enviou pouco mais de 25 mil militares à Itália entre 1944 e 1945. " +
      "A Força Expedicionária Brasileira combateu em Monte Castello — tomado após " +
      "sucessivas tentativas, em fevereiro de 1945 — e em Montese, em abril. " +
      "O Arquivo Nacional mantém a documentação do envio dos contingentes.",
    fonte: "Arquivo Nacional / Ministério da Defesa",
    classificacao: "HISTORICAL_FACT",
  },
  {
    id: "ref-feb-memoria",
    titulo: "A memória disputada da FEB",
    resumo:
      "A lembrança pública dos expedicionários oscilou entre o silêncio e a " +
      "celebração, conforme o momento político do país. Como uma sociedade " +
      "escolhe lembrar (ou esquecer) seus combatentes é uma questão de pesquisa " +
      "aberta, não um dado fixo.",
    fonte: "Historiografia sobre memória da Segunda Guerra no Brasil",
    classificacao: "SECONDARY_SOURCE",
  },

  // ------------------------------------------------------------ EUGENIA
  {
    id: "ref-eugenia-origem",
    titulo: "Eugenia: o nome e a pretensão",
    resumo:
      "O termo 'eugenia' foi cunhado por Francis Galton na década de 1880, para " +
      "designar um programa de melhoria biológica das populações. A pretensão " +
      "central — a de que se poderia decidir quais vidas valem mais — atravessou " +
      "a ciência, o direito e a política de vários países.",
    fonte: "US Holocaust Memorial Museum",
    classificacao: "HISTORICAL_FACT",
  },
  {
    id: "ref-eugenia-nuremberg",
    titulo: "Leis de Nuremberg (1935)",
    resumo:
      "As Leis de Nuremberg converteram concepções raciais em categorias " +
      "jurídicas, retirando cidadania e direitos civis de judeus na Alemanha. " +
      "Não foi um ato único: centenas de decretos restringiram progressivamente " +
      "a vida pública, econômica e civil.",
    fonte: "US Holocaust Memorial Museum",
    classificacao: "HISTORICAL_FACT",
  },
  {
    id: "ref-eugenia-t4",
    titulo: "O programa T4",
    resumo:
      "Entre 1939 e 1941, o regime nazista organizou o assassinato sistemático de " +
      "pessoas com deficiência física e mental, em instituições médicas. " +
      "O programa ficou conhecido como T4, pelo endereço da central que o " +
      "administrava. As estimativas de vítimas variam conforme a fonte e o " +
      "período considerado.",
    fonte: "US Holocaust Memorial Museum",
    classificacao: "HISTORICAL_FACT",
  },
  {
    id: "ref-eugenia-esterilizacao",
    titulo: "Esterilização compulsória: um fenômeno internacional",
    resumo:
      "Leis de esterilização compulsória existiram em vários países além da " +
      "Alemanha — inclusive nos Estados Unidos (com respaldo judicial em 1927) e " +
      "em países nórdicos. Não foi um desvio de um único povo: foi uma política " +
      "compartilhada por instituições e elites de vários lugares.",
    fonte: "US Holocaust Memorial Museum / historiografia comparada",
    classificacao: "HISTORICAL_FACT",
  },
  {
    id: "ref-eugenia-brasil",
    titulo: "O pensamento eugênico no Brasil",
    resumo:
      "O eugenismo teve circulação no Brasil nas décadas de 1920 e 1930, em " +
      "periódicos especializados e em projetos de higiene mental e saneamento " +
      "que associavam miséria e doença a supostos defeitos hereditários de " +
      "populações. É um capítulo da história das ideias no país, não um episódio " +
      "importado.",
    fonte: "Historiografia sobre eugenia e higiene mental no Brasil",
    classificacao: "SECONDARY_SOURCE",
  },
  {
    id: "ref-eugenia-julgamento",
    titulo: "Os julgamentos de Nuremberg (1945–1946)",
    resumo:
      "Depois da guerra, um tribunal internacional julgou dirigentes do regime " +
      "nazista. O conceito jurídico de 'crime contra a humanidade' ganhou corpo " +
      "nesses julgamentos — uma resposta jurídica a atos que a lei de um só " +
      "Estado não alcançava.",
    fonte: "Arquivos dos Julgamentos de Nuremberg",
    classificacao: "HISTORICAL_FACT",
  },

  // ----------------------------------------------------------- ESCRAVIDÃO
  {
    id: "ref-escravidao-atlantico",
    titulo: "O tráfico transatlântico em números",
    resumo:
      "Cerca de 12 milhões de africanos foram embarcados à força pelo Atlântico, " +
      "e aproximadamente 10 milhões chegaram vivos ao outro lado. O Brasil " +
      "recebeu o maior contingente das Américas. Os números são estimativas " +
      "demográficas construídas a partir de registros de embarque e desembarque.",
    fonte: "UNESCO — Rota do Escravo / SlaveVoyages",
    classificacao: "HISTORICAL_FACT",
  },
  {
    id: "ref-escravidao-brasil-abolicao",
    titulo: "A abolição no Brasil e sua longa duração",
    resumo:
      "O Brasil foi o último país das Américas a abolir a escravidão, em 1888. " +
      "A lei de abolição não veio acompanhada de reparação, terra ou política de " +
      "inclusão — o que ajuda a explicar por que a desigualdade persistiu depois " +
      "dela.",
    fonte: "Arquivo Nacional / historiografia da abolição",
    classificacao: "HISTORICAL_FACT",
  },
  {
    id: "ref-escravidao-resistencia",
    titulo: "Resistência: quilombos e revoltas",
    resumo:
      "A escravidão nunca foi aceita passivamente. Houve fugas, quilombos, " +
      "revoltas e negociações cotidianas. Palmares resistiu por décadas e foi " +
      "destruído em 1695; seu líder mais conhecido, Zumbi, tornou-se símbolo " +
      "posteriormente, num processo de construção de memória.",
    fonte: "Historiografia sobre quilombos / Arquivo Nacional",
    classificacao: "HISTORICAL_FACT",
  },
  {
    id: "ref-escravidao-ideologia",
    titulo: "A fabricação da justificativa",
    resumo:
      "A escravidão moderna precisou de justificativa num mundo que já proclamava " +
      "direitos naturais. Produziram-se teorias raciais, teses sobre " +
      "'civilização' e leituras bíblicas — um esforço intelectual considerável " +
      "para tornar aceitável o que hoje parece inadmissível. Essa produção é " +
      "historicamente documentada.",
    fonte: "Historiografia da escravidão e das teorias raciais",
    classificacao: "SECONDARY_SOURCE",
  },

  // --------------------------------------------------------- GEOPOLÍTICA
  {
    id: "ref-geopolitica-1914",
    titulo: "1914: o estopim e as causas",
    resumo:
      "O assassinato do arquiduque Francisco Ferdinando em Sarajevo, em junho de " +
      "1914, é o estopim convencional da Primeira Guerra. As causas estruturais " +
      "— alianças, corrida armamentista, disputas coloniais — vinham de décadas " +
      "antes. A distinção entre gatilho e causa é essencial.",
    fonte: "Historiografia da Primeira Guerra Mundial",
    classificacao: "HISTORICAL_FACT",
  },
  {
    id: "ref-geopolitica-versalhes",
    titulo: "Versalhes e a paz que gerou guerra",
    resumo:
      "O tratado de 1919 impôs à Alemanha reparações e perdas territoriais. " +
      "A tese de que o tratado alimentou o revanchismo que levou à Segunda Guerra " +
      "é amplamente discutida — há consenso de que contribuiu para um clima " +
      "político explosivo, mas atribuir a ele uma causa única seria simplificar.",
    fonte: "Historiografia do entreguerras",
    classificacao: "SECONDARY_SOURCE",
  },
  {
    id: "ref-geopolitica-guerra-fria",
    titulo: "A ordem que veio depois",
    resumo:
      "A Segunda Guerra foi seguida por uma disputa bipolar entre Estados Unidos " +
      "e União Soviética, com conflitos por procuração, corrida nuclear e " +
      "intervenções em vários continentes. A vitória sobre o nazismo não encerrou " +
      "a violência organizada em escala estatal.",
    fonte: "Historiografia da Guerra Fria",
    classificacao: "HISTORICAL_FACT",
  },

  // ------------------------------------------------------- LIMITES DO JOGO
  {
    id: "ref-ficcao-viagem",
    titulo: "O salto temporal desta campanha",
    resumo:
      "Um soldado de 1944 acordar no século XXI é ficção. Nenhum expedicionário " +
      "brasileiro atravessou o tempo. O recurso existe para dar ao jogador o " +
      "olhar de quem vem de fora e precisa perguntar: o que a humanidade fez " +
      "consigo mesma depois de mim?",
    fonte: "Ficção do universo do jogo",
    classificacao: "FICTION",
  },
  {
    id: "ref-hipotese-transmissao",
    titulo: "Como as ideias de exclusão sobrevivem",
    resumo:
      "Há debate acadêmico sobre como programas de exclusão se transmitem entre " +
      "gerações e entre países. Parte da literatura enfatiza instituições e " +
      "políticas públicas; parte enfatiza cultura e linguagem cotidiana. " +
      "Não há uma resposta única consolidada — por isso aqui é hipótese.",
    fonte: "Debate historiográfico e sociológico aberto",
    classificacao: "HYPOTHESIS",
  },
];

export const REFERENCIA_POR_ID: Record<string, ReferenciaCampanha> = Object.fromEntries(
  REFERENCIAS.map((r) => [r.id, r]),
);

/** Referência pelo id, ou null (nunca inventa uma fonte). */
export function referenciaPorId(id: string | null | undefined): ReferenciaCampanha | null {
  if (!id) return null;
  return REFERENCIA_POR_ID[id] ?? null;
}
