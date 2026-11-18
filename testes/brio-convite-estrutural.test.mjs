/**
 * Guarda estrutural do DUELO POR CONVITE (dois humanos) do Guerra de Brio.
 *
 * Não há Supabase configurado no workspace, então este teste NÃO executa o
 * SQL: ele trava o CONTRATO entre a migration e o cliente, que é exatamente
 * onde estava o bug — `brio_entrar_partida` exige uma sala `aguardando`, mas
 * `brio_criar_partida` criava TODA partida `em_andamento`, então o convidado
 * nunca conseguia entrar (o convite era impossível).
 */
import { readFileSync } from "node:fs";

const SQL = readFileSync("supabase/migrations/guerra_de_brio.sql", "utf8");
const API = readFileSync("src/lib/brio/api.ts", "utf8");
const LOBBY = readFileSync("src/components/brio/LobbyBrio.tsx", "utf8");
const JOGO = readFileSync("src/components/brio/GuerraDeBrio.tsx", "utf8");
const ROTA = readFileSync("src/routes/cidadela.tsx", "utf8");

let ok = 0;
let falhas = 0;
function checar(cond, msg) {
  if (cond) {
    ok += 1;
    console.log(`  ✓ ${msg}`);
  } else {
    falhas += 1;
    console.log(`  ✗ ${msg}`);
  }
}

function corpoDaFuncao(nome) {
  const i = SQL.indexOf(`FUNCTION public.${nome}(`);
  if (i < 0) return "";
  const fim = SQL.indexOf("$$;", i);
  return SQL.slice(i, fim);
}

console.log("\n=== 1. Contrato do SQL: sala de convite ===");
const criar = corpoDaFuncao("brio_criar_partida");
checar(/p_aberta\s+BOOLEAN\s+DEFAULT\s+FALSE/.test(criar), "criar_partida aceita p_aberta");
checar(
  /CASE WHEN p_aberta THEN 'aguardando' ELSE 'em_andamento' END/.test(criar),
  "sala de convite nasce 'aguardando'",
);
checar(/IF NOT p_aberta THEN/.test(criar), "sala de convite NÃO inicia ao ser criada");
checar(
  /p_aberta AND p_bot_nivel IS NOT NULL/.test(criar),
  "sala de convite rejeita adversário virtual",
);

const entrar = corpoDaFuncao("brio_entrar_partida");
checar(/status <> 'aguardando'/.test(entrar), "entrar_partida exige sala 'aguardando'");
checar(/bot_nivel IS NOT NULL/.test(entrar), "entrar_partida recusa sala contra bot");
checar(/jogador_2_id = v_uid/.test(entrar), "entrar_partida ocupa o assento 2");
checar(
  /rodada_liberada_em = now\(\)/.test(entrar),
  "o relógio da rodada 1 começa quando o convidado entra",
);

console.log("\n=== 2. Gabarito não vaza antes da revelação ===");
const estado = corpoDaFuncao("brio_estado_partida");
checar(
  /CASE WHEN r\.revelada THEN r\.letra_correta ELSE NULL END/.test(estado),
  "letra correta só sai quando a rodada foi revelada",
);
checar(
  /WHEN resp\.jogador_id = v_uid THEN resp\.letra/.test(estado),
  "a minha resposta sempre volta para mim",
);
checar(
  /THEN resp\.letra\s*ELSE NULL END/.test(estado),
  "a resposta do adversário fica oculta até a revelação",
);

console.log("\n=== 3. Cliente envia e lê o convite ===");
checar(/aberta\?: boolean/.test(API), "OpcoesPartida expõe `aberta`");
checar(/p_aberta: opcoes\.aberta \?\? false/.test(API), "criarPartida envia p_aberta");
checar(/brio_entrar_partida/.test(API), "API chama brio_entrar_partida");
checar(/export async function entrarPartida/.test(API), "entrarPartida é exportada");

console.log("\n=== 4. UI: convite só com conta e com backend ===");
checar(/podeConvidar/.test(LOBBY), "lobby recebe podeConvidar");
checar(
  /conviteEfetivo = convite && podeConvidar && !modoLocal/.test(LOBBY),
  "convite exige conta E backend ativo",
);
checar(/data-brio-modo="convite"/.test(LOBBY), "há seletor de modo convite no lobby");
checar(/convite: conviteEfetivo/.test(LOBBY), "o lobby envia o modo convite escolhido");

console.log("\n=== 5. Jogo: sala de espera, link e sincronização ===");
checar(/botNivel: escolha\.convite \? null/.test(JOGO), "convite não usa adversário virtual");
checar(/aberta: escolha\.convite/.test(JOGO), "convite cria sala aberta");
checar(/esperandoConvidado/.test(JOGO), "existe a tela de sala aberta");
checar(/function linkConvite/.test(JOGO), "há link de convite para enviar");
checar(/\?brio=/.test(JOGO), "o link usa o parâmetro ?brio=");
checar(/setInterval\(async \(\) => \{/.test(JOGO), "o jogo sincroniza com o servidor");
checar(
  /const fechada = atual\.rodada_atual - 1/.test(JOGO),
  "a revelação considera que o servidor AVANÇA rodada_atual",
);
checar(/revelacaoVistaRef/.test(JOGO), "a revelação não reabre depois de vista");

console.log("\n=== 6. Rota: link direto abre o duelo ===");
checar(/get\("brio"\)/.test(ROTA), "a Cidadela lê ?brio=");
checar(/conviteInicial=\{conviteBrioId\}/.test(ROTA), "o id do convite chega ao jogo");

console.log("\n=== 7. Aviso de modo local é honesto ===");
const aviso = /AVISO_MODO_LOCAL =\s*\n?\s*"([^"]+)"/.exec(API)?.[1] ?? "";
checar(/não é salvo/.test(aviso), "o aviso diz que o resultado não é salvo");
checar(!/sincroniz/i.test(aviso), "o aviso NÃO promete sincronização (o modo local não salva)");

console.log("\n=== 8. A tela de resultado degrada sem servidor ===");
// `supabase.rpc` lança de forma SÍNCRONA quando o Supabase não está
// configurado, e um `.catch()` no Promise não pega isso: a tela de resultado
// quebrava inteira (build sem VITE_SUPABASE_*). O ranking é acessório, então
// precisa vir atrás da checagem de configuração.
const RESULTADO = readFileSync("src/components/brio/ResultadoBrio.tsx", "utf8");
checar(
  /if \(isSupabaseConfigured\(\)\) \{/.test(RESULTADO),
  "o resultado checa isSupabaseConfigured antes de chamar o ranking",
);
checar(
  /if \(isSupabaseConfigured\(\)\) \{[\s\S]{0,400}?supabase\.rpc\(/.test(RESULTADO),
  "a chamada de ranking está DENTRO da guarda de configuração",
);
checar(
  (RESULTADO.match(/supabase\.rpc\(/g) ?? []).length ===
    (RESULTADO.match(/isSupabaseConfigured\(\)/g) ?? []).length,
  "cada supabase.rpc do resultado tem uma guarda de configuração",
);
checar(
  /isSupabaseConfigured/.test(RESULTADO),
  "a tela importa isSupabaseConfigured",
);

console.log(`\n${ok} passaram, ${falhas} falharam (total ${ok + falhas})`);
if (falhas > 0) process.exit(1);
console.log("BRIO — CONVITE (contrato) OK");
