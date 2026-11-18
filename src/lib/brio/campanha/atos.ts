/**
 * ROTEIRO DA CAMPANHA do Guerra de Brio — o modo história.
 *
 * Voz em PRIMEIRA PESSOA: o jogador é o expedicionário. Nada aqui é narrado
 * "sobre" ele em terceira pessoa.
 *
 * SOBRE CONTEÚDO PESSOAL: o jogo não conhece nem inventa a biografia de quem
 * joga. Quem joga define nome e posto (`Protagonista`), e as cenas usam esses
 * campos. Para plugar material próprio (estudos de caso), basta acrescentar
 * atos nesta lista — o motor lê `ATOS` e não precisa mudar.
 *
 * RIGOR: cada cena que afirma algo sobre o passado aponta para uma referência
 * em `referencias.ts`, que declara se é fato, fonte secundária, hipótese ou
 * ficção. A campanha não ensina história sem dizer de onde vem.
 */
import type { Ato } from "./tipos";

export const VERSAO_CAMPANHA = 1;

export const ATOS: Ato[] = [
  // ===================================================================
  {
    id: "ato-1",
    numero: 1,
    titulo: "O Despertar",
    subtema: "Itália, 1944 — e o chão que não é o meu",
    icone: "🌅",
    clima: "deslocamento",
    referencias: [],
    cenas: [
      {
        id: "a1c1",
        titulo: "Sem Nevoeiro",
        texto: [
          "Abro os olhos e não há neve.",
          "Nos últimos meses, acordar significava sentir o frio antes de lembrar quem eu era. " +
            "O vale, a lama, o barulho daquela montanha que a gente tentou tomar quatro vezes. " +
            "O nome vinha junto com o frio: Monte Castello.",
          "Agora o chão é liso e claro, e o ar não dói no peito. O silêncio é errado. " +
            "Não é o silêncio depois do bombardeio — é o silêncio de um lugar que não espera nada.",
          "Estou com a farda. Está limpa. Isso, mais do que qualquer outra coisa, me assusta.",
        ],
        escolhas: [
          {
            id: "a1c1e1",
            texto: "Conferir meus documentos e minha unidade antes de qualquer coisa.",
            resposta:
              "Abro o bolso do peito. A caderneta está lá, com o carimbo do regimento, as datas, " +
              "os nomes dos companheiros. Se eu enlouqueci, a papelada enlouqueceu comigo — " +
              "e papelada não enlouquece junto.",
            efeito: { rigor: 2 },
          },
          {
            id: "a1c1e2",
            texto: "Procurar alguém. Qualquer pessoa. Preciso ouvir uma voz.",
            resposta:
              "Ando até encontrar uma mulher que espera num ponto qualquer. Ela olha para a minha " +
              "farda sem espanto — olha como quem olha uma roupa velha. Pergunto onde fica o comando. " +
              "Ela responde num português que eu entendo, e é isso que me desmonta: eu entendo, " +
              "mas as palavras têm outro peso.",
            efeito: { empatia: 2 },
          },
          {
            id: "a1c1e3",
            texto: "Tocar as coisas. Testar se o mundo é sólido.",
            resposta:
              "Encosto a mão no vidro de uma vitrine e sinto o frio do material. Bato com o nó do dedo. " +
              "É real. Seja lá o que aconteceu comigo, não é sonho — e sonho não se pode enfrentar, " +
              "mas realidade sim.",
            efeito: { coragem: 2 },
          },
        ],
      },
      {
        id: "a1c2",
        titulo: "O Século que Não É o Meu",
        clima: "presente",
        texto: [
          "Encontro a data. Não vou repetir aqui o número que li naquele painel — " +
            "quem passou por isso entende por que a gente fica um tempo sem conseguir falar.",
          "O que sei é isto: saí de um mundo em que a Europa estava em chamas e cheguei num mundo " +
            "em que ela é um passeio. As pessoas tiram fotografias de si mesmas em frente a prédios " +
            "antigos. Ninguém olha para cima com medo.",
          "E eu, que vim da guerra para acabar com ela, preciso entender uma coisa muito simples " +
            "e muito difícil: o que vocês fizeram com o século que eu ajudei a salvar?",
        ],
        referenciaId: "ref-ficcao-viagem",
        escolhas: [
          {
            id: "a1c2e1",
            texto: "Aceitar que não vou entender isso sozinho. Vou estudar.",
            resposta:
              "Sento e começo pelo começo. Não pela data — pela pergunta. " +
              "Um soldado não julga o campo antes de olhar o terreno.",
            efeito: { rigor: 1 },
          },
          {
            id: "a1c2e2",
            texto: "Sentir falta. Dos meus. Do que eu deixei lá.",
            resposta:
              "Deixo a saudade vir inteira, porque ela também é informação. Quem não sente falta " +
              "não entende o que se perdeu — e a história é feita de gente que perdeu alguma coisa.",
            efeito: { empatia: 1 },
          },
        ],
        duelo: {
          titulo: "Prova de Reconhecimento",
          modalidade: "multidisciplinar",
          areaSlug: null,
          subcategoriaSlug: null,
          nivelAdversario: 1,
          total: 4,
          acertosMinimos: 2,
        },
      },
    ],
  },

  // ===================================================================
  {
    id: "ato-2",
    numero: 2,
    titulo: "A Guerra que Volta",
    subtema: "Geopolítica: 1914, 1939 e o que veio depois",
    icone: "⚔️",
    clima: "guerra",
    referencias: [],
    cenas: [
      {
        id: "a2c1",
        titulo: "Duas Guerras na Mesma Vida",
        texto: [
          "Meu pai fez a guerra de catorze. Eu fiz a de trinta e nove. Entre uma e outra passaram-se " +
            "vinte e um anos — tempo suficiente para um menino nascer, crescer e ser chamado " +
            "para repetir o serviço do pai.",
          "Sempre me disseram que a primeira foi por causa de um tiro, em Sarajevo. Um arquiduque, " +
            "uma pistola, uma cidade. E eu, que carreguei fuzil por meses, sei muito bem que nenhuma " +
            "guerra começa com um tiro. O tiro é o que sobra depois que tudo já estava armado.",
          "Aprendi isso no campo, não nos livros: quem procura o culpado no estopim nunca encontra a causa.",
        ],
        referenciaId: "ref-geopolitica-1914",
        escolhas: [
          {
            id: "a2c1e1",
            texto: "Separar o estopim da causa. São coisas diferentes.",
            resposta:
              "Anoto com cuidado: em Sarajevo houve um gatilho. As alianças, a corrida armamentista " +
              "e a disputa por colônias eram o barril. Um historiador que confunde os dois não explica " +
              "nada — e um povo que confunde os dois não se previne de nada.",
            efeito: { rigor: 2 },
          },
          {
            id: "a2c1e2",
            texto: "Pensar nos soldados do outro lado, que fizeram o mesmo que eu.",
            resposta:
              "Do outro lado da linha havia homens com a mesma farda, o mesmo frio e a mesma carta " +
              "no bolso. Essa é a parte que os discursos nunca mencionam, porque atrapalha a história " +
              "que querem contar.",
            efeito: { empatia: 2 },
          },
        ],
      },
      {
        id: "a2c2",
        titulo: "A Paz que Gerou Guerra",
        texto: [
          "Depois de catorze, assinaram um tratado. Impuseram contas e tiraram terras. " +
            "Muita gente boa acreditou que aquilo era o fim.",
          "Não era. O que veio depois mostrou que uma paz humilhante não é paz — é intervalo. " +
            "E o intervalo terminou em trinta e nove, comigo dentro.",
          "O que eu quero saber é se vocês aprenderam a diferença entre vencer e resolver. " +
            "Porque eu vi de perto o que acontece quando se confunde as duas.",
        ],
        referenciaId: "ref-geopolitica-versalhes",
        escolhas: [
          {
            id: "a2c2e1",
            texto: "Reconhecer que o tratado contribuiu, sem transformá-lo em causa única.",
            resposta:
              "A historiografia não fecha a questão, e eu não vou fechar por ela. O tratado criou um " +
              "clima explosivo — isso é sustentável. Dizer que ele 'causou' a guerra sozinho seria " +
              "trocar uma simplificação por outra.",
            efeito: { rigor: 2 },
            revelaFonte: true,
          },
          {
            id: "a2c2e2",
            texto: "Perguntar o que aconteceu depois. A história não parou em 1945.",
            resposta:
              "Não parou. Vieram décadas de disputa entre duas potências, conflitos por procuração " +
              "em outros continentes, bombas capazes de acabar com tudo. A violência organizada não " +
              "morreu com o inimigo que eu combati — só mudou de endereço.",
            efeito: { coragem: 1 },
          },
        ],
        duelo: {
          titulo: "Prova de História",
          modalidade: "categoria",
          areaSlug: "historia",
          subcategoriaSlug: null,
          nivelAdversario: 2,
          total: 5,
          acertosMinimos: 3,
        },
      },
    ],
  },

  // ===================================================================
  {
    id: "ato-3",
    numero: 3,
    titulo: "O Navio e o Silêncio",
    subtema: "Escravidão: o crime mais longo",
    icone: "⛓️",
    clima: "porao",
    referencias: [],
    cenas: [
      {
        id: "a3c1",
        titulo: "O Que Não Me Contaram",
        clima: "porao",
        texto: [
          "Eu era um homem do meu tempo. Não me venha com a conversa de que eu não sabia — " +
            "a gente sempre sabe mais do que admite.",
          "Mas tem uma coisa que descobri aqui, e que me deixou parado no meio da rua: " +
            "o meu país foi o ÚLTIMO das Américas a acabar com a escravidão.",
          "O último. Depois de todos. E eu, que fui enviado para lutar contra um regime que separava " +
            "pessoas por raça, vim de um lugar onde aquilo durou séculos e acabou por lei — " +
            "não por convicção.",
          "A lei acabou com o cativeiro. Não acabou com o resto.",
        ],
        referenciaId: "ref-escravidao-brasil-abolicao",
        escolhas: [
          {
            id: "a3c1e1",
            texto: "Ir atrás dos números. Quantos foram embarcados?",
            resposta:
              "Cerca de doze milhões atravessaram o Atlântico à força; dez milhões chegaram vivos. " +
              "O maior contingente das Américas veio para o Brasil. Não são 'muitos' — são pessoas " +
              "contadas uma por uma em registros de navio, feitos por gente que anotava carga.",
            efeito: { rigor: 2 },
          },
          {
            id: "a3c1e2",
            texto: "Ficar com o que a lei não fez. Reparação, terra, escola.",
            resposta:
              "Nada disso veio junto com a assinatura. Quem saiu do cativeiro saiu sem terra, " +
              "sem instrução e sem indenização, num país que continuou tratando gente livre como " +
              "mercadoria. A abolição fechou uma porta e deixou a casa de pé.",
            efeito: { empatia: 2 },
          },
        ],
      },
      {
        id: "a3c2",
        titulo: "Quem Escreveu a Justificativa",
        clima: "arquivo",
        texto: [
          "O que me intriga não é a crueldade — crueldade eu vi de perto e ela não me surpreende mais.",
          "O que me intriga é o trabalho intelectual. As teorias, os livros, os sermões, as teses sobre " +
            "'civilização'. Gente letrada passou décadas construindo argumentos para tornar aceitável " +
            "o que não tinha defesa.",
          "Isso me ensina uma coisa sobre o meu próprio tempo: quando o interesse é grande, " +
            "aparece ciência para sustentá-lo.",
        ],
        referenciaId: "ref-escravidao-ideologia",
        escolhas: [
          {
            id: "a3c2e1",
            texto: "Procurar quem resistiu. Não aceitar a versão de passividade.",
            resposta:
              "Encontro quilombos que duraram décadas, revoltas, fugas, negociações cotidianas, " +
              "recusas de toda ordem. Palmares resistiu até 1695. A ideia de que um povo aceitou " +
              "séculos de cativeiro sem lutar é invenção de quem precisava se justificar.",
            efeito: { coragem: 2 },
          },
          {
            id: "a3c2e2",
            texto: "Comparar com o que vi na guerra. O padrão se repete.",
            resposta:
              "É o mesmo mecanismo: primeiro se retira a humanidade do outro, depois qualquer coisa " +
              "fica permitida. Vi isso ser feito com vizinhos, com doentes, com crianças — por gente " +
              "que voltava para casa e beijava os filhos.",
            efeito: { rigor: 1, empatia: 1 },
          },
        ],
        duelo: {
          titulo: "Prova de Humanidades",
          modalidade: "categoria",
          areaSlug: "humanas",
          subcategoriaSlug: null,
          nivelAdversario: 3,
          total: 5,
          acertosMinimos: 3,
        },
      },
    ],
  },

  // ===================================================================
  {
    id: "ato-4",
    numero: 4,
    titulo: "A Ciência do Desprezo",
    subtema: "Eugenia: quando o saber decidiu quem vale mais",
    icone: "🧬",
    clima: "laboratorio",
    referencias: [],
    cenas: [
      {
        id: "a4c1",
        titulo: "Um Nome Elegante para uma Coisa Antiga",
        texto: [
          "Deram um nome bonito a uma coisa muito velha. 'Eugenia' — a ideia de que seria possível " +
            "melhorar a espécie decidindo quem deveria nascer.",
          "Repare na pretensão. Não se trata de curar doença: trata-se de estabelecer quem tem valor " +
            "e quem não tem. Uma pessoa, num gabinete, assinando quais vidas valem a pena.",
          "Não sou cientista. Mas sou um homem que recebeu ordens de gente instruída, e aprendi " +
            "a desconfiar de quem trata seres humanos como material de construção.",
        ],
        referenciaId: "ref-eugenia-origem",
        escolhas: [
          {
            id: "a4c1e1",
            texto: "Exigir a distinção: o que foi política, o que foi ciência.",
            resposta:
              "Separo com cuidado. Havia médicos e estatísticos envolvidos — isso é fato documentado. " +
              "E havia uma escolha política por trás, que vestiu a roupa da ciência para não precisar " +
              "se explicar. Confundir as duas é o erro que permitiu tudo.",
            efeito: { rigor: 2 },
          },
          {
            id: "a4c1e2",
            texto: "Lembrar que a vítima tinha nome, rosto, voz.",
            resposta:
              "Antes de qualquer número existe uma pessoa que foi levada de uma instituição médica, " +
              "ou de uma casa, por gente que achava estar fazendo o bem. O número vem depois. " +
              "O rosto vem primeiro.",
            efeito: { empatia: 2 },
          },
        ],
      },
      {
        id: "a4c2",
        titulo: "Não Foi um Só Povo",
        texto: [
          "Seria confortável acreditar que isso foi coisa de um país, num período, e que o resto da " +
            "humanidade assistiu de longe.",
          "Não foi. Leis de esterilização compulsória existiram em vários países — inclusive em " +
            "democracias que se consideravam exemplares, com respaldo de tribunal.",
          "E aqui, na minha terra, esse pensamento também circulou. Em revistas especializadas, " +
            "em projetos de higiene e saneamento que olhavam para a miséria e chamavam aquilo " +
            "de hereditariedade.",
          "Quando o desprezo é bem vestido, ele atravessa fronteiras e séculos.",
        ],
        referenciaId: "ref-eugenia-esterilizacao",
        escolhas: [
          {
            id: "a4c2e1",
            texto: "Reconhecer o alcance internacional. Não é um caso isolado.",
            resposta:
              "Anoto o que é fato: leis de esterilização existiram em vários países, e o programa T4 " +
              "levou o princípio ao extremo dentro de instituições médicas. Chamar isso de 'desvio de " +
              "um povo' é a maneira mais rápida de não aprender nada.",
            efeito: { rigor: 2 },
            revelaFonte: true,
          },
          {
            id: "a4c2e2",
            texto: "Olhar o Brasil. Aqui também teve.",
            resposta:
              "Teve. Nas décadas de vinte e trinta, com nomes respeitáveis e linguagem técnica, " +
              "associando pobreza e doença a supostos defeitos de raça. Não foi importado como " +
              "mercadoria — encontrou terreno pronto.",
            efeito: { coragem: 2 },
          },
        ],
        duelo: {
          titulo: "Prova de Ciências",
          modalidade: "categoria",
          areaSlug: "ciencias",
          subcategoriaSlug: null,
          nivelAdversario: 3,
          total: 5,
          acertosMinimos: 3,
        },
      },
    ],
  },

  // ===================================================================
  {
    id: "ato-5",
    numero: 5,
    titulo: "O Tribunal",
    subtema: "Nuremberg: inventar um crime para poder julgar",
    icone: "⚖️",
    clima: "tribunal",
    referencias: [],
    cenas: [
      {
        id: "a5c1",
        titulo: "A Lei Não Alcançava",
        texto: [
          "Depois da guerra, julgaram os chefes. Li sobre isso aqui, muito tempo depois, e uma coisa " +
            "me chamou mais atenção do que as sentenças.",
          "O que aqueles homens fizeram estava, em boa parte, DENTRO da lei deles. Tinham decretos, " +
            "assinaturas, pareceres jurídicos. Estavam amparados.",
          "Foi preciso inventar uma categoria nova — crime contra a humanidade — porque a lei de um só " +
            "país não alcançava o que havia sido feito.",
          "Isso me diz algo que levo a sério: às vezes é a lei que precisa aprender, e não a vítima " +
            "que precisa se encaixar nela.",
        ],
        referenciaId: "ref-eugenia-julgamento",
        escolhas: [
          {
            id: "a5c1e1",
            texto: "Entender o mecanismo: legalidade não é o mesmo que justiça.",
            resposta:
              "Um ato pode ser legal e continuar sendo atroz. Foi preciso criar um conceito que dissesse " +
              "isso em voz alta, num tribunal, com consequências. Não é detalhe jurídico — é uma linha " +
              "que a humanidade demorou muito para traçar.",
            efeito: { rigor: 2 },
          },
          {
            id: "a5c1e2",
            texto: "Pensar em quem testemunhou. O peso de dizer em voz alta.",
            resposta:
              "Para quem sobreviveu, testemunhar não é fechar um capítulo — é reabri-lo na frente de " +
              "estranhos, com um microfone apontado. A coragem de quem falou é maior do que qualquer " +
              "coisa que eu fiz em campo.",
            efeito: { empatia: 2 },
          },
        ],
      },
      {
        id: "a5c2",
        titulo: "O Que Sobrevive",
        texto: [
          "Aqui preciso ser honesto comigo mesmo, porque já vi muita certeza fazer estrago.",
          "Ninguém sabe exatamente como uma ideia de exclusão atravessa gerações. Há quem diga que o " +
            "que sobrevive são as instituições e as leis; há quem diga que é a linguagem do dia a dia, " +
            "o jeito de falar do vizinho.",
          "A pesquisa não fechou a questão. Então não vou fingir que sei.",
          "Mas uma coisa eu posso fazer: ficar de olho. Porque o que se repete nunca se repete igual — " +
            "vem com outro nome, outra roupa, outro argumento.",
        ],
        referenciaId: "ref-hipotese-transmissao",
        escolhas: [
          {
            id: "a5c2e1",
            texto: "Marcar isso como hipótese. Não transformar dúvida em lição.",
            resposta:
              "Anoto assim, com todas as letras: aqui há debate aberto. Ensinar como certeza o que " +
              "ainda é pergunta é o primeiro passo para criar a próxima geração de gente com convicção " +
              "e sem base.",
            efeito: { rigor: 2 },
            revelaFonte: true,
          },
          {
            id: "a5c2e2",
            texto: "Aceitar o que não sei e seguir com o que posso vigiar.",
            resposta:
              "Não preciso de uma teoria completa para reconhecer o começo de uma. Basta prestar atenção " +
              "quando alguém começa a dividir as pessoas em categorias de valor — é sempre por aí " +
              "que começa.",
            efeito: { coragem: 1, rigor: 1 },
          },
        ],
        duelo: {
          titulo: "Prova de Filosofia",
          modalidade: "categoria",
          areaSlug: "filosofia",
          subcategoriaSlug: null,
          nivelAdversario: 4,
          total: 5,
          acertosMinimos: 3,
        },
      },
    ],
  },

  // ===================================================================
  {
    id: "ato-6",
    numero: 6,
    titulo: "O Veredito",
    subtema: "O que eu levo de volta",
    icone: "🎖️",
    clima: "veredito",
    referencias: [],
    cenas: [
      {
        id: "a6c1",
        titulo: "A Pergunta do Pracinha",
        texto: [
          "Volto a pensar na pergunta que me trouxe até aqui.",
          "Ajudei a derrubar um regime que decidiu quais vidas valiam mais. E chego num século em que " +
            "a mesma ideia continua por aí — mais educada, mais discreta, às vezes com dados, " +
            "às vezes com piada.",
          "Então a resposta não é 'vencemos'. Vitória não é o mesmo que cura.",
          "Talvez a única coisa que eu possa deixar seja isto: a pergunta certa. Quem está decidindo " +
            "quem vale mais agora? E com que argumento?",
        ],
        referenciaId: "ref-feb-memoria",
        escolhas: [
          {
            id: "a6c1e1",
            texto: "Manter a pergunta viva, mesmo sem resposta confortável.",
            resposta:
              "Não vim trazer certeza. Vim trazer o hábito de perguntar de onde vem a versão que me " +
              "estão contando — e quem ganha com ela.",
            efeito: { rigor: 2 },
          },
          {
            id: "a6c1e2",
            texto: "Ficar com as pessoas. A história é feita de gente.",
            resposta:
              "No fim, o que sobrou dos meus anos de farda não foi o mapa nem a ordem de operação. " +
              "Foram os nomes. Sempre foram os nomes.",
            efeito: { empatia: 2 },
          },
        ],
      },
      {
        id: "a6c2",
        titulo: "Meu Relatório",
        texto: [
          "Um oficial escreve um relatório quando termina. Vou escrever o meu.",
          "Não vou escrever 'missão cumprida'. Não é verdade, e eu não gosto de mentira em papel oficial.",
          "Vou escrever o que aprendi: que o povo que faz a guerra é o mesmo que sofre com ela; " +
            "que a lei pode ser justa ou pode ser só organizada; que desprezo bem vestido é mais " +
            "perigoso do que desprezo declarado.",
          "E vou assinar embaixo: soldado expedicionário, presente. Ainda de olho.",
        ],
        referenciaId: "ref-feb-italia",
        escolhas: [
          {
            id: "a6c2e1",
            texto: "Assinar e seguir em frente.",
            resposta:
              "Assino. Fecho a caderneta. O século é de vocês — mas a memória do que custou chegar " +
              "até aqui eu não devolvo.",
            efeito: { coragem: 2 },
          },
        ],
        duelo: {
          titulo: "Prova Final",
          modalidade: "multidisciplinar",
          areaSlug: null,
          subcategoriaSlug: null,
          nivelAdversario: 4,
          total: 6,
          acertosMinimos: 4,
        },
      },
    ],
  },
];

export const ATO_POR_ID: Record<string, Ato> = Object.fromEntries(ATOS.map((a) => [a.id, a]));

export function atoPorId(id: string): Ato | null {
  return ATO_POR_ID[id] ?? null;
}

/** Total de cenas da campanha (progresso do painel). */
export function totalDeCenas(): number {
  return ATOS.reduce((soma, a) => soma + a.cenas.length, 0);
}
