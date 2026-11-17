/**
 * Categorias de conhecimento do GUERRA DE BRIO (duelo intelectual 1×1).
 *
 * Estrutura de 3 níveis: área → subcategoria → pergunta. O banco
 * (`brio_questions`) referencia `brio_categorias.slug` da subcategoria; a
 * área é derivada pela chave `area_slug`. Manter esta lista como FONTE das
 * modalidades de seleção (categoria / subcategoria / geral / multidisciplinar
 * / aleatório) — a UI nunca monta categorias por conta própria.
 */

export interface Subcategoria {
  slug: string;
  nome: string;
}

export interface AreaConhecimento {
  slug: string;
  nome: string;
  /** Emoji usado nos cards de seleção. */
  icone: string;
  subcategorias: Subcategoria[];
}

export const AREAS: AreaConhecimento[] = [
  {
    slug: "ciencias",
    nome: "Ciências",
    icone: "🧪",
    subcategorias: [
      { slug: "fisica", nome: "Física" },
      { slug: "quimica", nome: "Química" },
      { slug: "biologia", nome: "Biologia" },
      { slug: "astronomia", nome: "Astronomia" },
      { slug: "geologia", nome: "Geologia" },
      { slug: "ecologia", nome: "Ecologia" },
      { slug: "neurociencia", nome: "Neurociência" },
      { slug: "genetica", nome: "Genética" },
      { slug: "biotecnologia", nome: "Biotecnologia" },
      { slug: "ciencias-ambientais", nome: "Ciências ambientais" },
    ],
  },
  {
    slug: "exatas",
    nome: "Matemática e Ciências Exatas",
    icone: "📐",
    subcategorias: [
      { slug: "matematica-basica", nome: "Matemática básica" },
      { slug: "algebra", nome: "Álgebra" },
      { slug: "geometria", nome: "Geometria" },
      { slug: "trigonometria", nome: "Trigonometria" },
      { slug: "calculo", nome: "Cálculo" },
      { slug: "estatistica", nome: "Estatística" },
      { slug: "probabilidade", nome: "Probabilidade" },
      { slug: "logica-matematica", nome: "Lógica matemática" },
      { slug: "matematica-financeira", nome: "Matemática financeira" },
    ],
  },
  {
    slug: "tecnologia",
    nome: "Tecnologia e Computação",
    icone: "💻",
    subcategorias: [
      { slug: "ciencia-da-computacao", nome: "Ciência da computação" },
      { slug: "programacao", nome: "Programação" },
      { slug: "inteligencia-artificial", nome: "Inteligência artificial" },
      { slug: "engenharia-de-software", nome: "Engenharia de software" },
      { slug: "redes", nome: "Redes de computadores" },
      { slug: "seguranca-da-informacao", nome: "Segurança da informação" },
      { slug: "banco-de-dados", nome: "Banco de dados" },
      { slug: "algoritmos", nome: "Algoritmos" },
      { slug: "eletronica", nome: "Eletrônica" },
      { slug: "robotica", nome: "Robótica" },
    ],
  },
  {
    slug: "filosofia",
    nome: "Filosofia e Pensamento",
    icone: "🏛️",
    subcategorias: [
      { slug: "filosofia-antiga", nome: "Filosofia antiga" },
      { slug: "filosofia-moderna", nome: "Filosofia moderna" },
      { slug: "filosofia-contemporanea", nome: "Filosofia contemporânea" },
      { slug: "etica", nome: "Ética" },
      { slug: "metafisica", nome: "Metafísica" },
      { slug: "epistemologia", nome: "Epistemologia" },
      { slug: "logica", nome: "Lógica" },
      { slug: "filosofia-politica", nome: "Filosofia política" },
      { slug: "filosofia-da-ciencia", nome: "Filosofia da ciência" },
    ],
  },
  {
    slug: "humanas",
    nome: "Ciências Humanas e Sociais",
    icone: "🌍",
    subcategorias: [
      { slug: "sociologia", nome: "Sociologia" },
      { slug: "antropologia", nome: "Antropologia" },
      { slug: "ciencia-politica", nome: "Ciência política" },
      { slug: "economia", nome: "Economia" },
      { slug: "historia-das-civilizacoes", nome: "História das civilizações" },
      { slug: "geopolitica", nome: "Geopolítica" },
      { slug: "relacoes-internacionais", nome: "Relações internacionais" },
      { slug: "direito", nome: "Direito" },
      { slug: "arqueologia", nome: "Arqueologia" },
      { slug: "demografia", nome: "Demografia" },
    ],
  },
  {
    slug: "psicologia",
    nome: "Psicologia e Comportamento",
    icone: "🧠",
    subcategorias: [
      { slug: "psicologia-cognitiva", nome: "Psicologia cognitiva" },
      { slug: "psicologia-social", nome: "Psicologia social" },
      { slug: "psicologia-comportamental", nome: "Psicologia comportamental" },
      { slug: "neuropsicologia", nome: "Neuropsicologia" },
      { slug: "desenvolvimento-humano", nome: "Desenvolvimento humano" },
      { slug: "psicanalise", nome: "Psicanálise" },
      { slug: "teorias-da-personalidade", nome: "Teorias da personalidade" },
      { slug: "comportamento-coletivo", nome: "Comportamento coletivo" },
    ],
  },
  {
    slug: "historia",
    nome: "História",
    icone: "📜",
    subcategorias: [
      { slug: "historia-antiga", nome: "História antiga" },
      { slug: "historia-medieval", nome: "História medieval" },
      { slug: "historia-moderna", nome: "História moderna" },
      { slug: "historia-contemporanea", nome: "História contemporânea" },
      { slug: "historia-do-brasil", nome: "História do Brasil" },
      { slug: "historia-da-america", nome: "História da América" },
      { slug: "historia-da-africa", nome: "História da África" },
      { slug: "historia-da-asia", nome: "História da Ásia" },
      { slug: "guerras-e-revolucoes", nome: "Guerras e revoluções" },
      { slug: "personalidades-historicas", nome: "Grandes personalidades históricas" },
    ],
  },
  {
    slug: "geografia",
    nome: "Geografia",
    icone: "🗺️",
    subcategorias: [
      { slug: "geografia-fisica", nome: "Geografia física" },
      { slug: "geografia-humana", nome: "Geografia humana" },
      { slug: "cartografia", nome: "Cartografia" },
      { slug: "climatologia", nome: "Climatologia" },
      { slug: "paises-e-capitais", nome: "Países e capitais" },
      { slug: "oceanografia", nome: "Oceanografia" },
      { slug: "geografia-economica", nome: "Geografia econômica" },
    ],
  },
  {
    slug: "artes",
    nome: "Artes e Cultura",
    icone: "🎭",
    subcategorias: [
      { slug: "literatura", nome: "Literatura" },
      { slug: "musica", nome: "Música" },
      { slug: "cinema", nome: "Cinema" },
      { slug: "teatro", nome: "Teatro" },
      { slug: "artes-visuais", nome: "Artes visuais" },
      { slug: "arquitetura", nome: "Arquitetura" },
      { slug: "mitologia", nome: "Mitologia" },
      { slug: "historia-da-arte", nome: "História da arte" },
    ],
  },
  {
    slug: "outras",
    nome: "Outras Áreas",
    icone: "🎯",
    subcategorias: [
      { slug: "medicina-e-saude", nome: "Medicina e saúde" },
      { slug: "engenharia", nome: "Engenharia" },
      { slug: "administracao", nome: "Administração" },
      { slug: "contabilidade", nome: "Contabilidade" },
      { slug: "astronautica", nome: "Astronáutica" },
      { slug: "agricultura", nome: "Agricultura" },
      { slug: "linguistica", nome: "Linguística" },
      { slug: "religioes", nome: "Religiões e mitologias" },
      { slug: "esportes", nome: "Esportes" },
      { slug: "conhecimentos-gerais", nome: "Conhecimentos gerais" },
    ],
  },
];

/** Modalidades de seleção (§3.3 do documento). */
export type Modalidade = "categoria" | "subcategoria" | "geral" | "multidisciplinar" | "aleatorio";

export const MODALIDADES: Array<{
  id: Modalidade;
  nome: string;
  descricao: string;
  icone: string;
}> = [
  {
    id: "categoria",
    nome: "Categoria específica",
    descricao: "Uma grande área do conhecimento",
    icone: "🎓",
  },
  {
    id: "subcategoria",
    nome: "Subcategoria específica",
    descricao: "Um assunto preciso, do nível técnico ao avançado",
    icone: "🔬",
  },
  {
    id: "geral",
    nome: "Conhecimento geral",
    descricao: "Cultura ampla, sem especialização",
    icone: "🌐",
  },
  {
    id: "multidisciplinar",
    nome: "Multidisciplinar",
    descricao: "Todas as áreas, equilibradas",
    icone: "🧩",
  },
  {
    id: "aleatorio",
    nome: "Desafio aleatório",
    descricao: "Sorteio puro — inclusive do nível mais alto",
    icone: "🎲",
  },
];

/** Níveis de dificuldade estimada (§3.4). */
export type Dificuldade = "facil" | "intermediaria" | "dificil" | "avancada" | "especialista";

export const DIFICULDADES: Array<{ id: Dificuldade; nome: string; ordem: number }> = [
  { id: "facil", nome: "Fácil", ordem: 1 },
  { id: "intermediaria", nome: "Intermediária", ordem: 2 },
  { id: "dificil", nome: "Difícil", ordem: 3 },
  { id: "avancada", nome: "Avançada", ordem: 4 },
  { id: "especialista", nome: "Especialista", ordem: 5 },
];

const POR_SLUG = new Map<string, AreaConhecimento>(AREAS.map((a) => [a.slug, a]));

type SubcategoriaComArea = Subcategoria & { areaSlug: string };

const SUB_POR_SLUG = new Map<string, SubcategoriaComArea>(
  AREAS.flatMap((a) =>
    a.subcategorias.map((s): [string, SubcategoriaComArea] => [
      s.slug,
      { slug: s.slug, nome: s.nome, areaSlug: a.slug },
    ]),
  ),
);

export function areaPorSlug(slug: string): AreaConhecimento | null {
  return POR_SLUG.get(slug) ?? null;
}

export function subcategoriaPorSlug(slug: string): SubcategoriaComArea {
  return SUB_POR_SLUG.get(slug) ?? { slug, nome: slug, areaSlug: "outras" };
}

export function nomeDaArea(slug: string): string {
  return POR_SLUG.get(slug)?.nome ?? "Conhecimento geral";
}

export function nomeDaSubcategoria(slug: string): string {
  return SUB_POR_SLUG.get(slug)?.nome ?? slug;
}

/** Ordem numérica da dificuldade (1..5) — usada pela TRI e pelo banco. */
export function ordemDificuldade(d: Dificuldade): number {
  return DIFICULDADES.find((x) => x.id === d)?.ordem ?? 3;
}

/** Total de subcategorias — usado nos cards e nos testes. */
export function totalSubcategorias(): number {
  return AREAS.reduce((acc, a) => acc + a.subcategorias.length, 0);
}
