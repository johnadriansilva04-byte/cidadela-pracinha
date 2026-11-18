/**
 * Testes do MODO HISTÓRIA do Guerra de Brio (motor puro).
 *
 * Roda com: JITI_TSCONFIG_PATHS=true ./node_modules/.bin/jiti testes/brio-campanha.test.mts
 */
import { ATOS, atoPorId, totalDeCenas } from "../src/lib/brio/campanha/atos";
import { CLIMA_AMBIENCIA, CLIMA_LABEL, type ClimaCena } from "../src/lib/brio/campanha/tipos";
import { REFERENCIAS, referenciaPorId } from "../src/lib/brio/campanha/referencias";
import {
  aplicarResultadoDuelo,
  avancarCena,
  campanhaConcluida,
  campanhaInicial,
  cenaAtualDe,
  concluirAto,
  dueloDoAto,
  escolhaFeita,
  escolher,
  normalizarCampanha,
  percentualCampanha,
  progressoDosAtos,
  proximoAto,
  registrarPerguntas,
  ROTULO_TRACO,
  tracoDominante,
} from "../src/lib/brio/campanha/motor";
import { CLASSIFICACAO_LABEL } from "../src/lib/brio/campanha/tipos";
import { ACERVO_BRIO_EQUILIBRADO } from "../src/lib/brio/acervo";
import { passaFiltro } from "../src/lib/brio/selecao";

let ok = 0;
let falhas = 0;
function checar(cond: boolean, msg: string) {
  if (cond) {
    ok += 1;
  } else {
    falhas += 1;
    console.log("  FALHA:", msg);
  }
}
const AGORA = "2026-11-17T12:00:00.000Z";

// ------------------------------------------------------------- estrutura
checar(ATOS.length === 6, "a campanha tem 6 atos");
checar(totalDeCenas() === 12, `a campanha tem 12 cenas (tem ${totalDeCenas()})`);
checar(
  ATOS.every((a, i) => a.numero === i + 1),
  "os atos estão numerados em sequência",
);
checar(
  ATOS.every((a) => a.cenas.length > 0),
  "todo ato tem ao menos uma cena",
);

// ids de cena/ato/escolha únicos
const idsAto = new Set(ATOS.map((a) => a.id));
checar(idsAto.size === ATOS.length, "ids de ato são únicos");
const idsCena = new Set(ATOS.flatMap((a) => a.cenas.map((c) => c.id)));
checar(idsCena.size === totalDeCenas(), "ids de cena são únicos");
const idsEscolha = new Set(ATOS.flatMap((a) => a.cenas.flatMap((c) => c.escolhas.map((e) => e.id))));
const totalEscolhas = ATOS.flatMap((a) => a.cenas.flatMap((c) => c.escolhas)).length;
checar(idsEscolha.size === totalEscolhas, "ids de escolha são únicos");

// -------------------------------------------------------------- rigor
checar(REFERENCIAS.length >= 15, `há ao menos 15 referências (${REFERENCIAS.length})`);
checar(
  REFERENCIAS.every((r) => r.fonte.trim().length > 0),
  "toda referência declara a fonte",
);
checar(
  REFERENCIAS.every((r) => r.resumo.trim().length > 40),
  "toda referência tem resumo substantivo",
);
checar(
  REFERENCIAS.every((r) => CLASSIFICACAO_LABEL[r.classificacao] !== undefined),
  "toda classificação tem rótulo",
);
// Toda referência citada por uma cena existe de verdade.
const citadas = ATOS.flatMap((a) => a.cenas.map((c) => c.referenciaId)).filter(Boolean) as string[];
checar(
  citadas.every((id) => referenciaPorId(id) !== null),
  "toda referência citada por uma cena existe",
);
checar(citadas.length >= 8, `há cenas com referência declarada (${citadas.length})`);
// O jogo não pode apresentar hipótese/ficção como fato: as três forças existem.
const forcas = new Set(REFERENCIAS.map((r) => r.classificacao));
checar(forcas.has("HISTORICAL_FACT"), "há fatos históricos declarados");
checar(forcas.has("HYPOTHESIS"), "há hipóteses declaradas como hipótese");
checar(forcas.has("FICTION"), "a ficção do jogo está declarada como ficção");
checar(forcas.has("SECONDARY_SOURCE"), "há fontes secundárias declaradas");

// A ficção (viagem no tempo) NUNCA é classificada como fato.
const ficcao = REFERENCIAS.filter((r) => r.id.startsWith("ref-ficcao"));
checar(
  ficcao.length > 0 && ficcao.every((r) => r.classificacao === "FICTION"),
  "o salto temporal é FICTION, nunca fato histórico",
);
const hipotese = referenciaPorId("ref-hipotese-transmissao");
checar(hipotese?.classificacao === "HYPOTHESIS", "a transmissão de ideias é HYPOTHESIS");

// --------------------------------------------------------- toda cena jogável
checar(
  ATOS.every((a) => a.cenas.every((c) => c.escolhas.length >= 1)),
  "toda cena tem ao menos uma escolha (nenhuma cena trava)",
);
checar(
  ATOS.every((a) => a.cenas.every((c) => c.texto.length >= 1 && c.texto.every((t) => t.trim().length > 20))),
  "toda cena tem texto substantivo",
);
checar(
  ATOS.every((a) => a.cenas.every((c) => c.escolhas.every((e) => e.resposta.trim().length > 20))),
  "toda escolha devolve uma consequência escrita",
);

// ------------------------------------------------------------- duelos
const atosComDuelo = ATOS.filter((a) => dueloDoAto(a) !== null);
checar(atosComDuelo.length === 6, `todos os 6 atos têm prova (${atosComDuelo.length})`);
for (const a of ATOS) {
  const d = dueloDoAto(a);
  if (!d) continue;
  checar(d.total >= 4 && d.total <= 10, `ato ${a.numero}: prova com 4..10 perguntas`);
  checar(d.acertosMinimos > 0 && d.acertosMinimos <= d.total, `ato ${a.numero}: mínimo de acertos coerente`);
  checar(d.nivelAdversario >= 1 && d.nivelAdversario <= 4, `ato ${a.numero}: nível 1..4`);
}

// O recorte de cada prova precisa ter acervo suficiente — senão a seleção
// devolve menos perguntas do que o ato pede.
for (const a of ATOS) {
  const d = dueloDoAto(a);
  if (!d) continue;
  const elegiveis = ACERVO_BRIO_EQUILIBRADO.filter((p) =>
    passaFiltro(p, {
      modalidade: d.modalidade,
      areaSlug: d.areaSlug,
      subcategoriaSlug: d.subcategoriaSlug,
    }),
  );
  checar(
    elegiveis.length >= d.total,
    `ato ${a.numero}: acervo suficiente para a prova (${elegiveis.length} >= ${d.total})`,
  );
}

// ------------------------------------------------------- fluxo do motor
const inicial = campanhaInicial();
checar(inicial.atoAtual === "ato-1", "campanha começa no ato 1");
checar(inicial.cenaAtual === 0, "campanha começa na cena 0");
checar(inicial.iniciadaEm === null, "campanha nova não está marcada como iniciada");
checar(inicial.tracos.rigor === 0 && inicial.tracos.empatia === 0 && inicial.tracos.coragem === 0, "traços começam zerados");
checar(inicial.protagonista.nome === "Pracinha", "protagonista padrão é o Pracinha");
checar(inicial.protagonista.posto.includes("FEB"), "o posto padrão é o expedicionário da FEB");

// escolher aplica efeito e registra
const cena1 = cenaAtualDe(inicial)!;
checar(cena1 !== null, "a primeira cena existe");
const { estado: aposEscolha, escolha } = escolher(inicial, cena1, cena1.escolhas[0]!.id, AGORA);
checar(escolha !== null, "a escolha foi aplicada");
checar(aposEscolha.escolhas[cena1.id] === cena1.escolhas[0]!.id, "a escolha ficou registrada");
const efeitoEsperado = cena1.escolhas[0]!.efeito ?? {};
checar(
  aposEscolha.tracos.rigor === (efeitoEsperado.rigor ?? 0),
  "o traço rigor foi somado",
);
checar(escolhaFeita(aposEscolha, cena1)?.id === cena1.escolhas[0]!.id, "escolhaFeita devolve a escolha salva");

// escolha inválida não muda nada
const invalida = escolher(inicial, cena1, "nao-existe", AGORA);
checar(invalida.escolha === null && invalida.estado === inicial, "escolha inválida é ignorada sem efeito");

// avançar dentro do ato
const avanco = avancarCena(aposEscolha, AGORA);
checar(avanco.estado.cenaAtual === 1, "avançar move para a cena seguinte");
checar(!avanco.abrirDuelo, "avançar dentro do ato não abre prova");

// última cena do ato abre a prova
const cenaFinal = cenaAtualDe(avanco.estado)!;
checar(cenaFinal.duelo !== undefined, "a última cena do ato 1 traz a prova");
const aposUltima = avancarCena(avanco.estado, AGORA);
checar(aposUltima.abrirDuelo, "ao passar da última cena, a prova é aberta");
checar(aposUltima.estado.concluidos["ato-1"] === undefined, "o ato NÃO é concluído antes da prova");

// --------------------------------------------------- resultado da prova
const reprovado = aplicarResultadoDuelo(aposUltima.estado, 0, AGORA);
checar(!reprovado.venceu, "0 acertos não vence a prova");
checar(reprovado.estado.atoAtual === "ato-1", "reprovar mantém o jogador no ato");
checar(reprovado.estado.concluidos["ato-1"] === undefined, "reprovar não marca o ato como concluído");

const aprovado = aplicarResultadoDuelo(aposUltima.estado, 4, AGORA);
checar(aprovado.venceu, "acima do mínimo vence a prova");
checar(aprovado.estado.concluidos["ato-1"] === 4, "o ato é concluído com os acertos");
checar(aprovado.estado.atoAtual === "ato-2", "vencer avança para o ato 2");
checar(aprovado.estado.cenaAtual === 0, "o ato novo começa na primeira cena");

// borda exata do mínimo
const cfgAto1 = dueloDoAto(ATO_1())!;
const exato = aplicarResultadoDuelo(aposUltima.estado, cfgAto1.acertosMinimos, AGORA);
checar(exato.venceu, "acertar exatamente o mínimo vence (borda inclusiva)");
const umAbaixo = aplicarResultadoDuelo(aposUltima.estado, cfgAto1.acertosMinimos - 1, AGORA);
checar(!umAbaixo.venceu, "um acerto abaixo do mínimo não vence");

function ATO_1() {
  return atoPorId("ato-1")!;
}

// ------------------------------------------------------- antirrepetição
const comHist = registrarPerguntas(inicial, ["p1", "p2", "p1"], AGORA);
checar(comHist.historicoPerguntas.length === 2, "perguntas repetidas entram uma vez só");
checar(comHist.historicoPerguntas.includes("p1"), "a pergunta registrada está no histórico");
const comMuitas = registrarPerguntas(inicial, Array.from({ length: 900 }, (_, i) => `x${i}`), AGORA);
checar(comMuitas.historicoPerguntas.length === 500, "o histórico é limitado a 500 (não cresce sem fim)");

// ------------------------------------------------------------- progresso
const prog = progressoDosAtos(inicial);
checar(prog.length === 6, "o progresso lista os 6 atos");
checar(prog[0]!.situacao === "atual", "o primeiro ato é o atual");
checar(prog[5]!.situacao === "bloqueado", "o último ato começa bloqueado");
checar(percentualCampanha(inicial) === 0, "campanha nova está em 0%");
checar(percentualCampanha(aprovado.estado) === 17, "concluir 1 de 6 atos dá 17%");
checar(!campanhaConcluida(inicial), "campanha nova não está concluída");

// concluir a campanha inteira
let fim = campanhaInicial();
for (const a of ATOS) fim = concluirAto(fim, a.id, 5, AGORA);
checar(campanhaConcluida(fim), "concluir todos os atos fecha a campanha");
checar(percentualCampanha(fim) === 100, "campanha concluída está em 100%");
checar(proximoAto(ATOS[5]!) === null, "o último ato não tem próximo");
checar(proximoAto(ATOS[0]!)?.id === "ato-2", "o próximo do ato 1 é o ato 2");

// ------------------------------------------------------------- traços
checar(tracoDominante({ rigor: 10, empatia: 2, coragem: 1 }) === "rigor", "traço dominante = rigor");
checar(tracoDominante({ rigor: 0, empatia: 5, coragem: 0 }) === "empatia", "traço dominante = empatia");
checar(tracoDominante({ rigor: 3, empatia: 3, coragem: 1 }) === "equilibrado", "empate no topo = equilibrado");
checar(tracoDominante({ rigor: 0, empatia: 0, coragem: 0 }) === "equilibrado", "sem escolhas = equilibrado");
checar(typeof ROTULO_TRACO["equilibrado"] === "string", "há rótulo para o perfil equilibrado");

// ---------------------------------------------------------- normalização
checar(normalizarCampanha(null) === null, "normalizar null devolve null");
checar(normalizarCampanha("lixo") === null, "normalizar string devolve null");
const corrompido = normalizarCampanha({
  atoAtual: "ato-inexistente",
  cenaAtual: 999,
  tracos: { rigor: "x", empatia: -5, coragem: 2.7 },
  concluidos: { "ato-1": 3, "ato-falso": 9 },
  historicoPerguntas: ["a", 1, "b"],
})!;
checar(corrompido.atoAtual === "ato-1", "ato inexistente volta ao ato 1");
checar(corrompido.cenaAtual === 1, "cena fora de faixa é limitada à última do ato");
checar(corrompido.tracos.rigor === 0, "traço não-numérico vira 0");
checar(corrompido.tracos.empatia === 0, "traço negativo é limitado a 0");
checar(corrompido.tracos.coragem === 2, "traço decimal é truncado");
checar(corrompido.concluidos["ato-falso"] === undefined, "ato falso é descartado");
checar(corrompido.concluidos["ato-1"] === 3, "ato válido é preservado");
checar(corrompido.historicoPerguntas.length === 2, "histórico não-string é filtrado");

// ida e volta: salvar → normalizar preserva o progresso
const salvo = normalizarCampanha(JSON.parse(JSON.stringify(aprovado.estado)))!;
checar(salvo.atoAtual === aprovado.estado.atoAtual, "round-trip preserva o ato");
checar(salvo.concluidos["ato-1"] === 4, "round-trip preserva os acertos");
checar(salvo.tracos.rigor === aprovado.estado.tracos.rigor, "round-trip preserva os traços");

// ---------------------------------------------------------------------
// CLIMA — a direção de arte é DADO do roteiro, não decisão do componente.
// ---------------------------------------------------------------------
const CLIMAS: ClimaCena[] = [
  "guerra",
  "deslocamento",
  "presente",
  "arquivo",
  "porao",
  "laboratorio",
  "tribunal",
  "veredito",
];

checar(ATOS.every((a) => CLIMAS.includes(a.clima)), "todo ato declara um clima conhecido");
checar(ATOS.length === 6, "os 6 atos estão no roteiro");
checar(
  ATOS.every((a) => a.cenas.every((c) => c.clima === undefined || CLIMAS.includes(c.clima))),
  "toda cena que declara clima usa um clima conhecido",
);
checar(CLIMAS.every((c) => typeof CLIMA_LABEL[c] === "string" && CLIMA_LABEL[c].length > 0),
  "todo clima tem rótulo legível");
checar(CLIMAS.every((c) => typeof CLIMA_AMBIENCIA[c] === "number" && CLIMA_AMBIENCIA[c] >= 0 && CLIMA_AMBIENCIA[c] <= 1),
  "toda ambiência está na faixa 0..1");

// O clima precisa MUDAR ao longo da campanha — seis atos com a mesma cara
// seriam direção de arte nenhuma.
const distintos = new Set(ATOS.map((a) => a.clima));
checar(distintos.size === ATOS.length, `cada ato tem um clima PRÓPRIO (${distintos.size} climas para 6 atos)`);

// A cena pode sobrepor o clima do ato (é o caso do porão e do arquivo).
const cenasComClimaProprio = ATOS.flatMap((a) => a.cenas.filter((c) => c.clima && c.clima !== a.clima));
checar(cenasComClimaProprio.length >= 2, `há cenas que sobrepõem o clima do ato (${cenasComClimaProprio.length})`);
checar(ATOS.find((a) => a.id === "ato-3")?.cenas.some((c) => c.clima === "porao"),
  "o ato da escravidão tem cena de porão (claustrofobia)");
checar(ATOS.find((a) => a.id === "ato-3")?.cenas.some((c) => c.clima === "arquivo"),
  "o ato da escravidão tem cena de arquivo (a prova documental)");
checar(ATOS.find((a) => a.id === "ato-1")?.cenas.some((c) => c.clima === "presente"),
  "o ato 1 contrasta 1944 com o século XXI (neon)");

// O porão é o clima mais opressivo — a ambiência tem de refletir isso.
checar(CLIMA_AMBIENCIA.porao === Math.max(...CLIMAS.map((c) => CLIMA_AMBIENCIA[c])),
  "o porão é o clima de maior ambiência (mais opressivo)");
checar(CLIMA_AMBIENCIA.presente === Math.min(...CLIMAS.map((c) => CLIMA_AMBIENCIA[c])),
  "o presente é o clima de menor ambiência (mais leve)");

console.log(`\nMODO HISTÓRIA DO BRIO — ${ok} ok, ${falhas} falhas`);
if (falhas > 0) process.exit(1);
