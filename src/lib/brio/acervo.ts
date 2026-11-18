/**
 * Acervo curado do GUERRA DE BRIO.
 *
 * Cada pergunta tem SEIS alternativas (A–F), gabarito, explicação, categoria,
 * subcategoria, dificuldade estimada e uma referência verificável (§3.5).
 *
 * Este arquivo é a FONTE do seed (`testes/gerador-brio-seed.mts` gera o SQL a
 * partir dele) e o fallback local quando a migration ainda não foi aplicada.
 * Para escalar para milhões de perguntas, o caminho é `brio_importar_lote`
 * (ver supabase/migrations/guerra_de_brio.sql) alimentado por geração em
 * lotes com validação — este acervo é o NÚCLEO CURADO e auditável.
 *
 * Regra editorial: nada de pergunta ambígua, com duas respostas defensáveis
 * ou com fato não verificável. `referencia` aponta a fonte da validação.
 */
import type { Letra } from "./types";
import { LETRAS } from "./types";
import { embaralhar, rngDe, type PerguntaBruta } from "./selecao";
import { ACERVO_EXPANSAO } from "./acervo-expansao";

/** Atalho: monta as 6 alternativas na ordem canônica A–F. */
function alts(a: string, b: string, c: string, d: string, e: string, f: string) {
  return [
    { letra: "A" as Letra, texto: a },
    { letra: "B" as Letra, texto: b },
    { letra: "C" as Letra, texto: c },
    { letra: "D" as Letra, texto: d },
    { letra: "E" as Letra, texto: e },
    { letra: "F" as Letra, texto: f },
  ];
}

type SemUsos = Omit<PerguntaBruta, "usos">;

/**
 * Reequilibra o gabarito.
 *
 * As perguntas são autoradas com o gabarito onde ele caiu naturalmente, o que
 * concentrava 70% das respostas na letra B — um jogador poderia "gabaritar"
 * clicando sempre B. Como as alternativas já são reembaralhadas a cada partida,
 * a ordem autoral é irrelevante: aqui aplicamos uma permutação determinística
 * (semeada pelo id) e recalculamos a letra correta, de modo que o gabarito fique
 * espalhado pelas seis letras. O processo é reprodutível: o mesmo id sempre
 * produz a mesma ordem, então o acervo e o seed do banco nunca divergem.
 */
function equilibrarGabarito(perguntas: PerguntaBruta[]): PerguntaBruta[] {
  return perguntas.map((p) => {
    const textoCorreto = p.alternativas.find((a) => a.letra === p.letraCorreta)?.texto;
    if (textoCorreto == null) return p;
    const ordem = embaralhar(p.alternativas, rngDe(`gabarito:${p.id}`));
    const alternativas = ordem.map((alt, idx) => ({
      letra: LETRAS[idx] ?? "A",
      texto: alt.texto,
    }));
    const letraCorreta = alternativas.find((a) => a.texto === textoCorreto)?.letra ?? p.letraCorreta;
    return { ...p, alternativas, letraCorreta };
  });
}

export const ACERVO_BRIO: PerguntaBruta[] = (
  [
    // ================= CIÊNCIAS =================
    {
      id: "br-astronomia-01",
      areaSlug: "ciencias",
      subcategoriaSlug: "astronomia",
      dificuldade: "facil",
      ordem: 1,
      enunciado:
        "Qual planeta do Sistema Solar tem o dia mais longo em relação ao seu próprio ano — ou seja, gira tão devagar que um dia dura mais que um ano?",
      alternativas: alts("Mercúrio", "Vênus", "Marte", "Júpiter", "Saturno", "Netuno"),
      letraCorreta: "B",
      explicacao:
        "Vênus gira em torno do próprio eixo em cerca de 243 dias terrestres, enquanto completa uma volta ao redor do Sol em cerca de 225 dias. O dia venusiano é, portanto, mais longo que o ano venusiano. Além disso, gira em sentido retrógrado.",
      referencia: "NASA Science — Venus Facts (science.nasa.gov/venus)",
    },
    {
      id: "br-astronomia-02",
      areaSlug: "ciencias",
      subcategoriaSlug: "astronomia",
      dificuldade: "intermediaria",
      ordem: 2,
      enunciado:
        "A luz do Sol leva aproximadamente quanto tempo para chegar à Terra?",
      alternativas: alts(
        "Cerca de 8 segundos",
        "Cerca de 8 minutos",
        "Cerca de 8 horas",
        "Cerca de 1,3 segundo",
        "Cerca de 24 horas",
        "Cerca de 3 minutos",
      ),
      letraCorreta: "B",
      explicacao:
        "A distância média Terra–Sol é de cerca de 149,6 milhões de km (1 unidade astronômica). Dividida pela velocidade da luz (≈300.000 km/s), resulta em aproximadamente 500 segundos, isto é, cerca de 8 minutos e 20 segundos.",
      referencia: "NASA — Sun Fact Sheet (nssdc.gsfc.nasa.gov)",
    },
    {
      id: "br-fisica-01",
      areaSlug: "ciencias",
      subcategoriaSlug: "fisica",
      dificuldade: "intermediaria",
      ordem: 2,
      enunciado:
        "No vácuo, uma pena e um martelo soltos da mesma altura caem simultaneamente. Qual princípio explica esse resultado?",
      alternativas: alts(
        "A pena tem massa desprezível e por isso flutua",
        "A gravidade atua igual sobre todos os corpos, independentemente da massa",
        "O martelo cria uma esteira de ar que empurra a pena",
        "A inércia da pena é maior que a do martelo",
        "A força gravitacional é maior sobre a pena",
        "O vácuo anula a massa dos corpos",
      ),
      letraCorreta: "B",
      explicacao:
        "A aceleração da gravidade é independente da massa do corpo: em queda livre, a = g. A diferença observada na atmosfera vem da resistência do ar, que depende da forma e da velocidade, não da massa. O experimento foi demonstrado na Lua pela Apollo 15 (1971).",
      referencia: "NASA — Apollo 15 feather and hammer drop (1971)",
    },
    {
      id: "br-fisica-02",
      areaSlug: "ciencias",
      subcategoriaSlug: "fisica",
      dificuldade: "avancada",
      ordem: 4,
      enunciado:
        "Qual grandeza física NÃO se conserva em um processo com atrito, sendo justamente convertida em energia térmica?",
      alternativas: alts(
        "Energia total",
        "Momento linear total",
        "Energia mecânica",
        "Carga elétrica",
        "Momento angular",
        "Massa-energia",
      ),
      letraCorreta: "C",
      explicacao:
        "A energia TOTAL sempre se conserva, mas a energia MECÂNICA (cinética + potencial) não: o atrito a dissipa como calor. O momento linear e a carga elétrica também se conservam no processo; a energia mecânica é a que 'some' como movimento organizado.",
      referencia: "Halliday, Resnick & Walker — Fundamentos de Física, vol. 1",
    },
    {
      id: "br-biologia-01",
      areaSlug: "ciencias",
      subcategoriaSlug: "biologia",
      dificuldade: "facil",
      ordem: 1,
      enunciado: "Qual organela é responsável pela respiração celular e pela produção de ATP?",
      alternativas: alts(
        "Ribossomo",
        "Mitocôndria",
        "Lisossomo",
        "Complexo de Golgi",
        "Retículo endoplasmático liso",
        "Peroxissomo",
      ),
      letraCorreta: "B",
      explicacao:
        "A mitocôndria realiza a respiração celular aeróbica, produzindo ATP por fosforilação oxidativa na cadeia transportadora de elétrons da membrana interna. Os ribossomos sintetizam proteínas; os lisossomos fazem digestão intracelular.",
      referencia: "Alberts et al. — Biologia Molecular da Célula",
    },
    {
      id: "br-genetica-01",
      areaSlug: "ciencias",
      subcategoriaSlug: "genetica",
      dificuldade: "intermediaria",
      ordem: 2,
      enunciado:
        "No cruzamento entre dois indivíduos heterozigotos (Aa × Aa), qual é a proporção fenotípica esperada, com dominância completa?",
      alternativas: alts(
        "1:1",
        "3:1",
        "1:2:1",
        "9:3:3:1",
        "2:1",
        "1:1:1:1",
      ),
      letraCorreta: "B",
      explicacao:
        "O quadro de Punnett dá genótipos 1 AA : 2 Aa : 1 aa. Com dominância completa, AA e Aa têm o mesmo fenótipo, resultando em 3 dominantes : 1 recessivo. A proporção 1:2:1 é a GENOTÍPICA; 9:3:3:1 é de dois genes independentes.",
      referencia: "Mendel (1866) — leis da segregação; Griffiths et al., Introdução à Genética",
    },
    {
      id: "br-neurociencia-01",
      areaSlug: "ciencias",
      subcategoriaSlug: "neurociencia",
      dificuldade: "avancada",
      ordem: 4,
      enunciado:
        "Qual estrutura cerebral é classicamente associada à consolidação de memórias declarativas de longo prazo?",
      alternativas: alts(
        "Cerebelo",
        "Hipocampo",
        "Amígdala",
        "Bulbo raquidiano",
        "Núcleo caudado",
        "Tálamo",
      ),
      letraCorreta: "B",
      explicacao:
        "O hipocampo e as estruturas do lobo temporal medial são essenciais para consolidar memórias declarativas (episódicas e semânticas). O caso clínico H.M., estudado por Brenda Milner, mostrou que sua remoção bilateral impedia formar novas memórias declarativas, preservando memórias procedurais.",
      referencia: "Scoville & Milner (1957), Journal of Neurology, Neurosurgery & Psychiatry",
    },
    {
      id: "br-quimica-01",
      areaSlug: "ciencias",
      subcategoriaSlug: "quimica",
      dificuldade: "intermediaria",
      ordem: 2,
      enunciado: "Qual é o pH de uma solução aquosa com concentração de H⁺ igual a 1 × 10⁻³ mol/L?",
      alternativas: alts("pH = 1", "pH = 3", "pH = 7", "pH = 11", "pH = 13", "pH = 0,3"),
      letraCorreta: "B",
      explicacao:
        "pH = −log₁₀[H⁺]. Com [H⁺] = 10⁻³, pH = 3. A solução é ácida. O valor 11 seria o pH do par básico conjugado (pOH = 11) e 0,3 confundiria a concentração com o logaritmo.",
      referencia: "Atkins & Jones — Princípios de Química",
    },
    {
      id: "br-ecologia-01",
      areaSlug: "ciencias",
      subcategoriaSlug: "ecologia",
      dificuldade: "dificil",
      ordem: 3,
      enunciado:
        "Em uma cadeia alimentar, a quantidade de energia disponível para o nível trófico seguinte é tipicamente:",
      alternativas: alts(
        "Igual à do nível anterior",
        "Cerca de 10% da do nível anterior",
        "Cerca de 90% da do nível anterior",
        "Metade da do nível anterior",
        "O dobro da do nível anterior",
        "Independente do nível trófico",
      ),
      letraCorreta: "B",
      explicacao:
        "A 'regra dos 10%' (Lindeman, 1942) estima que apenas cerca de 10% da energia de um nível trófico é transferida ao seguinte; o restante se perde em respiração, calor e matéria não assimilada. É por isso que as cadeias têm poucos níveis.",
      referencia: "Lindeman (1942), Ecology, 23(4) — trophic-dynamic aspect of ecology",
    },

    // ================= EXATAS =================
    {
      id: "br-geometria-01",
      areaSlug: "exatas",
      subcategoriaSlug: "geometria",
      dificuldade: "facil",
      ordem: 1,
      enunciado: "Quantas faces tem um dodecaedro regular?",
      alternativas: alts("6", "8", "12", "20", "10", "24"),
      letraCorreta: "C",
      explicacao:
        "O dodecaedro regular tem 12 faces pentagonais, 20 vértices e 30 arestas (satisfaz a relação de Euler V − A + F = 2: 20 − 30 + 12 = 2). É um dos cinco sólidos platônicos.",
      referencia: "Euclides — Elementos, Livro XIII",
    },
    {
      id: "br-probabilidade-01",
      areaSlug: "exatas",
      subcategoriaSlug: "probabilidade",
      dificuldade: "intermediaria",
      ordem: 2,
      enunciado:
        "Ao lançar dois dados honestos de 6 faces, qual é a probabilidade de a soma ser 7?",
      alternativas: alts("1/12", "1/6", "5/36", "7/36", "1/36", "1/3"),
      letraCorreta: "B",
      explicacao:
        "São 36 resultados equiprováveis. A soma 7 ocorre em 6 deles: (1,6), (2,5), (3,4), (4,3), (5,2), (6,1). Logo 6/36 = 1/6. A soma 7 é a mais provável por ter o maior número de combinações.",
      referencia: "Feller — An Introduction to Probability Theory and Its Applications",
    },
    {
      id: "br-logica-matematica-01",
      areaSlug: "exatas",
      subcategoriaSlug: "logica-matematica",
      dificuldade: "dificil",
      ordem: 3,
      enunciado:
        "Qual das proposições abaixo é a CONTRAPOSITIVA de «Se chove, então a rua fica molhada»?",
      alternativas: alts(
        "Se a rua fica molhada, então chove",
        "Se não chove, então a rua não fica molhada",
        "Se a rua não fica molhada, então não chove",
        "Chove e a rua não fica molhada",
        "Não chove ou a rua fica molhada",
        "A rua fica molhada apenas se chover",
      ),
      letraCorreta: "C",
      explicacao:
        "A contrapositiva de P → Q é ¬Q → ¬P, e é logicamente EQUIVALENTE ao condicional original. A recíproca (Q → P) e a inversa (¬P → ¬Q) NÃO são equivalentes. A opção «Não chove ou a rua fica molhada» descreve a equivalência material (¬P ∨ Q), que também é válida, mas não é a contrapositiva.",
      referencia: "Copi & Cohen — Introdução à Lógica",
    },
    {
      id: "br-calculo-01",
      areaSlug: "exatas",
      subcategoriaSlug: "calculo",
      dificuldade: "avancada",
      ordem: 4,
      enunciado: "Qual é a derivada de f(x) = ln(x) para x > 0?",
      alternativas: alts("x", "1/x", "e^x", "ln(x)/x", "x·ln(x) − x", "−1/x²"),
      letraCorreta: "B",
      explicacao:
        "d/dx ln(x) = 1/x para x > 0. É a função cuja taxa de variação relativa é constante. A primitiva de ln(x) é x·ln(x) − x + C (a opção x·ln(x) − x), e −1/x² é a derivada de 1/x.",
      referencia: "Stewart — Cálculo, vol. 1",
    },
    {
      id: "br-estatistica-01",
      areaSlug: "exatas",
      subcategoriaSlug: "estatistica",
      dificuldade: "dificil",
      ordem: 3,
      enunciado:
        "Em uma distribuição fortemente assimétrica à direita, qual relação entre média, mediana e moda é tipicamente observada?",
      alternativas: alts(
        "Média < Mediana < Moda",
        "Média > Mediana > Moda",
        "Média = Mediana = Moda",
        "Mediana > Média > Moda",
        "Moda > Mediana > Média",
        "Média = Moda, mediana maior",
      ),
      letraCorreta: "B",
      explicacao:
        "Na assimetria à direita (cauda longa nos valores altos), a média é 'puxada' pelos valores extremos e fica maior que a mediana, que por sua vez tende a ser maior que a moda. É o oposto da assimetria à esquerda.",
      referencia: "Moore, McCabe & Craig — Introdução à Prática da Estatística",
    },
    {
      id: "br-matematica-basica-01",
      areaSlug: "exatas",
      subcategoriaSlug: "matematica-basica",
      dificuldade: "facil",
      ordem: 1,
      enunciado: "Qual é o valor de 7! (sete fatorial)?",
      alternativas: alts("720", "5040", "40320", "840", "2520", "362880"),
      letraCorreta: "B",
      explicacao:
        "7! = 7 × 6 × 5 × 4 × 3 × 2 × 1 = 5040. O valor 720 é 6! e 40320 é 8!. O fatorial cresce muito rápido: 10! já passa de 3,6 milhões.",
      referencia: "Convenção matemática padrão para o fatorial",
    },

    // ================= TECNOLOGIA =================
    {
      id: "br-algoritmos-01",
      areaSlug: "tecnologia",
      subcategoriaSlug: "algoritmos",
      dificuldade: "intermediaria",
      ordem: 2,
      enunciado:
        "Qual é a complexidade de tempo MÉDIA da busca binária em um vetor ordenado de n elementos?",
      alternativas: alts("O(1)", "O(log n)", "O(n)", "O(n log n)", "O(n²)", "O(2ⁿ)"),
      letraCorreta: "B",
      explicacao:
        "A busca binária descarta metade do espaço a cada comparação, resultando em O(log n). Ela exige o vetor ORDENADO — em vetor desordenado a busca é O(n). Ordenar antes custa O(n log n), o que só compensa com muitas buscas.",
      referencia: "Cormen et al. — Algoritmos: Teoria e Prática",
    },
    {
      id: "br-banco-de-dados-01",
      areaSlug: "tecnologia",
      subcategoriaSlug: "banco-de-dados",
      dificuldade: "dificil",
      ordem: 3,
      enunciado:
        "Em bancos relacionais, qual propriedade ACID garante que uma transação seja aplicada por inteiro ou não seja aplicada de forma alguma?",
      alternativas: alts(
        "Atomicidade",
        "Consistência",
        "Isolamento",
        "Durabilidade",
        "Idempotência",
        "Normalização",
      ),
      letraCorreta: "A",
      explicacao:
        "A atomicidade ('tudo ou nada') garante que a transação não deixe efeitos parciais: se uma parte falha, tudo é desfeito. Consistência mantém as regras do banco, isolamento evita interferência entre transações concorrentes e durabilidade garante persistência após o commit.",
      referencia: "Silberschatz, Korth & Sudarshan — Sistema de Banco de Dados",
    },
    {
      id: "br-seguranca-01",
      areaSlug: "tecnologia",
      subcategoriaSlug: "seguranca-da-informacao",
      dificuldade: "avancada",
      ordem: 4,
      enunciado:
        "Por que senhas NÃO devem ser armazenadas com funções de hash genéricas rápidas como SHA-256, mas sim com algoritmos como bcrypt, scrypt ou Argon2?",
      alternativas: alts(
        "Porque SHA-256 produz hashes muito curtos",
        "Porque algoritmos de derivação de chave são deliberadamente lentos e ajustáveis, encarecendo ataques de força bruta",
        "Porque SHA-256 é reversível",
        "Porque bcrypt criptografa e permite recuperar a senha original",
        "Porque SHA-256 não aceita caracteres especiais",
        "Porque bcrypt dispensa o uso de salt",
      ),
      letraCorreta: "B",
      explicacao:
        "Funções como SHA-256 são otimizadas para velocidade, o que favorece quem tenta bilhões de palpites por segundo. bcrypt/scrypt/Argon2 são deliberadamente custosos (fator de trabalho, memória) e usam salt, tornando cada tentativa muito mais cara. Nenhuma delas é reversível: hash de senha nunca deve ser descriptografado.",
      referencia: "OWASP — Password Storage Cheat Sheet",
    },
    {
      id: "br-ia-01",
      areaSlug: "tecnologia",
      subcategoriaSlug: "inteligencia-artificial",
      dificuldade: "dificil",
      ordem: 3,
      enunciado:
        "Em aprendizado de máquina, o que caracteriza o 'sobreajuste' (overfitting)?",
      alternativas: alts(
        "O modelo erra tanto no treino quanto nos dados novos",
        "O modelo vai bem no treino mas mal em dados novos",
        "O modelo treina rápido demais",
        "O modelo usa poucos parâmetros",
        "O modelo ignora os dados de treino",
        "O modelo só funciona com dados tabulares",
      ),
      letraCorreta: "B",
      explicacao:
        "No sobreajuste o modelo memoriza ruídos e particularidades do treino, perdendo capacidade de generalizar — daí o desempenho ruim em dados não vistos. O caso oposto (erro alto nos dois) é o subajuste.",
      referencia: "Bishop — Pattern Recognition and Machine Learning",
    },
    {
      id: "br-redes-01",
      areaSlug: "tecnologia",
      subcategoriaSlug: "redes",
      dificuldade: "intermediaria",
      ordem: 2,
      enunciado:
        "Em qual camada do modelo OSI atuam protocolos como TCP e UDP?",
      alternativas: alts(
        "Camada física",
        "Camada de enlace",
        "Camada de rede",
        "Camada de transporte",
        "Camada de sessão",
        "Camada de aplicação",
      ),
      letraCorreta: "D",
      explicacao:
        "TCP e UDP são protocolos da camada de TRANSPORTE (camada 4), responsáveis por portas, segmentação e controle de fluxo/confiabilidade. IP pertence à camada de rede (3) e Ethernet à de enlace (2).",
      referencia: "Tanenbaum & Wetherall — Redes de Computadores",
    },
    {
      id: "br-programacao-01",
      areaSlug: "tecnologia",
      subcategoriaSlug: "programacao",
      dificuldade: "facil",
      ordem: 1,
      enunciado:
        "Em programação, o que é uma 'função pura'?",
      alternativas: alts(
        "Uma função sem parâmetros",
        "Uma função que não tem retorno",
        "Uma função cujo resultado depende apenas dos argumentos e que não produz efeitos colaterais",
        "Uma função que roda apenas uma vez",
        "Uma função que só usa números inteiros",
        "Uma função que nunca lança exceções",
      ),
      letraCorreta: "C",
      explicacao:
        "Função pura: mesmo argumento ⇒ mesmo resultado, e nenhum efeito colateral (não altera estado externo, não escreve em disco, não faz rede). É a base do código testável e do determinismo — exatamente o que usamos nos motores deste jogo.",
      referencia: "Abelson & Sussman — Structure and Interpretation of Computer Programs",
    },

    // ================= FILOSOFIA =================
    {
      id: "br-filosofia-antiga-01",
      areaSlug: "filosofia",
      subcategoriaSlug: "filosofia-antiga",
      dificuldade: "intermediaria",
      ordem: 2,
      enunciado:
        "Qual filósofo grego é conhecido pela formulação do 'problema da mudança' e pela imagem de que ninguém entra duas vezes no mesmo rio?",
      alternativas: alts("Parmênides", "Heráclito", "Zenão de Eleia", "Pitágoras", "Anaximandro", "Demócrito"),
      letraCorreta: "B",
      explicacao:
        "Heráclito de Éfeso (c. 535–475 a.C.) defendia o devir — tudo flui. A imagem do rio é atribuída a ele pela tradição (Platão, Crátilo). Parmênides, ao contrário, negava a mudança; Zenão criou paradoxos para defender essa negação.",
      referencia: "Platão — Crátilo; fragmentos DK 22 B12",
    },
    {
      id: "br-epistemologia-01",
      areaSlug: "filosofia",
      subcategoriaSlug: "epistemologia",
      dificuldade: "avancada",
      ordem: 4,
      enunciado:
        "O 'problema da indução' formulado por David Hume aponta que:",
      alternativas: alts(
        "Toda dedução é inválida",
        "A generalização de casos observados para todos os casos não tem justificação puramente racional",
        "A ciência não pode usar matemática",
        "O conhecimento inato é impossível",
        "A experiência é irrelevante para o conhecimento",
        "Todo enunciado é verificável",
      ),
      letraCorreta: "B",
      explicacao:
        "Hume mostrou que inferir 'todos os A são B' a partir de 'alguns A são B' não é dedutivamente válido, e que justificar a indução pela regularidade da natureza seria circular. É o problema que Kant tentou responder e que Popper tratou com a falseabilidade.",
      referencia: "Hume — Investigação sobre o Entendimento Humano, seção IV",
    },
    {
      id: "br-etica-01",
      areaSlug: "filosofia",
      subcategoriaSlug: "etica",
      dificuldade: "dificil",
      ordem: 3,
      enunciado:
        "O imperativo categórico de Kant afirma que devemos agir:",
      alternativas: alts(
        "Buscando a maior felicidade para o maior número de pessoas",
        "Somente segundo uma máxima que possamos querer que se torne lei universal",
        "Conforme as consequências previsíveis da ação",
        "Segundo o costume da nossa comunidade",
        "Movidos exclusivamente pela compaixão",
        "Para maximizar o lucro racional",
      ),
      letraCorreta: "B",
      explicacao:
        "A primeira formulação do imperativo categórico exige universalizabilidade da máxima. Kant rejeita fundamentar a moral nas consequências (essa é a leitura utilitarista) e no costume. Trata a pessoa sempre como fim, nunca apenas como meio.",
      referencia: "Kant — Fundamentação da Metafísica dos Costumes (1785)",
    },
    {
      id: "br-filosofia-da-ciencia-01",
      areaSlug: "filosofia",
      subcategoriaSlug: "filosofia-da-ciencia",
      dificuldade: "especialista",
      ordem: 5,
      enunciado:
        "Para Karl Popper, o critério que distingue uma teoria científica de uma pseudociência é:",
      alternativas: alts(
        "A quantidade de evidências favoráveis acumuladas",
        "A falseabilidade — a teoria deve proibir certos estados de coisas e poder ser refutada",
        "O consenso da comunidade científica",
        "O uso de matemática avançada",
        "A capacidade de explicar tudo",
        "A origem experimental dos dados",
      ),
      letraCorreta: "B",
      explicacao:
        "Popper propôs a falseabilidade como critério de demarcação: uma teoria é científica se faz previsões arriscadas, que podem ser refutadas. Uma teoria que se acomoda a qualquer resultado (e 'explica tudo') é, para ele, justamente a marca da pseudociência.",
      referencia: "Popper — Conjecturas e Refutações (1963)",
    },

    // ================= HUMANAS =================
    {
      id: "br-economia-01",
      areaSlug: "humanas",
      subcategoriaSlug: "economia",
      dificuldade: "dificil",
      ordem: 3,
      enunciado:
        "Na economia, o que mede o Produto Interno Bruto (PIB) de um país?",
      alternativas: alts(
        "A soma de todos os ativos financeiros do governo",
        "O valor de mercado dos bens e serviços finais produzidos dentro do território em um período",
        "A quantidade total de dinheiro em circulação",
        "A soma das exportações menos as dívidas externas",
        "A renda média da população",
        "O total de impostos arrecadados",
      ),
      letraCorreta: "B",
      explicacao:
        "O PIB é o valor de mercado dos bens e serviços FINAIS produzidos no território em determinado período — evita contar insumos intermediários duas vezes. Não confundir com Renda Nacional Bruta (que considera a renda de residentes, mesmo no exterior).",
      referencia: "Sistema de Contas Nacionais — manual do FMI/ONU",
    },
    {
      id: "br-direito-01",
      areaSlug: "humanas",
      subcategoriaSlug: "direito",
      dificuldade: "avancada",
      ordem: 4,
      enunciado:
        "Na Constituição brasileira de 1988, o princípio da 'legalidade' (art. 5º, II) estabelece que ninguém será obrigado a fazer ou deixar de fazer algo senão:",
      alternativas: alts(
        "Por decisão judicial fundamentada",
        "Em virtude de lei",
        "Por decreto do Poder Executivo",
        "Por ato administrativo",
        "Por determinação de autoridade policial",
        "Por costume consolidado",
      ),
      letraCorreta: "B",
      explicacao:
        "O art. 5º, II, da CF/88 diz: 'ninguém será obrigado a fazer ou deixar de fazer alguma coisa senão em virtude de lei'. Para o particular, vale a autonomia (pode fazer o que a lei não proíbe); para a Administração, o oposto (só faz o que a lei autoriza).",
      referencia: "Constituição da República Federativa do Brasil de 1988, art. 5º, II",
    },
    {
      id: "br-sociologia-01",
      areaSlug: "humanas",
      subcategoriaSlug: "sociologia",
      dificuldade: "dificil",
      ordem: 3,
      enunciado:
        "Quem descreveu a burocracia como forma de dominação racional-legal, com regras impessoais e hierarquia definida?",
      alternativas: alts("Karl Marx", "Émile Durkheim", "Max Weber", "Auguste Comte", "Pierre Bourdieu", "Talcott Parsons"),
      letraCorreta: "C",
      explicacao:
        "Max Weber (1864–1920) distinguiu tipos ideais de dominação — tradicional, carismática e racional-legal — e analisou a burocracia como expressão da última. Marx focou em classes e mais-valia; Durkheim, em fatos sociais e solidariedade.",
      referencia: "Weber — Economia e Sociedade (1922)",
    },
    {
      id: "br-relacoes-internacionais-01",
      areaSlug: "humanas",
      subcategoriaSlug: "relacoes-internacionais",
      dificuldade: "intermediaria",
      ordem: 2,
      enunciado:
        "Em que ano entrou em vigor a Carta das Nações Unidas, marco de fundação da ONU?",
      alternativas: alts("1919", "1939", "1945", "1948", "1950", "1962"),
      letraCorreta: "C",
      explicacao:
        "A Carta foi assinada em São Francisco em 26 de junho de 1945 e entrou em vigor em 24 de outubro de 1945 — data em que hoje se celebra o Dia das Nações Unidas. A Declaração Universal dos Direitos Humanos é de 1948.",
      referencia: "Carta das Nações Unidas, art. 110 (entrada em vigor)",
    },

    // ================= PSICOLOGIA =================
    {
      id: "br-psicologia-cognitiva-01",
      areaSlug: "psicologia",
      subcategoriaSlug: "psicologia-cognitiva",
      dificuldade: "avancada",
      ordem: 4,
      enunciado:
        "O experimento de Stanley Milgram (1963), em que participantes aplicavam choques aparentes por ordem de uma autoridade, investigou principalmente:",
      alternativas: alts(
        "A memória de curto prazo",
        "A obediência à autoridade",
        "A aprendizagem por reforço",
        "O condicionamento clássico",
        "A percepção visual de profundidade",
        "A privação de sono",
      ),
      letraCorreta: "B",
      explicacao:
        "Milgram investigou a obediência à autoridade após o julgamento de Eichmann. Uma proporção inesperadamente alta de participantes seguiu até o nível máximo indicado, mostrando o peso do contexto situacional — e não traços de personalidade — sobre o comportamento.",
      referencia: "Milgram (1963), Journal of Abnormal and Social Psychology, 67(4)",
    },
    {
      id: "br-psicologia-social-01",
      areaSlug: "psicologia",
      subcategoriaSlug: "psicologia-social",
      dificuldade: "dificil",
      ordem: 3,
      enunciado:
        "A 'dissonância cognitiva', conceito de Leon Festinger, ocorre quando:",
      alternativas: alts(
        "Uma pessoa tem crenças ou atitudes contraditórias entre si e busca reduzir o desconforto",
        "Duas pessoas discordam em um debate",
        "Um grupo toma decisão melhor que o indivíduo",
        "Uma pessoa esquece informações recentes",
        "Um estímulo é percebido de forma diferente por cada olho",
        "Uma tarefa é aprendida por repetição",
      ),
      letraCorreta: "A",
      explicacao:
        "Festinger descreveu o desconforto mental ao sustentar cognições contraditórias, que motiva mudança de atitude ou de comportamento para restabelecer a coerência. É o mecanismo por trás da racionalização após decisões difíceis.",
      referencia: "Festinger — A Theory of Cognitive Dissonance (1957)",
    },

    // ================= HISTÓRIA =================
    {
      id: "br-historia-do-brasil-01",
      areaSlug: "historia",
      subcategoriaSlug: "historia-do-brasil",
      dificuldade: "facil",
      ordem: 1,
      enunciado: "Em que ano a família real portuguesa chegou ao Brasil, fugindo de Napoleão?",
      alternativas: alts("1789", "1801", "1808", "1815", "1822", "1824"),
      letraCorreta: "C",
      explicacao:
        "A corte chegou ao Rio de Janeiro em 1808, escoltada pela Marinha britânica, após a invasão de Portugal pelas tropas napoleônicas. Em 1815 o Brasil foi elevado a Reino Unido a Portugal e Algarves; a Independência veio em 1822.",
      referencia: "Arquivo Nacional — vinda da Corte ao Brasil (1808)",
    },
    {
      id: "br-historia-contemporanea-01",
      areaSlug: "historia",
      subcategoriaSlug: "historia-contemporanea",
      dificuldade: "intermediaria",
      ordem: 2,
      enunciado: "Qual evento é considerado o estopim da Primeira Guerra Mundial?",
      alternativas: alts(
        "A invasão da Polônia",
        "O assassinato do arquiduque Francisco Ferdinando em Sarajevo",
        "A Revolução Russa",
        "O Tratado de Versalhes",
        "A crise dos mísseis de Cuba",
        "A queda da Bastilha",
      ),
      letraCorreta: "B",
      explicacao:
        "Em 28 de junho de 1914, Gavrilo Princip assassinou o arquiduque Francisco Ferdinando e sua esposa em Sarajevo. O episódio acionou o sistema de alianças e ultimatos, levando à guerra em agosto. A invasão da Polônia (1939) abriu a Segunda Guerra; Versalhes a encerrou.",
      referencia: "Imperial War Museums — causes of the First World War",
    },
    {
      id: "br-historia-medieval-01",
      areaSlug: "historia",
      subcategoriaSlug: "historia-medieval",
      dificuldade: "dificil",
      ordem: 3,
      enunciado:
        "A Peste Negra que devastou a Europa no século XIV é causada por qual agente e transmitida principalmente por qual vetor?",
      alternativas: alts(
        "Um vírus, transmitido por mosquitos",
        "A bactéria Yersinia pestis, transmitida por pulgas de roedores",
        "Um fungo, transmitido pelo ar em ambientes úmidos",
        "Um protozoário, transmitido pela água",
        "Uma bactéria, transmitida por contato sexual",
        "Um príon, transmitido por carne contaminada",
      ),
      letraCorreta: "B",
      explicacao:
        "A peste é causada pela bactéria Yersinia pestis, transmitida sobretudo por pulgas que parasitam roedores. A pandemia do século XIV (1347–1351) matou uma parcela enorme da população europeia e teve efeitos profundos na economia e nas relações de trabalho.",
      referencia: "OMS — Plague (who.int); Benedictow, The Black Death 1346–1353",
    },
    {
      id: "br-historia-antiga-01",
      areaSlug: "historia",
      subcategoriaSlug: "historia-antiga",
      dificuldade: "intermediaria",
      ordem: 2,
      enunciado:
        "Qual civilização mesopotâmica é creditada pelo desenvolvimento da escrita cuneiforme?",
      alternativas: alts(
        "Egípcios",
        "Sumerianos",
        "Fenícios",
        "Persas",
        "Hititas",
        "Assírios",
      ),
      letraCorreta: "B",
      explicacao:
        "Os sumérios, no sul da Mesopotâmia, desenvolveram a escrita cuneiforme por volta de 3200 a.C., inicialmente para registro contábil. Os egípcios usavam hieróglifos; os fenícios são lembrados pelo alfabeto consonântico.",
      referencia: "British Museum — Mesopotamia, writing",
    },

    // ================= GEOGRAFIA =================
    {
      id: "br-paises-e-capitais-01",
      areaSlug: "geografia",
      subcategoriaSlug: "paises-e-capitais",
      dificuldade: "facil",
      ordem: 1,
      enunciado: "Qual é a capital da Austrália?",
      alternativas: alts("Sydney", "Melbourne", "Canberra", "Perth", "Brisbane", "Adelaide"),
      letraCorreta: "C",
      explicacao:
        "Canberra é a capital, planejada justamente para encerrar a disputa entre Sydney e Melbourne. Sydney é a maior cidade do país, mas não a capital — um erro clássico.",
      referencia: "Governo da Austrália — Geoscience Australia",
    },
    {
      id: "br-geografia-fisica-01",
      areaSlug: "geografia",
      subcategoriaSlug: "geografia-fisica",
      dificuldade: "intermediaria",
      ordem: 2,
      enunciado: "Qual é o rio mais extenso do mundo em volume de água (vazão)?",
      alternativas: alts("Nilo", "Amazonas", "Yangtzé", "Mississippi", "Congo", "Ganges"),
      letraCorreta: "B",
      explicacao:
        "O Amazonas tem a maior vazão do planeta — cerca de 209.000 m³/s, mais de 15% de toda a água doce que chega aos oceanos. A disputa sobre qual é o MAIS LONGO (Nilo ou Amazonas) segue em aberto por causa dos critérios de medição da nascente.",
      referencia: "ANA / USGS — Amazon River discharge",
    },
    {
      id: "br-climatologia-01",
      areaSlug: "geografia",
      subcategoriaSlug: "climatologia",
      dificuldade: "dificil",
      ordem: 3,
      enunciado:
        "O efeito estufa é um fenômeno natural. O que o diferencia do aquecimento global observado desde a era industrial?",
      alternativas: alts(
        "O efeito estufa natural não existe",
        "A intensificação do efeito estufa pela emissão de gases como CO₂ e CH₄ pela atividade humana",
        "O aquecimento global é causado por variações da órbita terrestre",
        "O efeito estufa ocorre apenas nas cidades",
        "O aquecimento global é um fenômeno exclusivamente solar",
        "O efeito estufa só afeta a camada de ozônio",
      ),
      letraCorreta: "B",
      explicacao:
        "O efeito estufa natural mantém a Terra habitável (sem ele, a média seria cerca de −18 °C em vez de ~15 °C). O problema é sua INTENSIFICAÇÃO: a queima de combustíveis fósseis e o desmatamento elevam a concentração de gases, aumentando a retenção de calor. A camada de ozônio é outro fenômeno (filtro de UV).",
      referencia: "IPCC — AR6 Synthesis Report, WG I",
    },
    {
      id: "br-cartografia-01",
      areaSlug: "geografia",
      subcategoriaSlug: "cartografia",
      dificuldade: "avancada",
      ordem: 4,
      enunciado:
        "Por que a projeção de Mercator distorce as áreas próximas aos polos?",
      alternativas: alts(
        "Porque usa cores inadequadas",
        "Porque preserva ângulos (conformidade) ao custo de exagerar as áreas em altas latitudes",
        "Porque ignora a linha do Equador",
        "Porque foi feita apenas para mapas políticos",
        "Porque usa coordenadas polares",
        "Porque não representa oceanos",
      ),
      letraCorreta: "B",
      explicacao:
        "Mercator é uma projeção CONFORME: preserva ângulos e, por isso, é ótima para navegação (rumos constantes são linhas retas). O preço é a distorção de área, que cresce com a latitude — na Groenlândia o exagero é enorme em relação à América do Sul.",
      referencia: "Snyder — Map Projections: A Working Manual (USGS)",
    },

    // ================= ARTES =================
    {
      id: "br-literatura-01",
      areaSlug: "artes",
      subcategoriaSlug: "literatura",
      dificuldade: "intermediaria",
      ordem: 2,
      enunciado:
        "Quem escreveu «Dom Casmurro», narrado por Bentinho e centrado na dúvida sobre a fidelidade de Capitu?",
      alternativas: alts(
        "José de Alencar",
        "Machado de Assis",
        "Aluísio Azevedo",
        "Graciliano Ramos",
        "Lima Barreto",
        "Raul Pompeia",
      ),
      letraCorreta: "B",
      explicacao:
        "«Dom Casmurro» (1899) é de Machado de Assis. O romance é narrado em primeira pessoa por Bentinho, e a ambiguidade sobre Capitu é construída pelo próprio narrador — a famosa 'cega dúvida' do leitor.",
      referencia: "Machado de Assis — Dom Casmurro (1899), primeira edição",
    },
    {
      id: "br-musica-01",
      areaSlug: "artes",
      subcategoriaSlug: "musica",
      dificuldade: "dificil",
      ordem: 3,
      enunciado:
        "Na música ocidental, quantos semitons há em uma oitava?",
      alternativas: alts("6", "7", "8", "12", "13", "24"),
      letraCorreta: "D",
      explicacao:
        "Uma oitava é dividida em 12 semitons na afinação temperada. São 7 notas naturais (dó, ré, mi, fá, sol, lá, si) mais 5 acidentes, totalizando 12 passos. Essa divisão é o que permite transpor entre tonalidades de forma consistente.",
      referencia: "Teoria musical padrão — temperamento igual",
    },
    {
      id: "br-cinema-01",
      areaSlug: "artes",
      subcategoriaSlug: "cinema",
      dificuldade: "intermediaria",
      ordem: 2,
      enunciado:
        "O filme «Cidadão Kane» (1941), frequentemente citado entre os mais influentes da história, foi dirigido por:",
      alternativas: alts(
        "Alfred Hitchcock",
        "Orson Welles",
        "John Ford",
        "Fritz Lang",
        "Billy Wilder",
        "Stanley Kubrick",
      ),
      letraCorreta: "B",
      explicacao:
        "Orson Welles dirigiu, coescreveu e protagonizou «Cidadão Kane» aos 25 anos, revolucionando o uso de profundidade de campo, iluminação e narrativa não linear. A estrutura investigativa da vida de Kane é inspirada em William Randolph Hearst.",
      referencia: "American Film Institute — AFI's 100 Years...100 Movies",
    },
    {
      id: "br-mitologia-01",
      areaSlug: "artes",
      subcategoriaSlug: "mitologia",
      dificuldade: "facil",
      ordem: 1,
      enunciado:
        "Na mitologia grega, quem é o deus associado ao mar, irmão de Zeus e Hades?",
      alternativas: alts("Apolo", "Ares", "Posêidon", "Hermes", "Hefesto", "Dioniso"),
      letraCorreta: "C",
      explicacao:
        "Posêidon governa os mares e recebeu esse domínio no sorteio entre os três irmãos: Zeus ficou com o céu, Hades com o mundo dos mortos e Posêidon com o mar. Seu equivalente romano é Netuno.",
      referencia: "Hesíodo — Teogonia",
    },

    // ================= OUTRAS =================
    {
      id: "br-medicina-01",
      areaSlug: "outras",
      subcategoriaSlug: "medicina-e-saude",
      dificuldade: "dificil",
      ordem: 3,
      enunciado:
        "Qual vitamina é sintetizada na pele humana a partir da exposição à radiação ultravioleta B?",
      alternativas: alts("Vitamina A", "Vitamina B12", "Vitamina C", "Vitamina D", "Vitamina E", "Vitamina K"),
      letraCorreta: "D",
      explicacao:
        "A vitamina D é sintetizada na pele a partir do 7-desidrocolesterol sob radiação UVB. A B12 é obtida de fontes animais, a C de frutas cítricas e a K tem papel na coagulação. Excesso de sol, porém, traz outros riscos.",
      referencia: "OMS / NIH Office of Dietary Supplements — Vitamin D",
    },
    {
      id: "br-engenharia-01",
      areaSlug: "outras",
      subcategoriaSlug: "engenharia",
      dificuldade: "avancada",
      ordem: 4,
      enunciado:
        "Na engenharia estrutural, por que arcos e cúpulas são eficientes em vãos grandes?",
      alternativas: alts(
        "Porque usam menos material colorido",
        "Porque trabalham predominantemente em compressão, aproveitando bem materiais como pedra e concreto",
        "Porque anulam a gravidade",
        "Porque dispensam fundações",
        "Porque só funcionam em madeira",
        "Porque convertem compressão em tração pura",
      ),
      letraCorreta: "B",
      explicacao:
        "Arcos e cúpulas direcionam as cargas para os apoios principalmente como COMPRESSÃO. Pedra e concreto resistem muito bem à compressão e mal à tração — daí o sucesso histórico dessas formas (Panteão, catedrais). O arco cria empuxo horizontal, que exige contrafortes ou tirantes.",
      referencia: "Salvadori — Why Buildings Stand Up",
    },
    {
      id: "br-linguistica-01",
      areaSlug: "outras",
      subcategoriaSlug: "linguistica",
      dificuldade: "especialista",
      ordem: 5,
      enunciado:
        "A hipótese de Sapir-Whorf, em sua versão FORTE, afirma que:",
      alternativas: alts(
        "Todas as línguas têm a mesma estrutura profunda",
        "A língua determina o pensamento, limitando o que é possível pensar",
        "O pensamento determina a língua, e não o contrário",
        "Crianças aprendem gramática por imitação",
        "A escrita precedeu a fala na história humana",
        "Línguas isoladas não possuem gramática",
      ),
      letraCorreta: "B",
      explicacao:
        "A versão forte (determinismo linguístico) sustenta que a língua molda e limita o pensamento; a versão fraca (relativismo) apenas diz que a língua INFLUENCIA a cognição. A versão forte é hoje amplamente contestada — o caso dos termos de cor e de espaço mostra influência, não aprisionamento.",
      referencia: "Whorf — Language, Thought, and Reality (1956)",
    },
    {
      id: "br-conhecimentos-gerais-01",
      areaSlug: "outras",
      subcategoriaSlug: "conhecimentos-gerais",
      dificuldade: "facil",
      ordem: 1,
      enunciado:
        "Quantos jogadores de cada equipe ficam em campo em uma partida oficial de futebol?",
      alternativas: alts("9", "10", "11", "12", "13", "7"),
      letraCorreta: "C",
      explicacao:
        "Cada equipe entra com 11 jogadores, incluindo o goleiro. Uma equipe com menos de 7 jogadores em campo tem a partida encerrada. As Regras do Jogo são mantidas pelo IFAB, com aval da FIFA.",
      referencia: "IFAB — Laws of the Game, Law 3",
    },
    {
      id: "br-esportes-01",
      areaSlug: "outras",
      subcategoriaSlug: "esportes",
      dificuldade: "intermediaria",
      ordem: 2,
      enunciado:
        "Em quantos anos os Jogos Olímpicos de Verão e de Inverno passaram a ser realizados, a partir de 1994?",
      alternativas: alts(
        "No mesmo ano, sempre juntos",
        "Alternadamente, a cada 2 anos",
        "A cada 4 anos, no mesmo ano",
        "A cada 3 anos",
        "A cada 5 anos",
        "Apenas quando há sede disponível",
      ),
      letraCorreta: "B",
      explicacao:
        "Até 1992, Verão e Inverno ocorriam no mesmo ano. A partir de Lillehammer-1994, o Comitê Olímpico Internacional passou a alterná-los a cada 2 anos, de modo que sempre há uma Olimpíada a cada dois anos, mas cada ciclo (Verão ou Inverno) é de 4 anos.",
      referencia: "Comitê Olímpico Internacional — Olympic Games history",
    },
    {
      id: "br-agricultura-01",
      areaSlug: "outras",
      subcategoriaSlug: "agricultura",
      dificuldade: "dificil",
      ordem: 3,
      enunciado:
        "Por que a rotação de culturas ajuda a controlar pragas e doenças na lavoura?",
      alternativas: alts(
        "Porque aumenta o preço do produto",
        "Porque quebra o ciclo de vida de pragas e patógenos específicos da cultura anterior",
        "Porque elimina toda a necessidade de água",
        "Porque torna o solo mais compactado",
        "Porque impede a fotossíntese das plantas daninhas",
        "Porque dispensa o uso de sementes",
      ),
      letraCorreta: "B",
      explicacao:
        "Pragas e patógenos costumam ser específicos de uma cultura e sobrevivem no solo ou em restos culturais. Alternar espécies com ciclos e exigências diferentes interrompe esse ciclo, reduz a pressão de doença e ainda melhora a fertilidade. É manejo integrado, não uma solução isolada.",
      referencia: "Embrapa — Rotação de culturas e manejo integrado de pragas",
    },
  ] satisfies SemUsos[]
).map((p) => ({ ...p, usos: 0 }));

/**
 * Acervo completo = núcleo curado + expansão que cobre as subcategorias que
 * estavam sem nenhuma pergunta. A checagem de colisão de id roda na carga do
 * módulo: dois arquivos com o mesmo id fariam o gabarito local divergir do
 * banco silenciosamente, então é melhor quebrar aqui, alto e claro.
 */
export const ACERVO_COMPLETO: PerguntaBruta[] = (() => {
  const todos = [...ACERVO_BRIO, ...ACERVO_EXPANSAO.map((p) => ({ ...p, usos: 0 }))];
  const vistos = new Set<string>();
  for (const p of todos) {
    if (vistos.has(p.id)) throw new Error(`Acervo do Brio com id duplicado: ${p.id}`);
    vistos.add(p.id);
  }
  return todos;
})();

/** Acervo com o gabarito reequilibrado — é ESTE que vai para o banco e a UI. */
export const ACERVO_BRIO_EQUILIBRADO: PerguntaBruta[] = equilibrarGabarito(ACERVO_COMPLETO);

/** Índice por id — usado pelo fallback local e pelos testes. */
export const ACERVO_POR_ID: Record<string, PerguntaBruta> = Object.fromEntries(
  ACERVO_BRIO_EQUILIBRADO.map((p) => [p.id, p]),
);

/** Gabarito local (id → letra correta). NUNCA vai ao cliente durante a partida. */
export const GABARITO_LOCAL: Record<string, Letra> = Object.fromEntries(
  ACERVO_BRIO_EQUILIBRADO.map((p) => [p.id, p.letraCorreta]),
);
