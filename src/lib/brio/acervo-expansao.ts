/**
 * EXPANSÃO do acervo do GUERRA DE BRIO.
 *
 * O núcleo curado (`acervo.ts`) cobria 49 perguntas e deixava 44 das 91
 * subcategorias do catálogo sem nenhuma questão — quem escolhesse, por
 * exemplo, "Neuropsicologia" ou "História da África" caía em partida vazia.
 *
 * Este arquivo cobre TODAS as subcategorias que estavam descobertas, com no
 * mínimo duas perguntas cada, mantendo a regra editorial do projeto: seis
 * alternativas, gabarito único defensável, explicação e referência
 * verificável (§3.5 do documento do jogo).
 *
 * Está separado do núcleo por organização, não por regra: o `acervo.ts`
 * concatena os dois e aplica o mesmo `equilibrarGabarito`, então a ordem
 * autoral das alternativas é irrelevante.
 */
import type { PerguntaBruta } from "./selecao";

/** Atalho: monta as 6 alternativas na ordem canônica A–F. */
function alts(a: string, b: string, c: string, d: string, e: string, f: string) {
  return [
    { letra: "A" as const, texto: a },
    { letra: "B" as const, texto: b },
    { letra: "C" as const, texto: c },
    { letra: "D" as const, texto: d },
    { letra: "E" as const, texto: e },
    { letra: "F" as const, texto: f },
  ];
}

type SemUsos = Omit<PerguntaBruta, "usos">;

export const ACERVO_EXPANSAO: SemUsos[] = [
  // ================= CIÊNCIAS =================
  {
    id: "br-geologia-01",
    areaSlug: "ciencias",
    subcategoriaSlug: "geologia",
    dificuldade: "facil",
    ordem: 1,
    enunciado:
      "A escala de dureza de Mohs ordena minerais de 1 a 10. Qual mineral ocupa o topo da escala, sendo o mais duro entre os de referência?",
    alternativas: alts("Talco", "Gipsita", "Quartzo", "Topázio", "Coríndon", "Diamante"),
    letraCorreta: "F",
    explicacao:
      "A escala vai do talco (1) ao diamante (10). Quartzo é 7, topázio 8 e coríndon 9. O diamante é o mais duro dos minerais de referência — por isso a ideia de que nada o risca, exceto outro diamante.",
    referencia: "USGS — Mineral hardness and the Mohs scale",
  },
  {
    id: "br-geologia-02",
    areaSlug: "ciencias",
    subcategoriaSlug: "geologia",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado:
      "Quando duas placas tectônicas se afastam uma da outra e o magma ascende formando nova crosta, esse limite é classificado como:",
    alternativas: alts(
      "Convergente",
      "Divergente",
      "Transformante",
      "Zona de subducção",
      "Falha inversa",
      "Limite de obducção",
    ),
    letraCorreta: "B",
    explicacao:
      "Em limites divergentes as placas se separam e o magma ascende, gerando nova crosta — é o caso da Dorsal Meso-Atlântica. Limites convergentes aproximam placas (com subducção ou colisão) e os transformantes deslizam lateralmente, sem criar nem destruir crosta.",
    referencia: "USGS — Understanding plate motions",
  },
  {
    id: "br-biotecnologia-01",
    areaSlug: "ciencias",
    subcategoriaSlug: "biotecnologia",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado: "A técnica de PCR (reação em cadeia da polimerase) serve principalmente para:",
    alternativas: alts(
      "Separar proteínas por tamanho",
      "Amplificar exponencialmente um trecho específico de DNA",
      "Editar genes de embriões humanos",
      "Medir a taxa metabólica das células",
      "Sintetizar lipídios de membrana",
      "Corar cromossomos ao microscópio",
    ),
    letraCorreta: "B",
    explicacao:
      "A PCR usa ciclos repetidos de desnaturação, anelamento de primers e extensão por uma polimerase termoestável, copiando milhões de vezes um trecho delimitado pelos primers. Separar proteínas por tamanho é eletroforese; edição genética é outra família de técnicas.",
    referencia: "NIH — Polymerase chain reaction (PCR) fact sheet",
  },
  {
    id: "br-biotecnologia-02",
    areaSlug: "ciencias",
    subcategoriaSlug: "biotecnologia",
    dificuldade: "avancada",
    ordem: 4,
    enunciado: "No sistema CRISPR-Cas9, qual é o papel da proteína Cas9?",
    alternativas: alts(
      "Reconhecer a sequência alvo por pareamento de bases",
      "Cortar as duas fitas de DNA, guiada pelo RNA",
      "Sintetizar o RNA guia",
      "Reparar o corte por recombinação homóloga",
      "Traduzir a sequência alvo em proteína",
      "Transportar o DNA até o núcleo",
    ),
    letraCorreta: "B",
    explicacao:
      "O RNA guia reconhece o alvo por complementaridade e leva a Cas9 até lá; Cas9 é a nuclease que corta as duas fitas. O reparo do corte é feito pela maquinaria da própria célula (junção de extremidades não homólogas ou recombinação homóloga).",
    referencia:
      "Doudna & Charpentier, Science 2014 — The new frontier of genome engineering with CRISPR-Cas9 (Nobel de Química 2020)",
  },
  {
    id: "br-ciencias-ambientais-01",
    areaSlug: "ciencias",
    subcategoriaSlug: "ciencias-ambientais",
    dificuldade: "facil",
    ordem: 1,
    enunciado:
      "Qual gás responde pela maior parte do aumento do efeito estufa de origem antrópica desde a Revolução Industrial?",
    alternativas: alts(
      "Oxigênio",
      "Nitrogênio",
      "Dióxido de carbono",
      "Argônio",
      "Hélio",
      "Neônio",
    ),
    letraCorreta: "C",
    explicacao:
      "A queima de combustíveis fósseis e o desmatamento liberam CO2, responsável pela maior parcela do forçamento radiativo adicional. Metano e óxido nitroso também contribuem, com participação menor no total. Oxigênio, nitrogênio e gases nobres não são gases de efeito estufa relevantes.",
    referencia: "IPCC AR6, WG1 — The Physical Science Basis, cap. 6",
  },
  {
    id: "br-ciencias-ambientais-02",
    areaSlug: "ciencias",
    subcategoriaSlug: "ciencias-ambientais",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado:
      "Qual família de substâncias foi apontada como principal responsável pela destruição da camada de ozônio, motivando o Protocolo de Montreal?",
    alternativas: alts(
      "Clorofluorcarbonos",
      "Hidrocarbonetos aromáticos",
      "Óxidos de nitrogênio vulcânicos",
      "Compostos de enxofre",
      "Metais pesados",
      "Gases nobres",
    ),
    letraCorreta: "A",
    explicacao:
      "Os CFCs liberam átomos de cloro na estratosfera, e cada átomo pode destruir milhares de moléculas de ozônio em ciclos catalíticos. O Protocolo de Montreal (1987) baniu essas substâncias e é considerado um dos tratados ambientais mais bem-sucedidos.",
    referencia: "UNEP — Montreal Protocol; NASA Ozone Watch",
  },

  // ================= MATEMÁTICA E EXATAS =================
  {
    id: "br-algebra-01",
    areaSlug: "exatas",
    subcategoriaSlug: "algebra",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado:
      "O Teorema Fundamental da Álgebra garante que um polinômio não constante de grau n, com coeficientes complexos, possui:",
    alternativas: alts(
      "Exatamente n raízes complexas, contadas com multiplicidade",
      "No máximo duas raízes reais",
      "Uma única raiz, sempre real",
      "n raízes, todas obrigatoriamente reais",
      "n + 1 raízes distintas",
      "Nenhuma raiz quando o grau é par",
    ),
    letraCorreta: "A",
    explicacao:
      "Todo polinômio de grau n ≥ 1 sobre os complexos se decompõe em n fatores lineares, logo tem n raízes complexas contadas com multiplicidade. Elas podem ser reais ou não — o teorema não garante raízes reais.",
    referencia: "Wolfram MathWorld — Fundamental theorem of algebra",
  },
  {
    id: "br-algebra-02",
    areaSlug: "exatas",
    subcategoriaSlug: "algebra",
    dificuldade: "facil",
    ordem: 1,
    enunciado: "Qual é o determinante da matriz [[1, 2], [3, 4]]?",
    alternativas: alts("-2", "2", "4", "10", "-10", "0"),
    letraCorreta: "A",
    explicacao:
      "Para a matriz [[a, b], [c, d]] o determinante é ad − bc. Assim, 1×4 − 2×3 = 4 − 6 = −2. Determinante nulo indicaria matriz singular, sem inversa — o que não é o caso.",
    referencia: "Wolfram MathWorld — Determinant",
  },
  {
    id: "br-trigonometria-01",
    areaSlug: "exatas",
    subcategoriaSlug: "trigonometria",
    dificuldade: "facil",
    ordem: 1,
    enunciado: "Qual identidade trigonométrica é verdadeira para todo ângulo θ?",
    alternativas: alts(
      "sen²θ + cos²θ = 1",
      "sen²θ − cos²θ = 1",
      "senθ + cosθ = 1",
      "sen²θ + cos²θ = 0",
      "tgθ = senθ · cosθ",
      "sen²θ = 1 + cos²θ",
    ),
    letraCorreta: "A",
    explicacao:
      "É a identidade pitagórica, consequência direta do teorema de Pitágoras no círculo trigonométrico de raio 1. Dela derivam, por exemplo, 1 + tg²θ = sec²θ e 1 + cotg²θ = cossec²θ.",
    referencia: "NIST Digital Library of Mathematical Functions, §4.21",
  },
  {
    id: "br-trigonometria-02",
    areaSlug: "exatas",
    subcategoriaSlug: "trigonometria",
    dificuldade: "facil",
    ordem: 1,
    enunciado: "Quanto vale sen 30°?",
    alternativas: alts("1/2", "√2/2", "√3/2", "1", "√3", "0"),
    letraCorreta: "A",
    explicacao:
      "No triângulo retângulo de ângulos 30°-60°-90°, o cateto oposto ao ângulo de 30° mede metade da hipotenusa. Daí sen 30° = 1/2, enquanto sen 45° = √2/2 e sen 60° = √3/2.",
    referencia: "NIST DLMF §4.14 — trigonometric values at special angles",
  },
  {
    id: "br-matematica-financeira-01",
    areaSlug: "exatas",
    subcategoriaSlug: "matematica-financeira",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado:
      "Um capital de R$ 1.000 é aplicado a juros compostos de 10% ao ano, sem novos aportes. Qual o montante após 2 anos?",
    alternativas: alts("R$ 1.200,00", "R$ 1.210,00", "R$ 1.100,00", "R$ 1.221,00", "R$ 1.020,00", "R$ 1.300,00"),
    letraCorreta: "B",
    explicacao:
      "M = C(1 + i)^n = 1000 × 1,10² = 1000 × 1,21 = R$ 1.210,00. A juros simples o montante seria R$ 1.200,00 — a diferença de R$ 10 é o juro incidente sobre o juro do primeiro ano.",
    referencia: "Banco Central do Brasil — Matemática financeira (juros compostos)",
  },
  {
    id: "br-matematica-financeira-02",
    areaSlug: "exatas",
    subcategoriaSlug: "matematica-financeira",
    dificuldade: "avancada",
    ordem: 4,
    enunciado:
      "Um investimento rendeu 10% em um ano, enquanto a inflação do período foi de 4%. Qual o ganho real aproximado?",
    alternativas: alts("6,0%", "5,8%", "14,0%", "2,5%", "4,0%", "10,0%"),
    letraCorreta: "B",
    explicacao:
      "A taxa real não é a subtração simples (10% − 4% = 6%). Pela relação de Fisher, (1 + r) = (1 + i)/(1 + π) → 1,10/1,04 ≈ 1,0577, ou seja, cerca de 5,8% de ganho real. Subtrair é apenas uma aproximação, aceitável para taxas muito pequenas.",
    referencia: "Banco Central do Brasil — Relatório de Estabilidade Financeira (taxa real e equação de Fisher)",
  },

  // ================= TECNOLOGIA E COMPUTAÇÃO =================
  {
    id: "br-ciencia-da-computacao-01",
    areaSlug: "tecnologia",
    subcategoriaSlug: "ciencia-da-computacao",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado:
      "Em um vetor ordenado de n elementos, qual é a complexidade de tempo da busca binária no pior caso?",
    alternativas: alts("O(1)", "O(log n)", "O(n)", "O(n log n)", "O(n²)", "O(2ⁿ)"),
    letraCorreta: "B",
    explicacao:
      "A cada comparação o intervalo de busca é reduzido à metade, então o número de passos cresce com o logaritmo de n. Para n = 1.000.000 são cerca de 20 comparações, contra até 1.000.000 na busca linear.",
    referencia: "Cormen et al., Introduction to Algorithms, cap. 2 (binary search)",
  },
  {
    id: "br-ciencia-da-computacao-02",
    areaSlug: "tecnologia",
    subcategoriaSlug: "ciencia-da-computacao",
    dificuldade: "avancada",
    ordem: 4,
    enunciado: "O que a Máquina de Turing representa na teoria da computação?",
    alternativas: alts(
      "Um modelo abstrato de computação capaz de simular qualquer algoritmo efetivo",
      "Um computador quântico de laboratório",
      "Uma linguagem de programação de alto nível",
      "Um banco de dados relacional",
      "Um protocolo de rede",
      "Um tipo de memória não volátil",
    ),
    letraCorreta: "A",
    explicacao:
      "É o modelo formal proposto por Alan Turing em 1936, que define o que é computável; a tese de Church-Turing afirma que tudo efetivamente computável pode ser calculado por ela. Foi nesse modelo que se demonstrou a indecidibilidade do problema da parada.",
    referencia:
      "Turing, On Computable Numbers (1936); Stanford Encyclopedia of Philosophy — Turing machines",
  },
  {
    id: "br-engenharia-de-software-01",
    areaSlug: "tecnologia",
    subcategoriaSlug: "engenharia-de-software",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado: "O 'S' dos princípios SOLID refere-se a qual princípio?",
    alternativas: alts(
      "Princípio da Responsabilidade Única",
      "Princípio do Aberto-Fechado",
      "Princípio da Substituição de Liskov",
      "Princípio da Segregação de Interfaces",
      "Princípio da Inversão de Dependência",
      "Princípio da Menor Surpresa",
    ),
    letraCorreta: "A",
    explicacao:
      "S é o Single Responsibility Principle: um módulo deve ter um único motivo para mudar. O é aberto-fechado, L é Liskov, I é segregação de interfaces e D é inversão de dependência.",
    referencia: "Robert C. Martin — Design Principles and Design Patterns (2000)",
  },
  {
    id: "br-engenharia-de-software-02",
    areaSlug: "tecnologia",
    subcategoriaSlug: "engenharia-de-software",
    dificuldade: "facil",
    ordem: 1,
    enunciado: "Em engenharia de software, o que é refatoração?",
    alternativas: alts(
      "Reescrever o sistema em outra linguagem",
      "Alterar a estrutura interna do código sem mudar seu comportamento observável",
      "Corrigir bugs de produção com urgência",
      "Adicionar novas funcionalidades ao produto",
      "Migrar o banco de dados",
      "Aumentar a cobertura de testes sem tocar no código",
    ),
    letraCorreta: "B",
    explicacao:
      "Refatorar é melhorar o desenho interno — nomes, duplicação, acoplamento — preservando o comportamento externo, com os testes como rede de segurança. Reescrever em outra linguagem é reescrita, e adicionar funcionalidade não é refatoração.",
    referencia: "Martin Fowler, Refactoring (2ª ed.), cap. 1",
  },
  {
    id: "br-eletronica-01",
    areaSlug: "tecnologia",
    subcategoriaSlug: "eletronica",
    dificuldade: "facil",
    ordem: 1,
    enunciado:
      "Um resistor de 10 Ω é percorrido por uma corrente de 2 A. Qual é a tensão sobre ele, pela Lei de Ohm?",
    alternativas: alts("5 V", "20 V", "12 V", "0,2 V", "8 V", "40 V"),
    letraCorreta: "B",
    explicacao:
      "V = R × I = 10 × 2 = 20 V. A Lei de Ohm relaciona tensão, corrente e resistência; a potência dissipada nesse caso seria P = V × I = 40 W.",
    referencia: "Halliday & Resnick, Fundamentos de Física, vol. 3 (corrente e resistência)",
  },
  {
    id: "br-eletronica-02",
    areaSlug: "tecnologia",
    subcategoriaSlug: "eletronica",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado: "Qual é a função principal de um transistor em um circuito eletrônico?",
    alternativas: alts(
      "Armazenar carga de forma permanente",
      "Amplificar sinais e funcionar como chave",
      "Converter corrente alternada em contínua",
      "Medir a temperatura do ambiente",
      "Emitir luz continuamente",
      "Isolar galvanicamente dois circuitos",
    ),
    letraCorreta: "B",
    explicacao:
      "O transistor tem três terminais e controla a corrente entre dois deles por meio do terceiro, o que permite amplificação (analógica) e chaveamento (digital) — é a base dos processadores modernos. Retificação é papel do diodo.",
    referencia: "Sedra & Smith, Microelectronic Circuits, cap. 1",
  },
  {
    id: "br-robotica-01",
    areaSlug: "tecnologia",
    subcategoriaSlug: "robotica",
    dificuldade: "facil",
    ordem: 1,
    enunciado:
      "Qual sensor é comumente usado em robôs móveis para medir a distância até um obstáculo a curto alcance?",
    alternativas: alts(
      "Ultrassônico",
      "Acelerômetro",
      "Giroscópio",
      "Magnetômetro",
      "Termopar",
      "Célula de carga",
    ),
    letraCorreta: "A",
    explicacao:
      "O sensor ultrassônico emite um pulso sonoro e mede o tempo de eco para calcular a distância. Acelerômetro mede aceleração, giroscópio mede velocidade angular, magnetômetro mede campo magnético e a célula de carga mede força.",
    referencia: "Siegwart, Nourbakhsh & Scaramuzza — Introduction to Autonomous Mobile Robots, cap. 4",
  },
  {
    id: "br-robotica-02",
    areaSlug: "tecnologia",
    subcategoriaSlug: "robotica",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado: "Em robótica, os 'graus de liberdade' de um manipulador correspondem a:",
    alternativas: alts(
      "O número de juntas independentes que definem sua configuração no espaço",
      "A quantidade de peças que compõem o braço",
      "A velocidade máxima da ferramenta",
      "A carga máxima que ele levanta",
      "O número de motores ligados ao mesmo tempo",
      "A precisão de repetição do movimento",
    ),
    letraCorreta: "A",
    explicacao:
      "Cada grau de liberdade é uma variável independente de movimento, de rotação ou translação. Um braço com 6 graus de liberdade consegue posicionar e orientar a ferramenta livremente no espaço tridimensional. Carga e precisão são especificações distintas.",
    referencia: "John J. Craig, Introduction to Robotics, cap. 1",
  },

  // ================= FILOSOFIA E PENSAMENTO =================
  {
    id: "br-filosofia-moderna-01",
    areaSlug: "filosofia",
    subcategoriaSlug: "filosofia-moderna",
    dificuldade: "facil",
    ordem: 1,
    enunciado:
      "Qual filósofo moderno chegou à conclusão 'Penso, logo existo' (Cogito, ergo sum) como primeira certeza indubitável?",
    alternativas: alts(
      "René Descartes",
      "Immanuel Kant",
      "John Locke",
      "Baruch de Espinosa",
      "Francis Bacon",
      "David Hume",
    ),
    letraCorreta: "A",
    explicacao:
      "Descartes, no Discurso do Método (1637) e nas Meditações (1641), aplicou a dúvida metódica a tudo e encontrou no próprio ato de pensar uma certeza que resistia à dúvida. Kant e Hume vêm depois; Espinosa foi contemporâneo e interlocutor crítico de Descartes.",
    referencia: "Stanford Encyclopedia of Philosophy — René Descartes",
  },
  {
    id: "br-filosofia-moderna-02",
    areaSlug: "filosofia",
    subcategoriaSlug: "filosofia-moderna",
    dificuldade: "avancada",
    ordem: 4,
    enunciado:
      "Kant chamou de 'revolução copernicana' na filosofia a tese de que:",
    alternativas: alts(
      "O conhecimento se dá quando o objeto se conforma às estruturas do sujeito, e não o contrário",
      "A Terra gira em torno do Sol",
      "Todo conhecimento vem da experiência sensível",
      "Deus é a causa primeira de todas as coisas",
      "A mente é uma tábula rasa",
      "A verdade depende de cada cultura",
    ),
    letraCorreta: "A",
    explicacao:
      "Assim como Copérnico pôs o observador em movimento, Kant (Crítica da Razão Pura, 1781) propôs que as condições do conhecimento estão no sujeito: espaço, tempo e categorias organizam o que é dado à sensibilidade. Isso encerra o impasse entre racionalismo e empirismo, pois há conhecimento sintético a priori.",
    referencia: "Stanford Encyclopedia of Philosophy — Kant's Critique of Pure Reason",
  },
  {
    id: "br-filosofia-contemporanea-01",
    areaSlug: "filosofia",
    subcategoriaSlug: "filosofia-contemporanea",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado:
      "Na obra 'A Condição Humana' (1958), Hannah Arendt distingue três atividades fundamentais da vida ativa. Quais são?",
    alternativas: alts(
      "Labor, trabalho e ação",
      "Sensação, percepção e razão",
      "Dúvida, crença e certeza",
      "Desejo, vontade e dever",
      "Instinto, hábito e reflexão",
      "Produção, consumo e acumulação",
    ),
    letraCorreta: "A",
    explicacao:
      "Arendt separa o labor (a atividade cíclica que mantém a vida biológica), o trabalho (que produz objetos duráveis, o mundo artificial) e a ação (a atividade política, em que as pessoas aparecem umas às outras pela fala e pelo ato). A modernidade teria subordinado a ação ao labor.",
    referencia: "Hannah Arendt — The Human Condition (1958); Stanford Encyclopedia of Philosophy",
  },
  {
    id: "br-filosofia-contemporanea-02",
    areaSlug: "filosofia",
    subcategoriaSlug: "filosofia-contemporanea",
    dificuldade: "avancada",
    ordem: 4,
    enunciado:
      "No experimento mental do 'véu da ignorância', John Rawls pede que se escolham os princípios de justiça:",
    alternativas: alts(
      "Sem saber qual posição social, talento ou concepção de bem se terá na sociedade",
      "A partir do que cada um já possui",
      "Considerando apenas a utilidade total agregada",
      "Segundo a vontade geral de um soberano",
      "Com base na tradição herdada",
      "Ignorando qualquer noção de cooperação social",
    ),
    letraCorreta: "A",
    explicacao:
      "Em 'Uma Teoria da Justiça' (1971), Rawls imagina uma posição original em que as partes escolhem princípios sem conhecer seus atributos particulares. Isso garante imparcialidade e leva a dois princípios: igualdade de liberdades básicas e o princípio da diferença, que admite desigualdades apenas se beneficiarem os menos favorecidos.",
    referencia: "John Rawls — A Theory of Justice (1971); Stanford Encyclopedia of Philosophy",
  },
  {
    id: "br-metafisica-01",
    areaSlug: "filosofia",
    subcategoriaSlug: "metafisica",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado:
      "Para Aristóteles, a metafísica é a ciência que estuda:",
    alternativas: alts(
      "O ser enquanto ser",
      "A alma humana exclusivamente",
      "Os astros e seu movimento",
      "A linguagem e seus usos",
      "A beleza das obras de arte",
      "As leis positivas das cidades",
    ),
    letraCorreta: "A",
    explicacao:
      "Aristóteles define a 'filosofia primeira' como o estudo do ser enquanto ser — suas causas e princípios mais gerais —, distinta das ciências particulares que recortam um tipo de ente. Os livros que reuniram esses tratados receberam o título 'Metafísica' por virem depois dos de física.",
    referencia: "Stanford Encyclopedia of Philosophy — Aristotle's Metaphysics",
  },
  {
    id: "br-metafisica-02",
    areaSlug: "filosofia",
    subcategoriaSlug: "metafisica",
    dificuldade: "avancada",
    ordem: 4,
    enunciado: "O 'problema dos universais' na metafísica pergunta, essencialmente:",
    alternativas: alts(
      "Se as propriedades compartilhadas por várias coisas (como a vermelhidão) existem em si ou apenas nos nomes e nas mentes",
      "Se o mundo é feito de uma só substância ou de muitas",
      "Se o tempo tem começo e fim",
      "Se a liberdade é compatível com o determinismo",
      "Se o conhecimento deriva da razão ou da experiência",
      "Se a beleza é objetiva ou subjetiva",
    ),
    letraCorreta: "A",
    explicacao:
      "O debate opõe realistas (os universais existem independentemente das coisas, como queria Platão) a nominalistas (são apenas nomes ou convenções, como sustentou Ockham), com posições intermediárias como o realismo moderado de Aristóteles, em que a forma existe nas próprias coisas. É uma questão sobre a estrutura da realidade, não sobre a origem do conhecimento.",
    referencia: "Stanford Encyclopedia of Philosophy — The Problem of Universals",
  },
  {
    id: "br-logica-01",
    areaSlug: "filosofia",
    subcategoriaSlug: "logica",
    dificuldade: "facil",
    ordem: 1,
    enunciado:
      "Na lógica proposicional, se 'Se chove, então a rua fica molhada' e sabemos que chove, o que se conclui validamente?",
    alternativas: alts(
      "A rua fica molhada",
      "Não chove",
      "A rua não fica molhada",
      "Choveu ontem",
      "Nada se conclui",
      "A rua fica seca",
    ),
    letraCorreta: "A",
    explicacao:
      "É o modus ponens: de P → Q e P conclui-se Q. Afirmar o consequente (Q, logo P) ou negar o antecedente (não P, logo não Q) são falácias — válido é também o modus tollens: de P → Q e não Q, conclui-se não P.",
    referencia: "Stanford Encyclopedia of Philosophy — Classical Logic",
  },
  {
    id: "br-logica-02",
    areaSlug: "filosofia",
    subcategoriaSlug: "logica",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado: "Um argumento dedutivamente válido é aquele em que:",
    alternativas: alts(
      "É impossível que as premissas sejam verdadeiras e a conclusão falsa",
      "As premissas são sempre verdadeiras",
      "A conclusão é provável, mas não certa",
      "A conclusão é mais ampla que as premissas",
      "Todas as premissas são observações empíricas",
      "A conclusão repete uma das premissas",
    ),
    letraCorreta: "A",
    explicacao:
      "Validade é uma propriedade da forma: se as premissas forem verdadeiras, a conclusão não pode ser falsa. Isso não exige que as premissas sejam de fato verdadeiras — um argumento pode ser válido e ter premissa falsa (som). Argumentos indutivos apenas tornam a conclusão provável.",
    referencia: "Stanford Encyclopedia of Philosophy — Validity and Soundness",
  },
  {
    id: "br-filosofia-politica-01",
    areaSlug: "filosofia",
    subcategoriaSlug: "filosofia-politica",
    dificuldade: "facil",
    ordem: 1,
    enunciado:
      "Qual obra de Thomas Hobbes descreve o estado de natureza como uma 'guerra de todos contra todos' e defende um soberano forte?",
    alternativas: alts(
      "Leviatã",
      "A República",
      "O Príncipe",
      "A Riqueza das Nações",
      "Do Contrato Social",
      "A Política",
    ),
    letraCorreta: "A",
    explicacao:
      "Em 'Leviatã' (1651), Hobbes parte do medo da morte violenta para justificar um pacto em que os indivíduos transferem poder a um soberano capaz de garantir a paz. 'A República' é de Platão, 'O Príncipe' de Maquiavel e 'Do Contrato Social' de Rousseau.",
    referencia: "Stanford Encyclopedia of Philosophy — Thomas Hobbes",
  },
  {
    id: "br-filosofia-politica-02",
    areaSlug: "filosofia",
    subcategoriaSlug: "filosofia-politica",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado:
      "A distinção entre 'liberdade negativa' e 'liberdade positiva', popularizada por Isaiah Berlin, corresponde a:",
    alternativas: alts(
      "Ausência de interferência externa versus capacidade de ser senhor de si mesmo",
      "Liberdade econômica versus liberdade religiosa",
      "Liberdade civil versus liberdade penal",
      "Liberdade individual versus liberdade coletiva",
      "Liberdade de expressão versus liberdade de imprensa",
      "Liberdade antiga versus liberdade moderna",
    ),
    letraCorreta: "A",
    explicacao:
      "No ensaio 'Dois Conceitos de Liberdade' (1958), Berlin opõe a liberdade negativa (ninguém me impede; um espaço sem obstáculos) à positiva (quero ser autor das minhas próprias escolhas). Ele alerta que a versão positiva, ao dividir o eu em superior e inferior, pode justificar coerção em nome da autonomia real.",
    referencia: "Isaiah Berlin — Two Concepts of Liberty (1958)",
  },

  // ================= CIÊNCIAS HUMANAS E SOCIAIS =================
  {
    id: "br-antropologia-01",
    areaSlug: "humanas",
    subcategoriaSlug: "antropologia",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado:
      "A 'observação participante', método que se tornou marca da antropologia social, foi consolidada por qual autor?",
    alternativas: alts(
      "Bronisław Malinowski",
      "Karl Marx",
      "Émile Durkheim",
      "Max Weber",
      "Sigmund Freud",
      "Auguste Comte",
    ),
    letraCorreta: "A",
    explicacao:
      "Malinowski, em 'Argonautas do Pacífico Ocidental' (1922), defendeu viver entre os nativos, aprender a língua e registrar a vida cotidiana — o trabalho de campo prolongado substituiu o relato de viajantes e missionários. Durkheim e Weber são fundadores da sociologia, não da observação participante.",
    referencia: "Malinowski — Argonauts of the Western Pacific (1922)",
  },
  {
    id: "br-antropologia-02",
    areaSlug: "humanas",
    subcategoriaSlug: "antropologia",
    dificuldade: "avancada",
    ordem: 4,
    enunciado:
      "Na antropologia estrutural de Claude Lévi-Strauss, o que se busca identificar por trás dos mitos e parentescos?",
    alternativas: alts(
      "Estruturas inconscientes de oposições que organizam o pensamento humano",
      "A origem genética dos povos",
      "A evolução biológica das espécies",
      "As leis econômicas universais",
      "Os arquétipos judaico-cristãos",
      "A superioridade de uma cultura sobre outra",
    ),
    letraCorreta: "A",
    explicacao:
      "Lévi-Strauss propõe que os mitos não são narrativas arbitrárias: organizam-se por pares de oposições (cru/cozido, natureza/cultura) que revelam estruturas do espírito humano, inconscientes e comuns. Isso rompe com a leitura evolucionista que hierarquizava culturas.",
    referencia: "Lévi-Strauss — Anthropologie structurale (1958); Stanford Encyclopedia of Philosophy",
  },
  {
    id: "br-ciencia-politica-01",
    areaSlug: "humanas",
    subcategoriaSlug: "ciencia-politica",
    dificuldade: "facil",
    ordem: 1,
    enunciado:
      "A separação dos poderes em Executivo, Legislativo e Judiciário foi sistematizada por qual pensador?",
    alternativas: alts(
      "Montesquieu",
      "Nicolau Maquiavel",
      "Jean-Jacques Rousseau",
      "Karl Marx",
      "Alexis de Tocqueville",
      "Thomas More",
    ),
    letraCorreta: "A",
    explicacao:
      "Montesquieu, em 'O Espírito das Leis' (1748), sustenta que só o poder freia o poder, propondo a divisão em três funções. A ideia influenciou diretamente a Constituição dos Estados Unidos e a Declaração dos Direitos do Homem. A formulação tripartite também ecoa Locke, mas a sistematização clássica é de Montesquieu.",
    referencia: "Montesquieu — De l'esprit des lois (1748); Encyclopaedia Britannica",
  },
  {
    id: "br-ciencia-politica-02",
    areaSlug: "humanas",
    subcategoriaSlug: "ciencia-politica",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado:
      "O conceito de 'poliarquia', formulado por Robert Dahl, descreve:",
    alternativas: alts(
      "Regimes com disputa eleitoral competitiva, participação ampliada e liberdades civis garantidas",
      "O governo de um só partido",
      "A ditadura da maioria sobre a minoria",
      "O governo dos especialistas técnicos",
      "A ausência total de Estado",
      "O império mundial de uma potência",
    ),
    letraCorreta: "A",
    explicacao:
      "Dahl (Polyarchy, 1971) usa 'poliarquia' para os regimes realmente existentes que combinam contestação pública e participação inclusiva, evitando chamar de democracia plena o que é aproximação. O conceito deu base a índices contemporâneos de qualidade democrática.",
    referencia: "Robert A. Dahl — Polyarchy: Participation and Opposition (1971)",
  },
  {
    id: "br-historia-das-civilizacoes-01",
    areaSlug: "humanas",
    subcategoriaSlug: "historia-das-civilizacoes",
    dificuldade: "facil",
    ordem: 1,
    enunciado:
      "Qual civilização desenvolveu uma das primeiras formas de escrita, a cuneiforme, gravada em tábuas de argila?",
    alternativas: alts(
      "Suméria, na Mesopotâmia",
      "Egito faraônico",
      "Império Romano",
      "Grécia clássica",
      "Império Inca",
      "China imperial",
    ),
    letraCorreta: "A",
    explicacao:
      "A escrita cuneiforme surge na Suméria por volta de 3200 a.C., inicialmente para registros contábeis, e antecede os hieróglifos egípcios em séculos. Os incas, no outro extremo, não tinham escrita no sentido estrito — usavam quipos.",
    referencia: "British Museum — Mesopotamia, writing and cuneiform tablets",
  },
  {
    id: "br-historia-das-civilizacoes-02",
    areaSlug: "humanas",
    subcategoriaSlug: "historia-das-civilizacoes",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado:
      "A 'Rota da Seda' foi historicamente importante sobretudo porque:",
    alternativas: alts(
      "Conectou Ásia, Oriente Médio e Europa em redes de troca de mercadorias, técnicas e ideias",
      "Foi uma estrada pavimentada construída por Roma",
      "Serviu apenas ao transporte de seda chinesa",
      "Ligava diretamente Lisboa ao Rio de Janeiro",
      "Foi criada no século XX para o comércio de petróleo",
      "Era uma rota exclusivamente marítima",
    ),
    letraCorreta: "A",
    explicacao:
      "Mais que um caminho único, a Rota da Seda foi uma malha de rotas terrestres e marítimas que circulou mercadorias, tecnologias (papel, pólvora), religiões e doenças — inclusive a peste negra. Chamá-la só de rota de seda subestima o intercâmbio cultural.",
    referencia: "UNESCO — Silk Roads Programme",
  },
  {
    id: "br-geopolitica-01",
    areaSlug: "humanas",
    subcategoriaSlug: "geopolitica",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado:
      "A teoria do 'heartland' (área-pivô da Eurásia), segundo a qual quem domina o centro do continente domina o mundo, foi proposta por:",
    alternativas: alts(
      "Halford Mackinder",
      "Alfred Mahan",
      "Karl Haushofer",
      "Nicholas Spykman",
      "Fernand Braudel",
      "Immanuel Wallerstein",
    ),
    letraCorreta: "A",
    explicacao:
      "Mackinder apresentou a tese em 1904 ('The Geographical Pivot of History'), reformulada em 1919 com o termo heartland. Spykman depois deslocou o foco para o 'rimland', a faixa costeira da Eurásia. Mahan é o teórico do poder naval.",
    referencia: "Halford J. Mackinder — The Geographical Pivot of History (1904)",
  },
  {
    id: "br-geopolitica-02",
    areaSlug: "humanas",
    subcategoriaSlug: "geopolitica",
    dificuldade: "avancada",
    ordem: 4,
    enunciado:
      "Por que os Estreitos de Malaca têm peso estratégico mundial?",
    alternativas: alts(
      "Por concentrarem parcela decisiva do comércio marítimo entre o Índico e o Pacífico, inclusive petróleo",
      "Por serem a única ligação entre Atlântico e Pacífico",
      "Por abrigarem a maior reserva de petróleo do planeta",
      "Por serem o ponto mais profundo dos oceanos",
      "Por ligarem o Mar Mediterrâneo ao Mar Vermelho",
      "Por estarem sob administração da ONU",
    ),
    letraCorreta: "A",
    explicacao:
      "É uma das passagens mais movimentadas do mundo, gargalo para o comércio entre Ásia e Europa e para o petróleo do Golfo rumo ao Leste Asiático. Ligar Atlântico e Pacífico é o Canal do Panamá; ligar Mediterrâneo e Mar Vermelho é o Canal de Suez.",
    referencia: "EIA — World Oil Transit Chokepoints (Malacca Strait)",
  },
  {
    id: "br-arqueologia-01",
    areaSlug: "humanas",
    subcategoriaSlug: "arqueologia",
    dificuldade: "facil",
    ordem: 1,
    enunciado:
      "Qual método permite datar material orgânico (madeira, osso, carvão) com base na desintegração de um isótopo do carbono?",
    alternativas: alts(
      "Carbono-14",
      "Termoluminescência",
      "Potássio-argônio",
      "Dendrocronologia",
      "Estratigrafia",
      "Uranio-tório",
    ),
    letraCorreta: "A",
    explicacao:
      "O carbono-14 se forma na atmosfera e é absorvido pelos seres vivos; quando morrem, o isótopo decai com meia-vida de cerca de 5.730 anos, o que permite datar material orgânico até ~50 mil anos. Potássio-argônio serve para rochas vulcânicas e dendrocronologia para madeira com anéis.",
    referencia: "Libby, Radiocarbon Dating (Nobel de Química 1960); Beta Analytic",
  },
  {
    id: "br-arqueologia-02",
    areaSlug: "humanas",
    subcategoriaSlug: "arqueologia",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado:
      "No registro arqueológico, o 'princípio da superposição' de camadas indica que:",
    alternativas: alts(
      "Em depósitos não perturbados, a camada inferior é mais antiga que a superior",
      "A camada superior é sempre a mais antiga",
      "Todas as camadas têm a mesma idade",
      "A idade depende só do tipo de solo",
      "Artefatos mais bonitos são mais antigos",
      "Camadas profundas são sempre estéreis",
    ),
    letraCorreta: "A",
    explicacao:
      "É o princípio básico da estratigrafia, formulado na geologia e incorporado à arqueologia: o sedimento se acumula em ordem, então camadas mais fundas são mais antigas — desde que o sítio não tenha sido revirado por animais, raízes ou escavações posteriores.",
    referencia: "Renfrew & Bahn — Archaeology: Theories, Methods and Practice, cap. 3",
  },
  {
    id: "br-demografia-01",
    areaSlug: "humanas",
    subcategoriaSlug: "demografia",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado: "A 'transição demográfica' descreve a passagem de um regime populacional:",
    alternativas: alts(
      "De altas taxas de natalidade e mortalidade para taxas baixas, com crescimento intermediário acelerado",
      "De população jovem para população idosa sem mudança nas taxas",
      "De êxodo rural para urbanização completa",
      "De migração interna para migração internacional",
      "De mortalidade infantil alta para expectativa de vida decrescente",
      "De censos anuais para censos decenais",
    ),
    letraCorreta: "A",
    explicacao:
      "Na transição clássica, a mortalidade cai primeiro (saneamento, vacinas, medicina) e a natalidade demora mais para cair — por isso o crescimento explode no meio do processo e depois estabiliza. A queda simultânea de ambas gera o envelhecimento populacional que se observa hoje.",
    referencia: "ONU — World Population Prospects (teoria da transição demográfica)",
  },
  {
    id: "br-demografia-02",
    areaSlug: "humanas",
    subcategoriaSlug: "demografia",
    dificuldade: "facil",
    ordem: 1,
    enunciado: "No Brasil, o censo demográfico é realizado pelo:",
    alternativas: alts(
      "IBGE",
      "Banco Central",
      "Ministério da Saúde",
      "INSS",
      "IPEA",
      "Receita Federal",
    ),
    letraCorreta: "A",
    explicacao:
      "O Instituto Brasileiro de Geografia e Estatística (IBGE) é o órgão responsável pelo censo decenal, que conta a população e levanta características socioeconômicas. IPEA faz pesquisa econômica aplicada, mas não o censo.",
    referencia: "IBGE — Censo Demográfico",
  },

  // ================= PSICOLOGIA E COMPORTAMENTO =================
  {
    id: "br-psicologia-comportamental-01",
    areaSlug: "psicologia",
    subcategoriaSlug: "psicologia-comportamental",
    dificuldade: "facil",
    ordem: 1,
    enunciado:
      "No condicionamento clássico descrito por Ivan Pavlov, o que acontece quando um estímulo neutro é repetidamente associado a um estímulo que já provoca resposta?",
    alternativas: alts(
      "O estímulo neutro passa a provocar a resposta por si só",
      "A resposta desaparece definitivamente",
      "O animal deixa de responder a qualquer estímulo",
      "A resposta se torna voluntária e consciente",
      "O estímulo incondicionado perde efeito imediato",
      "Surge uma resposta totalmente nova, sem relação com a anterior",
    ),
    letraCorreta: "A",
    explicacao:
      "Pavlov observou que um som (estímulo neutro), associado repetidas vezes à comida (estímulo incondicionado), passava a provocar salivação sozinho — o estímulo condicionado. É aprendizagem por associação, distinta do condicionamento operante de Skinner, que trabalha com consequências.",
    referencia: "Pavlov — Conditioned Reflexes (1927); APA Dictionary of Psychology",
  },
  {
    id: "br-psicologia-comportamental-02",
    areaSlug: "psicologia",
    subcategoriaSlug: "psicologia-comportamental",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado:
      "Na análise do comportamento, qual é a diferença central entre reforço negativo e punição?",
    alternativas: alts(
      "O reforço negativo aumenta a frequência do comportamento; a punição a diminui",
      "O reforço negativo pune; a punição recompensa",
      "Ambos aumentam a frequência do comportamento",
      "O reforço negativo é sempre um castigo físico",
      "A punição só existe em humanos",
      "O reforço negativo extingue o comportamento",
    ),
    letraCorreta: "A",
    explicacao:
      "Reforço (positivo ou negativo) sempre AUMENTA a frequência: o negativo faz isso removendo um estímulo aversivo — como tomar um analgésico que tira a dor. Punição diminui a frequência. O nome 'negativo' se refere à retirada de estímulo, não a algo ruim.",
    referencia: "Skinner — Science and Human Behavior (1953); APA Dictionary of Psychology",
  },
  {
    id: "br-neuropsicologia-01",
    areaSlug: "psicologia",
    subcategoriaSlug: "neuropsicologia",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado:
      "O caso de Phineas Gage, operário que sobreviveu a uma barra atravessando o crânio em 1848, tornou-se clássico na neuropsicologia porque evidenciou o papel de qual região?",
    alternativas: alts(
      "Córtex pré-frontal, ligado ao controle de impulsos e ao comportamento social",
      "Cerebelo, ligado ao equilíbrio",
      "Bulbo, ligado à respiração",
      "Hipotálamo, ligado à temperatura",
      "Nervo óptico, ligado à visão",
      "Medula espinhal, ligada aos reflexos",
    ),
    letraCorreta: "A",
    explicacao:
      "Gage manteve funções motoras e de linguagem, mas sua personalidade e seu autocontrole mudaram de forma marcante. O caso passou a sustentar a ideia de que o córtex pré-frontal integra planejamento, inibição de impulsos e conduta social — hoje confirmado por lesões e neuroimagem.",
    referencia: "Damasio et al. — The return of Phineas Gage (Science, 1994)",
  },
  {
    id: "br-neuropsicologia-02",
    areaSlug: "psicologia",
    subcategoriaSlug: "neuropsicologia",
    dificuldade: "avancada",
    ordem: 4,
    enunciado:
      "Qual é a diferença entre a afasia de Broca e a afasia de Wernicke?",
    alternativas: alts(
      "Broca: fala difícil de produzir, mas compreensão relativamente preservada. Wernicke: fala fluente, mas sem sentido e com compreensão prejudicada",
      "Broca afeta a visão; Wernicke afeta a audição",
      "Broca atinge apenas crianças; Wernicke apenas adultos",
      "Broca é sempre reversível; Wernicke é sempre definitiva",
      "Broca prejudica a leitura em voz alta; Wernicke, o cálculo",
      "São nomes diferentes para a mesma condição",
    ),
    letraCorreta: "A",
    explicacao:
      "A afasia de Broca (área frontal) é não fluente: o paciente esforça-se para emitir frases curtas, mas costuma entender o que lhe dizem. A de Wernicke (área temporal) é fluente porém vazia: o paciente fala com ritmo e entonação normais, com palavras trocadas ou inventadas, e não compreende bem o que ouve.",
    referencia: "NIH/NIDCD — Aphasia; Kandel et al., Principles of Neural Science",
  },
  {
    id: "br-desenvolvimento-humano-01",
    areaSlug: "psicologia",
    subcategoriaSlug: "desenvolvimento-humano",
    dificuldade: "facil",
    ordem: 1,
    enunciado:
      "Segundo Jean Piaget, em qual estágio a criança passa a operar com conceitos abstratos e hipotéticos, por volta dos 11 anos em diante?",
    alternativas: alts(
      "Operatório formal",
      "Sensório-motor",
      "Pré-operatório",
      "Operatório concreto",
      "Estágio oral",
      "Estágio de latência",
    ),
    letraCorreta: "A",
    explicacao:
      "Piaget descreve quatro estágios: sensório-motor (0-2), pré-operatório (2-7), operatório concreto (7-11) e operatório formal (11+), quando surge o raciocínio hipotético-dedutivo. 'Estágio oral' e 'latência' são termos de Freud, não de Piaget.",
    referencia: "Piaget — A Epistemologia Genética; APA Dictionary of Psychology",
  },
  {
    id: "br-desenvolvimento-humano-02",
    areaSlug: "psicologia",
    subcategoriaSlug: "desenvolvimento-humano",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado:
      "Nos estudos de Mary Ainsworth sobre apego, o procedimento que observa como o bebê reage à separação e ao retorno da mãe chama-se:",
    alternativas: alts(
      "Situação estranha",
      "Teste de Rorschach",
      "Quociente de inteligência",
      "Escala de Apgar",
      "Experimento de Milgram",
      "Teste de Stroop",
    ),
    letraCorreta: "A",
    explicacao:
      "A 'situação estranha' (Strange Situation) expõe o bebê a breves separações e reencontros com a figura de apego, classificando o vínculo em seguro, inseguro-evitativo e inseguro-ambivalente (depois acrescido o desorganizado). Rorschach e Stroop são testes psicológicos de outra natureza; Apgar avalia o recém-nascido.",
    referencia: "Ainsworth et al. — Patterns of Attachment (1978)",
  },
  {
    id: "br-psicanalise-01",
    areaSlug: "psicologia",
    subcategoriaSlug: "psicanalise",
    dificuldade: "facil",
    ordem: 1,
    enunciado:
      "Na segunda tópica freudiana, quais são as três instâncias do aparelho psíquico?",
    alternativas: alts(
      "Id, ego e superego",
      "Consciente, pré-consciente e inconsciente",
      "Pulsão, desejo e fantasia",
      "Oral, anal e fálico",
      "Eros, tânatos e libido",
      "Eu, outro e espelho",
    ),
    letraCorreta: "A",
    explicacao:
      "O id busca a satisfação imediata pelo princípio do prazer; o ego negocia com a realidade; o superego internaliza normas e ideais. 'Consciente, pré-consciente e inconsciente' é a primeira tópica — outra divisão, não a mesma.",
    referencia: "Freud — O Ego e o Id (1923); APA Dictionary of Psychology",
  },
  {
    id: "br-psicanalise-02",
    areaSlug: "psicologia",
    subcategoriaSlug: "psicanalise",
    dificuldade: "avancada",
    ordem: 4,
    enunciado: "Na clínica psicanalítica, o fenômeno da 'transferência' consiste em:",
    alternativas: alts(
      "O paciente deslocar para o analista sentimentos e fantasias originalmente ligados a figuras do passado",
      "O analista contar sua própria história ao paciente",
      "A troca de diagnóstico entre dois profissionais",
      "A mudança de consultório durante o tratamento",
      "A passagem do tratamento individual para o de grupo",
      "A substituição de um sintoma por outro",
    ),
    letraCorreta: "A",
    explicacao:
      "Freud notou que o paciente revive no vínculo com o analista padrões afetivos antigos, sobretudo os parentais. Longe de ser só um obstáculo, a transferência é o material central do trabalho analítico — e exige que o analista reconheça também sua própria contratransferência. A troca de um sintoma por outro é a 'conversão'.",
    referencia: "Freud — A Dinâmica da Transferência (1912); Laplanche & Pontalis, Vocabulário de Psicanálise",
  },
  {
    id: "br-teorias-da-personalidade-01",
    areaSlug: "psicologia",
    subcategoriaSlug: "teorias-da-personalidade",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado:
      "O modelo dos 'Cinco Grandes Fatores' descreve a personalidade por quais dimensões?",
    alternativas: alts(
      "Abertura, conscienciosidade, extroversão, amabilidade e neuroticismo",
      "Sangue, fleuma, bile amarela e bile negra",
      "Oral, anal, fálico, latência e genital",
      "Id, ego, superego, libido e pulsão",
      "Introvertido, extrovertido, sensorial e intuitivo",
      "Racional, emocional, ativo e passivo",
    ),
    letraCorreta: "A",
    explicacao:
      "O Big Five (OCEAN) emergiu de análises fatoriais de descritores de personalidade e é hoje o modelo mais aceito na pesquisa. Os quatro humores são a teoria hipocrática-galênica; as fases oral a genital são de Freud; sensorial/intuitivo pertencem ao MBTI.",
    referencia: "Costa & McCrae — Revised NEO Personality Inventory (NEO-PI-R)",
  },
  {
    id: "br-teorias-da-personalidade-02",
    areaSlug: "psicologia",
    subcategoriaSlug: "teorias-da-personalidade",
    dificuldade: "avancada",
    ordem: 4,
    enunciado: "O conceito de 'inconsciente coletivo' foi formulado por:",
    alternativas: alts(
      "Carl Gustav Jung",
      "Sigmund Freud",
      "Alfred Adler",
      "B. F. Skinner",
      "Abraham Maslow",
      "Jean Piaget",
    ),
    letraCorreta: "A",
    explicacao:
      "Jung propôs que, além do inconsciente pessoal, existiria uma camada compartilhada pela espécie, povoada de arquétipos como a Grande Mãe e o Sábio. Adler enfatizou sentimento de inferioridade e busca de poder; Maslow, a hierarquia das necessidades.",
    referencia: "Jung — Os Arquétipos e o Inconsciente Coletivo (Obras Completas, vol. 9/1)",
  },
  {
    id: "br-comportamento-coletivo-01",
    areaSlug: "psicologia",
    subcategoriaSlug: "comportamento-coletivo",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado:
      "Nos experimentos de Solomon Asch sobre conformidade, o que se observou nos participantes quando cúmplices davam respostas visivelmente erradas sobre o comprimento de linhas?",
    alternativas: alts(
      "Muitos participantes passaram a dar a resposta errada do grupo, mesmo sabendo qual era a correta",
      "Nenhum participante foi influenciado",
      "Todos denunciaram os cúmplices imediatamente",
      "Os participantes acertaram mais do que sozinhos",
      "A influência só ocorreu quando havia punição",
      "Apenas crianças foram afetadas",
    ),
    letraCorreta: "A",
    explicacao:
      "Asch (1951) mostrou que uma parcela expressiva dos participantes acompanhava a maioria mesmo em tarefa perceptiva trivial, revelando a força da pressão do grupo sobre o julgamento individual. Muitos relatavam desconforto e dúvida sobre a própria percepção.",
    referencia: "Asch — Effects of group pressure upon the modification and distortion of judgments (1951)",
  },
  {
    id: "br-comportamento-coletivo-02",
    areaSlug: "psicologia",
    subcategoriaSlug: "comportamento-coletivo",
    dificuldade: "avancada",
    ordem: 4,
    enunciado:
      "O 'efeito espectador', estudado por Darley e Latané, descreve a tendência de uma pessoa a:",
    alternativas: alts(
      "Ajudar menos quando há outras pessoas presentes, por difusão de responsabilidade",
      "Ajudar mais quando está sozinha do que em grupo",
      "Imitar automaticamente quem está por perto",
      "Agir de forma mais agressiva em multidões",
      "Julgar os outros pelo próprio comportamento",
      "Recordar melhor eventos testemunhados em grupo",
    ),
    letraCorreta: "A",
    explicacao:
      "Quanto mais pessoas presentes, menor a chance de alguém intervir, porque a responsabilidade se dilui e cada um busca nos outros sinais de que há emergência. O oposto do senso comum 'quanto mais gente, mais seguro'. O primeiro item descreve o mesmo achado; o segundo o contradiz.",
    referencia: "Darley & Latané — Bystander intervention in emergencies (JPSP, 1968)",
  },

  // ================= HISTÓRIA =================
  {
    id: "br-historia-moderna-01",
    areaSlug: "historia",
    subcategoriaSlug: "historia-moderna",
    dificuldade: "facil",
    ordem: 1,
    enunciado:
      "Qual evento de 1789 é considerado o marco inicial da Revolução Francesa, com a queda de uma prisão símbolo do absolutismo?",
    alternativas: alts(
      "A Queda da Bastilha",
      "A Batalha de Waterloo",
      "A Noite de São Bartolomeu",
      "O Congresso de Viena",
      "A Revolução de 1848",
      "A Comuna de Paris",
    ),
    letraCorreta: "A",
    explicacao:
      "Em 14 de julho de 1789 o povo de Paris tomou a Bastilha, prisão que simbolizava o poder arbitrário do rei. A data é feriado nacional na França. Waterloo (1815) encerra a era napoleônica; o Congresso de Viena (1814-15) reorganiza a Europa depois.",
    referencia: "Encyclopaedia Britannica — French Revolution; Arquivo Nacional da França",
  },
  {
    id: "br-historia-moderna-02",
    areaSlug: "historia",
    subcategoriaSlug: "historia-moderna",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado:
      "A Paz de Vestfália (1648), que encerrou a Guerra dos Trinta Anos, é apontada como marco porque:",
    alternativas: alts(
      "Consolidou a ideia de soberania dos Estados e a não interferência em assuntos internos alheios",
      "Criou a Organização das Nações Unidas",
      "Dividiu a África entre potências europeias",
      "Estabeleceu o fim da escravidão na Europa",
      "Unificou a Alemanha em um só império",
      "Proibiu guerras entre países cristãos para sempre",
    ),
    letraCorreta: "A",
    explicacao:
      "Vestfália reconheceu a soberania dos Estados e a igualdade formal entre eles, base do chamado sistema westfaliano das relações internacionais. A ONU é de 1945 e a partilha da África, da Conferência de Berlim (1884-85).",
    referencia: "Encyclopaedia Britannica — Peace of Westphalia; ONU, coleção de tratados",
  },
  {
    id: "br-historia-da-america-01",
    areaSlug: "historia",
    subcategoriaSlug: "historia-da-america",
    dificuldade: "facil",
    ordem: 1,
    enunciado:
      "Qual foi o primeiro país da América Latina a conquistar a independência, em 1804, após uma revolução liderada por pessoas escravizadas?",
    alternativas: alts("Haiti", "Brasil", "México", "Argentina", "Cuba", "Chile"),
    letraCorreta: "A",
    explicacao:
      "A Revolução Haitiana (1791-1804) derrotou as forças coloniais francesas e criou a primeira república negra do mundo, com Toussaint Louverture e Jean-Jacques Dessalines entre os líderes. O Brasil declara independência em 1822 e o México em 1821.",
    referencia: "Encyclopaedia Britannica — Haitian Revolution; UNESCO — Slave Route Project",
  },
  {
    id: "br-historia-da-america-02",
    areaSlug: "historia",
    subcategoriaSlug: "historia-da-america",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado:
      "A Doutrina Monroe (1823), dos Estados Unidos, declarava que:",
    alternativas: alts(
      "As potências europeias não deveriam criar novas colônias nem intervir nas Américas",
      "Os Estados Unidos colonizariam a África",
      "A América Latina deveria formar um bloco único",
      "O canal do Panamá seria construído pela França",
      "A escravidão seria abolida em todo o continente",
      "O Brasil seria anexado aos Estados Unidos",
    ),
    letraCorreta: "A",
    explicacao:
      "O presidente James Monroe afirmou que o continente não seria mais objeto de colonização europeia, sintetizado na frase 'a América para os americanos'. Na prática, serviu de base para a influência norte-americana na região — e para o posterior corolário de Roosevelt, que reivindicava poder de polícia internacional.",
    referencia: "US National Archives — Monroe Doctrine (1823); Office of the Historian, US State Dept.",
  },
  {
    id: "br-historia-da-africa-01",
    areaSlug: "historia",
    subcategoriaSlug: "historia-da-africa",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado:
      "A Conferência de Berlim (1884-1885) é historicamente associada à:",
    alternativas: alts(
      "Partilha da África entre potências europeias, com regras para ocupação do território",
      "Independência das colônias africanas",
      "Criação da União Africana",
      "Abolição do tráfico atlântico",
      "Unificação do Egito com a Etiópia",
      "Fundação da Liga das Nações",
    ),
    letraCorreta: "A",
    explicacao:
      "Convocada por Bismarck, a conferência definiu critérios para o reconhecimento de ocupações europeias na África e acelerou a partilha do continente, sem nenhum representante africano à mesa. As fronteiras traçadas então ainda explicam muitos conflitos atuais. A União Africana é de 2002.",
    referencia: "Encyclopaedia Britannica — Berlin West Africa Conference; UNESCO — General History of Africa",
  },
  {
    id: "br-historia-da-africa-02",
    areaSlug: "historia",
    subcategoriaSlug: "historia-da-africa",
    dificuldade: "avancada",
    ordem: 4,
    enunciado:
      "Qual império africano, com centro em Timbuktu e Djenné, foi célebre na Idade Média por sua riqueza em ouro e por centros de estudo islâmicos como a mesquita de Sankoré?",
    alternativas: alts(
      "Império do Mali",
      "Império Romano",
      "Império Asteca",
      "Império Otomano",
      "Império Gupta",
      "Império do Japão",
    ),
    letraCorreta: "A",
    explicacao:
      "O Mali (séculos XIII-XVI) controlava rotas transaarianas de ouro e sal; Mansa Musa, em peregrinação a Meca em 1324, distribuiu tanto ouro que perturbou os preços no Cairo. Timbuktu tornou-se polo de saber com a Universidade de Sankoré. A UNESCO registra esses sítios como patrimônio mundial.",
    referencia: "UNESCO World Heritage — Timbuktu; Encyclopaedia Britannica — Mali empire",
  },
  {
    id: "br-historia-da-asia-01",
    areaSlug: "historia",
    subcategoriaSlug: "historia-da-asia",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado:
      "A dinastia Qin, no século III a.C., é lembrada na história da China sobretudo por:",
    alternativas: alts(
      "Unificar o território, padronizar pesos, medidas e escrita e iniciar a Grande Muralha em sua forma integrada",
      "Introduzir o budismo no país",
      "Abolir a escrita ideográfica",
      "Fundar Xangai como capital",
      "Encerrar o comércio com a Europa",
      "Criar a primeira marinha a vapor",
    ),
    letraCorreta: "A",
    explicacao:
      "Qin Shi Huang unificou os reinos em 221 a.C., padronizou moeda, pesos, medidas e caracteres, e conectou muralhas defensivas existentes na base do que se chamaria Grande Muralha. O budismo chega séculos depois, pela Rota da Seda, na dinastia Han.",
    referencia: "Encyclopaedia Britannica — Qin dynasty; UNESCO World Heritage — The Great Wall",
  },
  {
    id: "br-historia-da-asia-02",
    areaSlug: "historia",
    subcategoriaSlug: "historia-da-asia",
    dificuldade: "avancada",
    ordem: 4,
    enunciado:
      "A Primeira Guerra do Ópio (1839-1842) resultou, entre outras consequências, em:",
    alternativas: alts(
      "Cessão de Hong Kong à Grã-Bretanha pelo Tratado de Nanquim e abertura de portos chineses ao comércio",
      "Expulsão definitiva dos britânicos da Ásia",
      "Independência da Índia",
      "Fim do Império Chinês",
      "Unificação da Coreia",
      "Criação da Organização Mundial do Comércio",
    ),
    letraCorreta: "A",
    explicacao:
      "O Tratado de Nanquim (1842) encerrou a guerra com a cessão de Hong Kong e a abertura de cinco portos, além de indenização — início dos 'tratados desiguais'. O fim do império chinês vem só em 1912, com a queda da dinastia Qing.",
    referencia: "Encyclopaedia Britannica — Opium Wars; National Archives (UK) — Treaty of Nanking",
  },
  {
    id: "br-guerras-e-revolucoes-01",
    areaSlug: "historia",
    subcategoriaSlug: "guerras-e-revolucoes",
    dificuldade: "facil",
    ordem: 1,
    enunciado:
      "Em qual ano a Revolução Russa levou os bolcheviques ao poder, com a tomada do Palácio de Inverno?",
    alternativas: alts("1917", "1905", "1922", "1939", "1945", "1889"),
    letraCorreta: "A",
    explicacao:
      "Em outubro de 1917 (novembro no calendário gregoriano) os bolcheviques derrubaram o governo provisório e instalaram o poder soviético. 1905 foi um ensaio revolucionário que não tomou o poder; 1922 marca a criação da URSS.",
    referencia: "Encyclopaedia Britannica — Russian Revolution of 1917",
  },
  {
    id: "br-guerras-e-revolucoes-02",
    areaSlug: "historia",
    subcategoriaSlug: "guerras-e-revolucoes",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado:
      "O Tratado de Versalhes (1919), que encerrou formalmente a Primeira Guerra Mundial com a Alemanha, impôs:",
    alternativas: alts(
      "Indenizações pesadas, limites ao exército alemão e perda de territórios",
      "A divisão da Alemanha em dois países",
      "A criação do Pacto de Varsóvia",
      "A devolução de todas as colônias à Alemanha",
      "O fim do Império Britânico",
      "A unificação da Europa em um parlamento comum",
    ),
    letraCorreta: "A",
    explicacao:
      "O tratado impôs reparações, desmilitarização e perdas territoriais, e a cláusula de culpa pela guerra — o que alimentou o revanchismo alemão explorado depois pelo nazismo. A divisão da Alemanha ocorre em 1949, e o Pacto de Varsóvia é de 1955.",
    referencia: "US National Archives — Treaty of Versailles (1919); Encyclopaedia Britannica",
  },
  {
    id: "br-personalidades-historicas-01",
    areaSlug: "historia",
    subcategoriaSlug: "personalidades-historicas",
    dificuldade: "facil",
    ordem: 1,
    enunciado:
      "Quem foi o líder sul-africano que passou 27 anos preso e depois se tornou o primeiro presidente negro do país, em 1994?",
    alternativas: alts(
      "Nelson Mandela",
      "Desmond Tutu",
      "Kwame Nkrumah",
      "Patrice Lumumba",
      "Julius Nyerere",
      "Kofi Annan",
    ),
    letraCorreta: "A",
    explicacao:
      "Mandela lutou contra o apartheid na África do Sul, foi preso em 1962 e libertado em 1990; recebeu o Nobel da Paz em 1993 ao lado de Frederik de Klerk e governou de 1994 a 1999. Tutu foi arcebispo e Nobel da Paz de 1984; Nkrumah liderou Gana.",
    referencia: "Nobel Prize — Nelson Mandela, biografia oficial; ONU — Mandela Rules",
  },
  {
    id: "br-personalidades-historicas-02",
    areaSlug: "historia",
    subcategoriaSlug: "personalidades-historicas",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado:
      "Quem é reconhecida por descrever, ainda no século XIX, um algoritmo para ser executado por uma máquina analítica — trabalho que a tornou referência como pioneira da programação?",
    alternativas: alts(
      "Ada Lovelace",
      "Marie Curie",
      "Rosalind Franklin",
      "Grace Hopper",
      "Hedy Lamarr",
      "Emmy Noether",
    ),
    letraCorreta: "A",
    explicacao:
      "Nas notas sobre a máquina analítica de Charles Babbage (1843), Ada Lovelace descreveu um método passo a passo para calcular números de Bernoulli — considerado o primeiro programa publicado — e percebeu que a máquina poderia manipular símbolos, não só números. Hopper criou o primeiro compilador, já no século XX.",
    referencia: "Ada Lovelace — Notes on the Analytical Engine (1843); Oxford Dictionary of National Biography",
  },

  // ================= GEOGRAFIA =================
  {
    id: "br-geografia-humana-01",
    areaSlug: "geografia",
    subcategoriaSlug: "geografia-humana",
    dificuldade: "facil",
    ordem: 1,
    enunciado:
      "A densidade demográfica de uma região é calculada pela razão entre:",
    alternativas: alts(
      "População total e área territorial",
      "Número de cidades e número de habitantes",
      "População urbana e população rural",
      "Natalidade e mortalidade",
      "Renda total e número de famílias",
      "Área cultivada e área total",
    ),
    letraCorreta: "A",
    explicacao:
      "Densidade demográfica (ou populacional) é habitantes por quilômetro quadrado. É diferente de taxa de urbanização (população urbana sobre o total) e de crescimento vegetativo (natalidade menos mortalidade).",
    referencia: "IBGE — Conceitos e definições de indicadores demográficos",
  },
  {
    id: "br-geografia-humana-02",
    areaSlug: "geografia",
    subcategoriaSlug: "geografia-humana",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado: "O processo de 'conurbação' ocorre quando:",
    alternativas: alts(
      "Duas ou mais cidades crescem e passam a formar um tecido urbano contínuo",
      "Uma cidade perde população para o campo",
      "Um bairro é oficialmente anexado a outro",
      "Uma metrópole cria um novo distrito industrial",
      "A população de uma cidade dobra em dez anos",
      "Uma capital é transferida para o interior",
    ),
    letraCorreta: "A",
    explicacao:
      "Conurbação é a união física do tecido urbano de municípios vizinhos, típica das regiões metropolitanas: a mancha urbana ultrapassa os limites administrativos. É diferente de metropolização, que trata da concentração de poder econômico e político na metrópole.",
    referencia: "IBGE — Regiões de Influência das Cidades; Observatório das Metrópoles",
  },
  {
    id: "br-oceanografia-01",
    areaSlug: "geografia",
    subcategoriaSlug: "oceanografia",
    dificuldade: "facil",
    ordem: 1,
    enunciado: "Qual é o maior e mais profundo oceano do planeta?",
    alternativas: alts("Pacífico", "Atlântico", "Índico", "Ártico", "Antártico", "Mar Cáspio"),
    letraCorreta: "A",
    explicacao:
      "O Pacífico cobre cerca de um terço da superfície terrestre e abriga a Fossa das Marianas, com quase 11 mil metros de profundidade. O Atlântico é o segundo em área; o Ártico é o menor e mais raso.",
    referencia: "NOAA — Ocean facts; IHO — Limits of Oceans and Seas",
  },
  {
    id: "br-oceanografia-02",
    areaSlug: "geografia",
    subcategoriaSlug: "oceanografia",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado:
      "O fenômeno El Niño, que altera chuvas e temperaturas em várias regiões do mundo, corresponde a:",
    alternativas: alts(
      "Aquecimento anômalo das águas superficiais do Pacífico equatorial",
      "Resfriamento das águas do Atlântico Norte",
      "Aumento da salinidade do Índico",
      "Derretimento sazonal do Ártico",
      "Elevação do nível médio dos oceanos por marés",
      "Mudança na rotação da Terra",
    ),
    letraCorreta: "A",
    explicacao:
      "El Niño é a fase quente do ENOS: as águas superficiais do Pacífico equatorial ficam mais quentes que o normal, alterando a circulação atmosférica e provocando secas e chuvas extremas em pontos distantes. A fase fria se chama La Niña; o ENOS não é o mesmo que o degelo do Ártico.",
    referencia: "NOAA Climate.gov — El Niño & La Niña (ENSO) explainer",
  },
  {
    id: "br-geografia-economica-01",
    areaSlug: "geografia",
    subcategoriaSlug: "geografia-economica",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado: "O Mercosul é um exemplo de:",
    alternativas: alts(
      "Bloco econômico com tarifa externa comum entre países da América do Sul",
      "Aliança militar entre países americanos",
      "Organização de defesa do Atlântico Sul",
      "Tratado de livre comércio apenas entre Brasil e Estados Unidos",
      "Agência da ONU para o meio ambiente",
      "União aduaneira entre países africanos",
    ),
    letraCorreta: "A",
    explicacao:
      "O Mercado Comum do Sul (1991, Tratado de Assunção) reúne Brasil, Argentina, Uruguai e Paraguai — com Venezuela suspensa — e busca livre circulação de bens e uma tarifa externa comum. A defesa militar é papel de outras organizações, como a OTAN, que não inclui esses países.",
    referencia: "Mercosul — site oficial, Tratado de Assunção (1991)",
  },
  {
    id: "br-geografia-economica-02",
    areaSlug: "geografia",
    subcategoriaSlug: "geografia-economica",
    dificuldade: "avancada",
    ordem: 4,
    enunciado:
      "Na geografia econômica, diz-se que um país sofre de 'doença holandesa' quando:",
    alternativas: alts(
      "A exportação de um recurso natural valorizado aprecia a moeda e prejudica os demais setores industriais",
      "O país importa mais do que exporta em todos os setores",
      "A indústria cresce mais rápido que a agricultura",
      "O desemprego aumenta por causa da automação",
      "O turismo substitui a indústria nacional",
      "A dívida externa é paga antes do prazo",
    ),
    letraCorreta: "A",
    explicacao:
      "O nome vem do gás natural descoberto na Holanda nos anos 1960: a entrada de divisas valoriza a moeda local, encarece as exportações de outros setores e desindustrializa a economia. É o risco de economias muito dependentes de commodities, como o petróleo.",
    referencia: "The Economist — The Dutch disease (1977); Banco Mundial, relatórios sobre recursos naturais",
  },

  // ================= ARTES E CULTURA =================
  {
    id: "br-teatro-01",
    areaSlug: "artes",
    subcategoriaSlug: "teatro",
    dificuldade: "facil",
    ordem: 1,
    enunciado:
      "Qual dramaturgo inglês escreveu 'Romeu e Julieta' e 'Hamlet', encenadas no teatro Globe?",
    alternativas: alts(
      "William Shakespeare",
      "Molière",
      "Bertolt Brecht",
      "Henrik Ibsen",
      "Anton Tchekhov",
      "Sófocles",
    ),
    letraCorreta: "A",
    explicacao:
      "Shakespeare (1564-1616) foi ator e autor ligado ao Globe, em Londres, e escreveu tragédias, comédias e sonetos que se tornaram referência do teatro ocidental. Molière é francês, Ibsen norueguês e Tchekhov russo.",
    referencia: "Encyclopaedia Britannica — William Shakespeare; Shakespeare Birthplace Trust",
  },
  {
    id: "br-teatro-02",
    areaSlug: "artes",
    subcategoriaSlug: "teatro",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado:
      "O 'Teatro do Oprimido', método em que o público é convidado a intervir e substituir os atores na cena, foi criado pelo brasileiro:",
    alternativas: alts(
      "Augusto Boal",
      "Nelson Rodrigues",
      "Ariano Suassuna",
      "Gianfrancesco Guarnieri",
      "Dias Gomes",
      "Chico Buarque",
    ),
    letraCorreta: "A",
    explicacao:
      "Boal desenvolveu a proposta nos anos 1960-70, com o 'Teatro-Fórum' em que o espectador se torna 'espect-ator' e ensaia mudanças de desfecho para situações de opressão. Foi indicado ao Nobel da Paz em 2008 e seu método é usado hoje em mais de 70 países.",
    referencia: "Augusto Boal — Teatro do Oprimido e outras poéticas políticas (1975); UNESCO",
  },
  {
    id: "br-artes-visuais-01",
    areaSlug: "artes",
    subcategoriaSlug: "artes-visuais",
    dificuldade: "facil",
    ordem: 1,
    enunciado: "Quem pintou a 'Mona Lisa', hoje exposta no Museu do Louvre, em Paris?",
    alternativas: alts(
      "Leonardo da Vinci",
      "Michelangelo",
      "Rafael",
      "Vincent van Gogh",
      "Claude Monet",
      "Pablo Picasso",
    ),
    letraCorreta: "A",
    explicacao:
      "Leonardo pintou a obra no início do século XVI; a técnica do sfumato, com transições suaves de luz e sombra, é uma de suas marcas. Michelangelo esculpiu o Davi e pintou o teto da Capela Sistina; Van Gogh e Monet são séculos posteriores.",
    referencia: "Musée du Louvre — coleção, Mona Lisa; Encyclopaedia Britannica",
  },
  {
    id: "br-artes-visuais-02",
    areaSlug: "artes",
    subcategoriaSlug: "artes-visuais",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado:
      "Qual movimento artístico do século XIX ficou marcado por pintar ao ar livre e captar variações de luz, tendo em Monet um de seus principais nomes?",
    alternativas: alts(
      "Impressionismo",
      "Cubismo",
      "Surrealismo",
      "Barroco",
      "Expressionismo abstrato",
      "Arte gótica",
    ),
    letraCorreta: "A",
    explicacao:
      "O nome nasceu de uma crítica irônica à tela 'Impressão, nascer do sol', de Monet (1874). Os artistas saíam do ateliê, usavam pinceladas visíveis e tubos de tinta portáteis para registrar a luz em mudança. Cubismo e surrealismo são do século XX; o barroco, do XVII.",
    referencia: "Musée d'Orsay — Impressionism; Encyclopaedia Britannica",
  },
  {
    id: "br-arquitetura-01",
    areaSlug: "artes",
    subcategoriaSlug: "arquitetura",
    dificuldade: "facil",
    ordem: 1,
    enunciado:
      "Qual arquiteto brasileiro, autor de obras como o Congresso Nacional e a Catedral de Brasília, é referência mundial pelas curvas de concreto armado?",
    alternativas: alts(
      "Oscar Niemeyer",
      "Lúcio Costa",
      "Paulo Mendes da Rocha",
      "Le Corbusier",
      "Antoni Gaudí",
      "Frank Lloyd Wright",
    ),
    letraCorreta: "A",
    explicacao:
      "Niemeyer projetou os principais edifícios de Brasília (1960), com Lúcio Costa responsável pelo plano urbanístico, e teve obra reconhecida com o Pritzker em 1988. Le Corbusier foi seu mestre e colaborador no Ministério da Educação, no Rio.",
    referencia: "Pritzker Architecture Prize — Oscar Niemeyer (1988); UNESCO — Brasília, patrimônio mundial",
  },
  {
    id: "br-arquitetura-02",
    areaSlug: "artes",
    subcategoriaSlug: "arquitetura",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado:
      "Qual elemento estrutural é característico da arquitetura gótica, permitindo paredes mais altas e janelas maiores?",
    alternativas: alts(
      "Arco ogival combinado com arcobotantes",
      "Coluna dórica sem base",
      "Cúpula de concreto armado",
      "Arco de volta perfeita e alvenaria maciça",
      "Estrutura metálica aparente",
      "Parede de vidro e aço",
    ),
    letraCorreta: "A",
    explicacao:
      "O arco ogival direciona melhor as cargas e os arcobotantes transferem o empuxo para fora, liberando a parede para os vitrais — daí a verticalidade e a luz das catedrais góticas como Chartres e Notre-Dame. O arco de volta perfeita e a alvenaria maciça caracterizam o românico.",
    referencia: "Encyclopaedia Britannica — Gothic architecture; UNESCO — Chartres Cathedral",
  },
  {
    id: "br-historia-da-arte-01",
    areaSlug: "artes",
    subcategoriaSlug: "historia-da-arte",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado:
      "Qual inovação técnica é considerada marca do Renascimento na pintura ocidental?",
    alternativas: alts(
      "A perspectiva linear, com ponto de fuga que organiza a profundidade",
      "O uso exclusivo de têmpera sobre madeira",
      "A pintura sem qualquer figuração humana",
      "O abandono da representação do corpo",
      "O uso de colagem e fotomontagem",
      "A recusa de temas religiosos",
    ),
    letraCorreta: "A",
    explicacao:
      "A perspectiva linear foi sistematizada por Brunelleschi e teorizada por Alberti, criando a ilusão de espaço tridimensional num plano. Colagem e fotomontagem só surgem no século XX, com as vanguardas.",
    referencia: "Encyclopaedia Britannica — Renaissance art; The Met — Heilbrunn Timeline of Art History",
  },
  {
    id: "br-historia-da-arte-02",
    areaSlug: "artes",
    subcategoriaSlug: "historia-da-arte",
    dificuldade: "avancada",
    ordem: 4,
    enunciado:
      "Ao expor um urinol industrial assinado como 'A Fonte' (1917), Marcel Duchamp propôs o conceito de:",
    alternativas: alts(
      "Ready-made: um objeto comum deslocado para o espaço da arte, desafiando a ideia de obra original",
      "Pintura abstrata geométrica",
      "Escultura em mármore de precisão",
      "Arte sacra barroca",
      "Fotografia documental",
      "Arte digital interativa",
    ),
    letraCorreta: "A",
    explicacao:
      "Duchamp escolheu um objeto manufaturado e o apresentou como arte, deslocando a pergunta de 'como foi feito' para 'o que faz algo ser arte'. A peça original se perdeu, mas as réplicas estão em museus como o Tate e o Centre Pompidou — e a provocação segue central na arte contemporânea.",
    referencia: "Tate — Marcel Duchamp, Fountain (1917); The Met — Heilbrunn Timeline",
  },

  // ================= OUTRAS ÁREAS =================
  {
    id: "br-administracao-01",
    areaSlug: "outras",
    subcategoriaSlug: "administracao",
    dificuldade: "facil",
    ordem: 1,
    enunciado:
      "A administração científica, baseada na divisão de tarefas e no estudo dos tempos e movimentos, foi proposta por:",
    alternativas: alts(
      "Frederick Taylor",
      "Henri Fayol",
      "Max Weber",
      "Peter Drucker",
      "Elton Mayo",
      "Abraham Maslow",
    ),
    letraCorreta: "A",
    explicacao:
      "Taylor publicou 'Princípios da Administração Científica' em 1911, buscando eficiência pela padronização e pela separação entre planejamento e execução. Fayol descreveu funções do administrador (planejar, organizar, dirigir, coordenar, controlar) e Mayo conduziu os experimentos de Hawthorne, que fundaram a escola de relações humanas.",
    referencia: "Taylor — The Principles of Scientific Management (1911); Encyclopaedia Britannica",
  },
  {
    id: "br-administracao-02",
    areaSlug: "outras",
    subcategoriaSlug: "administracao",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado: "Na análise SWOT, as 'ameaças' correspondem a:",
    alternativas: alts(
      "Fatores externos que podem prejudicar a organização",
      "Fatores internos que a organização controla e podem ser melhorados",
      "Vantagens competitivas já consolidadas",
      "Objetivos de longo prazo da empresa",
      "Indicadores financeiros do período",
      "Competências dos funcionários",
    ),
    letraCorreta: "A",
    explicacao:
      "A matriz separa o ambiente interno (forças e fraquezas) do externo (oportunidades e ameaças). Ameaças vêm de fora e não são controláveis — concorrência, câmbio, regulação —, enquanto fraquezas são internas e corrigíveis.",
    referencia: "Harvard Business Review — SWOT analysis; Kotler & Keller, Administração de Marketing",
  },
  {
    id: "br-contabilidade-01",
    areaSlug: "outras",
    subcategoriaSlug: "contabilidade",
    dificuldade: "facil",
    ordem: 1,
    enunciado: "Na contabilidade, qual é a equação fundamental do balanço patrimonial?",
    alternativas: alts(
      "Ativo = Passivo + Patrimônio Líquido",
      "Ativo = Passivo − Patrimônio Líquido",
      "Ativo + Passivo = Patrimônio Líquido",
      "Receita = Despesa + Lucro",
      "Ativo = Receita − Despesa",
      "Passivo = Ativo + Patrimônio Líquido",
    ),
    letraCorreta: "A",
    explicacao:
      "O total de bens e direitos (ativo) é financiado por capital de terceiros (passivo exigível) e por capital próprio (patrimônio líquido). Por isso o balanço sempre 'fecha': Ativo = Passivo + PL. A outra relação citada é a apuração do resultado, não a equação patrimonial.",
    referencia: "Comitê de Pronunciamentos Contábeis — CPC 00 (R2), Estrutura Conceitual",
  },
  {
    id: "br-contabilidade-02",
    areaSlug: "outras",
    subcategoriaSlug: "contabilidade",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado: "O 'regime de competência' na contabilidade determina que as receitas e despesas:",
    alternativas: alts(
      "Sejam reconhecidas no período em que ocorrem, independentemente de terem sido pagas ou recebidas",
      "Sejam registradas apenas quando o dinheiro entra ou sai do caixa",
      "Sejam sempre lançadas no encerramento do exercício",
      "Dependam exclusivamente da decisão da administração",
      "Sigam o calendário fiscal do governo",
      "Sejam reconhecidas apenas quando há lucro",
    ),
    letraCorreta: "A",
    explicacao:
      "Pelo regime de competência, o fato gerador manda: vendeu em dezembro com recebimento em janeiro, a receita é de dezembro. O oposto é o regime de caixa, em que o registro segue a movimentação financeira — usado em controles gerenciais, mas não nas demonstrações contábeis.",
    referencia: "CPC 00 (R2) — Regime de competência; Lei 6.404/1976, art. 177",
  },
  {
    id: "br-astronautica-01",
    areaSlug: "outras",
    subcategoriaSlug: "astronautica",
    dificuldade: "facil",
    ordem: 1,
    enunciado: "Quem foi o primeiro ser humano a viajar ao espaço, em 1961?",
    alternativas: alts(
      "Yuri Gagarin",
      "Neil Armstrong",
      "Alan Shepard",
      "John Glenn",
      "Valentina Tereshkova",
      "Buzz Aldrin",
    ),
    letraCorreta: "A",
    explicacao:
      "O soviético Yuri Gagarin orbitou a Terra a bordo da Vostok 1 em 12 de abril de 1961, em um voo de cerca de 108 minutos. Armstrong pisou na Lua em 1969; Tereshkova foi a primeira mulher no espaço, em 1963.",
    referencia: "NASA — Yuri Gagarin, first human in space; ONU — Dia Internacional do Voo Espacial Humano",
  },
  {
    id: "br-astronautica-02",
    areaSlug: "outras",
    subcategoriaSlug: "astronautica",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado: "Por que um foguete precisa ser lançado na direção leste, próximo ao equador?",
    alternativas: alts(
      "Para aproveitar a velocidade de rotação da Terra, que é maior no equador",
      "Para escapar da gravidade lunar",
      "Para evitar a atmosfera por completo",
      "Porque o combustível só funciona em baixa latitude",
      "Para não colidir com satélites polares",
      "Porque o polo magnético atrai o foguete",
    ),
    letraCorreta: "A",
    explicacao:
      "A Terra gira para leste, e a velocidade tangencial é máxima no equador (cerca de 1.670 km/h). Lançar nessa direção e o mais perto possível da linha do equador soma essa velocidade à do foguete, economizando combustível — por isso existem bases como a de Kourou, na Guiana Francesa.",
    referencia: "NASA — Basics of space flight, launch sites and Earth's rotation; ESA — Kourou",
  },
  {
    id: "br-religioes-01",
    areaSlug: "outras",
    subcategoriaSlug: "religioes",
    dificuldade: "intermediaria",
    ordem: 2,
    enunciado:
      "Os Vedas, conjunto de textos mais antigos do hinduísmo, foram compostos originalmente em qual língua?",
    alternativas: alts("Sânscrito", "Árabe", "Latim", "Hebraico", "Grego antigo", "Pali"),
    letraCorreta: "A",
    explicacao:
      "Os Vedas foram transmitidos oralmente em sânscrito védico antes de serem escritos, com destaque para o Rigveda. Pali é a língua de textos budistas Theravada; o hebraico e o grego antigo pertencem a outras tradições.",
    referencia: "UNESCO — Vedic chanting, patrimônio oral da humanidade; Encyclopaedia Britannica",
  },
  {
    id: "br-religioes-02",
    areaSlug: "outras",
    subcategoriaSlug: "religioes",
    dificuldade: "avancada",
    ordem: 4,
    enunciado:
      "O Concílio de Niceia, convocado em 325, teve como resultado mais conhecido:",
    alternativas: alts(
      "A formulação do Credo Niceno, afirmando a consubstancialidade do Filho com o Pai",
      "A separação entre Igreja Católica e Ortodoxa",
      "A criação da Inquisição",
      "A tradução da Bíblia para o latim",
      "A convocação da Primeira Cruzada",
      "O fim do celibato clerical",
    ),
    letraCorreta: "A",
    explicacao:
      "Convocado pelo imperador Constantino, o concílio enfrentou a controvérsia ariana e produziu o Credo Niceno, base das profissões de fé cristãs. O cisma entre Roma e Constantinopla ocorre em 1054, a Vulgata de Jerônimo é do fim do século IV e as cruzadas começam em 1096.",
    referencia: "Encyclopaedia Britannica — First Council of Nicaea (325); Creeds of Christendom",
  },
];
