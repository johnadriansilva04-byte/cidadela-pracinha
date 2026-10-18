## IA dos jogos: fim do atalho de `suggestMove` + chave de jogada estável (2026-10-18, 35ª passada)

Pedido do dono: "melhorias". Achei e corrigi **três** defeitos medidos, todos na
camada de IA compartilhada (nenhum é regra de jogo).

- **O `suggestMove` do motor ATALHAVA a busca inteira**: em `decidirJogada`, se o
  adaptador tinha `suggestMove`, a função retornava ele e nunca instanciava o
  MCTS. Medido com sonda descartável: Reversi usava o palpite em **97%** das
  posições, Mancala em **59%**, Blackjack em 100%. Consequência: o seletor de
  dificuldade era quase inerte nesses jogos (Fácil e Difícil jogavam a MESMA
  heurística gulosa de 1 ply) e, no Mancala, o palpite guloso **perdia 0 x 4**
  para a busca — ou seja, o jogo era mais forte SEM o atalho.
  Fix: o palpite virou **prior** (`hintMove` + `hintPriorWeight` no `MCTSConfig`).
  Ele é a primeira jogada testada na verificação negamax e ganha prior na árvore,
  mas quem decide é a busca. Peso cresce com o nível (Fácil 1, Médio 2, Difícil 4).
  Resultado medido (6 partidas por jogo, caminho real da UI): Difícil 5x1 Fácil
  no Reversi, 6x0 no Mancala, 6x0 na Liga 4, 5x0(+1 empate) na Velha.
- **`engine.moveKey?.()` devolvia `undefined` nos dois lados**: a comparação
  `moveKey?.(a) === moveKey?.(b)` vira `undefined === undefined` → `true` para
  QUAISQUER duas jogadas. Dois efeitos reais: (1) a verificação negamax nunca
  anexava os lances não simulados (o `!ordered.some(...)` dava sempre falso); e
  (2) o filtro de alternativas do `blunder` descartava TUDO — **os níveis fáceis
  nunca erravam de propósito** (medido: 0 alternativas em Reversi/Mancala/Liga 4/
  Velha; agora 3/5/6/8). Fix: `chaveDaJogada(engine, move)` em
  `src/lib/ai/GameEngine.ts` — usa `moveKey` quando existe e cai num JSON que
  **ignora `timestamp`** (ele é `Date.now()` em `UniversalGameUtils.createMove`
  e faria jogadas idênticas parecerem diferentes). Os 4 adaptadores novos também
  ganharam `moveKey` explícito (o contrato já previa; era omissão minha).
- **`MCTSConfig` virou genérico** (`MCTSConfig<M extends Move = Move>`) para
  tipar `hintMove` sem `any`. O default do parâmetro mantém o uso antigo válido.
- **Testes permanentes** em `testes/motores-universais.mts` (64 checks, eram 57):
  `chaveDaJogada` distingue jogadas sem `moveKey` e ignora `timestamp`; o filtro
  do blunder tem alternativas; o palpite é prior (peso > 0) e os pesos crescem
  com o nível; Difícil vence o Fácil no Mancala e no Reversi.
- **Armadilha do harness**: as sondas temporárias foram removidas; o que fica é
  a suíte. Ao medir força, use `jogadaComImperfeicao` (caminho da UI, aplica o
  `blunder`) — `decidirJogada` faz os dois lados jogarem perfeito e mede outra
  coisa. Determinismo: `timeBudgetMs: 0` desliga o relógio (senão o nº de
  simulações varia com a carga da máquina e o teste vira flaky).
- **Verificação**: tsc 0 erros; `motores-universais` 64/64; `render-jogos` 63/63;
  build OK; `e2e-jogos` 39/39 com 0 erros de console. O Trilha (outro consumidor
  do MCTS) segue coberto e verde na suíte.


## 4 jogos novos + reserva de orçamento do MCTS (2026-10-18, 34ª passada)

Pedido do dono: "arrume os jogos, add mais". O motor universal declarava ~63
categorias e só 5 estavam implementadas. Agora são **9**.

- **Jogos novos** (adaptador + view + card na Cidadela): **Liga 4**
  (`board_connect_four`), **Jogo da Velha** (`board_tic_tac_toe`),
  **Reversi** (`board_reversi`) e **Mancala** (`board_mancala`). Cada um segue o
  padrão do motor: `src/lib/universal/adapters/XAdapter.ts` (regras + `evaluate`
  + `suggestMove`), registro em `ADAPTERS`/`PLAYABLE` do
  `UniversalGameFactory.ts`, view em `src/components/universal/XGameView.tsx`
  (só o tabuleiro; `GameShell` dá header/dificuldade/status) e rota em
  `src/routes/cidadela.tsx` (tipo `Game`, card em `GAMES`, despacho e render).
  A IA vem de graça pelo MCTS genérico — nenhum adaptador tem IA própria.
- **Armadilha do motor (vale para todo adaptador novo)**: `GamePiece` usa
  `data` (não `customData`) e `PieceType`/`MoveType` são uniões fechadas
  (`"token"`, `"stone"`, `"play"`, `"pass"`, ...). Tipo fora da união = erro TS.
- **BUG GRAVE no MCTS — a verificação negamax NUNCA rodava no Difícil**:
  `verifyDeadline` era fixado no MESMO instante do fim do orçamento que a busca
  já havia consumido por inteiro. Como o Difícil (`maxIterations: 40000`) sempre
  satura o relógio, `verifyRoot` abortava na primeira checagem; o Fácil, que
  termina antes do prazo, ainda ganhava a checagem — **o Difícil jogava PIOR que
  o Fácil** (medido: Difícil 2 x 3 Fácil na Liga 4). Fix: `verifyTimeShare`
  (padrão 0.25) — a busca para em `timeBudgetMs * (1 - share)` e a verificação
  usa o restante. Medido depois: Difícil 1800ms → ~1360ms de busca + verificação
  ativa; Fácil/Médio intactos; latência continua dentro do orçamento.
- **Guarda de força nova** em `testes/motores-universais.mts`: Difícil tem de
  vencer o Fácil na Liga 4. ATENÇÃO: a guarda usa `jogadaComImperfeicao` (o
  caminho REAL da UI, que aplica o `blunder` dos níveis baixos) — com
  `decidirJogada` os dois lados jogam perfeito e a guarda mede outra coisa.
- **Verificação**: tsc 0; `motores-universais` 57/57; `render-jogos` 63/63;
  build OK; E2E navegador `testes/e2e-jogos.mjs` **39/39 com 0 erros de
  console** (as 9 mesas abrem, aceitam jogada e nenhum overlay cobre o
  tabuleiro); `bench-forca` general vs recruta/sargento 100% (intacto).


## IA dos jogos de tabuleiro — MCTS + verificação negamax (2026-10-18, 33ª passada)

Queixa do dono: "a IA do nível Difícil não vence os níveis baixos". Causa raiz
era o **rollout**, não o UCB1 nem a classe `Node`. Medido com sondas descartáveis
em `testes/probe-*.mts` (removidas depois; o que fica é `testes/motores-universais.mts`
+ `testes/bench-forca.mts` + `testes/e2e-jogos.mjs`).

- **BUG 1 — orçamento de tempo ignorado (travava a UI)**: uma iteração do MCTS
  podia estourar o orçamento inteiro. Xadrez "Fácil" (250ms) rodava **4306ms**.
  Fix: `deadline` no MCTS checado DENTRO do rollout. Agora 253ms.
- **BUG 2 — rollout heurístico jogava PIOR que o aleatório**: `pickRolloutMove`
  avaliava cada lance candidato (`applyMove` + `evaluate`) em cada ply, custando
  ~1,5ms/ply. Cabiam **7 simulações** contra **51** do rollout aleatório no
  mesmo orçamento — e perdia de 0V-6D para a jogada aleatória. Fix: rollout
  ALEATÓRIO por padrão (`useHeuristicRollout: false`). O rollout barato rende
  mais simulações; a qualidade tática vem da verificação.
- **BUG 3 — recompensa binária destruía o sinal**: no corte por profundidade,
  `wonForPerspective: value > 0` convertia a heurística em "venci/não venci":
  vantagem de 0,02 virava vitória cheia. Fix: `backpropagate(reward: number)`
  contínuo em [0,1] e `simulate` devolvendo `sigmoid(value, rolloutValueScale)`.
- **BUG 4 — xadrez: geração de lances lenta**: `legalMoves` chamava `applyRaw`
  (clone profundo `JSON.parse(JSON.stringify)`, 0,17ms) por pseudo-lance (~20×).
  Fix: legalidade só na grade (`gridAfterMove`, `kingPosInGrid`, `isAttacked`).
  **3,13ms → 0,087ms (36×)**; meio-jogo 4,2ms → 0,040ms (105×). Correção provada
  por perft exato (20/400/8902) + teste diferencial (15360 comparações, 0
  divergências) + roque (2 lances).
- **A CORREÇÃO QUE RESOLVEU — verificação negamax na raiz (`verifyDepth`)**:
  MCTS puro decide pela média de poucas simulações por lance, o que é ruído em
  jogos de muitos lances legais. O MCTS passa a definir só a ORDEM (mais
  simuladas primeiro → maximiza os cortes alfa-beta) e o negamax DECIDE, sobre
  TODAS as jogadas legais. Mesma arquitetura do motor "General" da Trilha
  (`src/lib/trilha/ai.ts`). Níveis: Fácil d1 / Médio d2 / Difícil d3.
  Resultado: **Fácil/Médio/Difícil 6V-0D-0E contra a jogada aleatória** (antes
  o General perdia). `bench-forca`: general vs recruta 6W, vs sargento 6W.
- **`verifyDepth` PRECISA de teto de tempo**: o negamax da raiz roda depois do
  orçamento do MCTS e é sem limite por natureza. Sem `verifyDeadline` o Difícil
  do xadrez levava 2937ms para um orçamento de 1800ms. O prazo agora é checado
  em `negamax` (corte com avaliação estática) e entre candidatos na raiz, e
  `negamax` usa o prazo da BUSCA quando não há verificação — sem isso o prior de
  expansão estourava o "Fácil" (423ms). Todos os níveis agora respeitam o
  orçamento (≤0,4% de folga).
- **BUG 5 — damas não tinha regra de empate**: sem ela dois reis se perseguem
  para sempre e a partida NUNCA termina (a IA ficava em loop indefinido).
  Adicionada a regra dos 40 lances (`halfMoveClock` + `DRAW_HALF_MOVES = 80`,
  reinicia em captura ou coroação).
- **BUG 6 — `promoted` estava errado nas damas**: era `ty === última fileira`,
  ou seja, um rei andando na própria fileira "promovia" de novo a cada lance —
  isso zerava o relógio de empate para sempre e ABORTAVA cadeias de captura de
  reis. Agora é `!jaEraRei && chegouNaUltima` (coroou AGORA).
- **Teste flaky corrigido**: `jogarPartida` usava `timeBudgetMs`, então o número
  de simulações variava com a carga da máquina e o resultado da partida mudava
  entre execuções. Agora usa `timeBudgetMs: 0` + `maxIterations` (determinístico)
  e o teste de damas exige que a partida TERMINE (vitória OU empate), não que
  haja vencedor — exigir vencedor era errado com a regra dos 40 lances.
- **Verificação**: `tsc --noEmit` 0 erros; `npm run build` OK; motores-universais
  35/35; render-jogos 35/35; e2e-jogos (navegador) 23/23 com 0 erros de console;
  bench-forca general 100% vs recruta e sargento.
- **Armadilha de medição**: sonda de força com `verifyDepth` só tem valor se o
  MCTS construir o objeto com a opção — a primeira varredura usou um binário
  antigo e reportou derrota que não existia. Conferir o resultado com o caminho
  de PRODUÇÃO (`aiUniversal.decidirJogada`), não só com o MCTS cru.

## Módulo "Teste de QI" na home + UI profissional (2026-08-28, 32ª passada)

- **Teste de QI movido para a HOME** (`/`): card "Teste de QI" (ícone brain,
  gradiente indigo→violet) substitui o card **"Gerador de Texto"** na página
  principal — a rota `/gerador` continua existindo, só sem o card. O card do
  Brio foi REMOVIDO (`src/routes/brio.tsx` sem a seção brain). Header da home:
  "Teste de QI, Jogos e Campus". A rota `/teste-de-qi` (landing) e os dois
  sub-módulos (Exercícios `/teste-qi`, Simulação `/simulacao-qi`) continuam
  acessíveis e agora com breadcrumb/meta "Cidadela do Pracinha" (não mais
  "Desenvolvimento do Brio").
- **Landing `/teste-de-qi`** (rota dedicada): dois sub-módulos — **Exercícios**
  (rota `/teste-qi`, componente `IQTestComponent`, "ENSINO") e **Simulação**
  (rota `/simulacao-qi`, componente `SimulacaoIQ`, "AVALIAÇÃO", 32 questões,
  25 min). Nada mudou na separação `mode` exercise/simulation no banco/motor.
- **Aviso do modo offline LIMPO**: a mensagem "Modo local (banco de questões
  determinístico)..." foi substituída por um aviso elegante com dot azul —
  "Sua prova está em modo offline — o resultado fica salvo neste aparelho e
  será sincronizado em breve." (classe `.qi-aviso--local` + `.qi-aviso-dot`).
- **UI da simulação redesenhada** (`src/styles.css` bloco `.qi-simulacao`):
  células da matriz CLARAS com gradiente radial (nada de "quadrado preto
  gigante" — o `.qi-matrix-wrap` agora tem fundo SUTIL alpha ~8-14%); figuras
  MUITO MAIORES via `renderer.tsx` (`SIZE_SCALE` 30..88 → forma grande mede
  ~64px numa célula de 108px; `sizeInBox = f.size * (100/155)`, margem 10,
  escala max 1.1); **lado a lado** em telas largas (`.qi-corpo` grid 2 colunas
  ≥900px: matriz esquerda + opções direita) e empilhado no mobile. E2E
  `testes/e2e-simulacao-qi.mjs` (27 checks) continua VERDE.
- **Exercícios /teste-qi**: figuras também maiores via `constants.ts`
  (`SIZE_VALUES` 0.4..0.9 → 0.55..1.05); matriz max-w 520px com moldura
  esmeralda e opções AO LADO da matriz em telas largas.
- **Migration idempotente**: `supabase/migrations/qi_simulacao.sql` ganhou
  `DROP POLICY IF EXISTS` antes dos 4 `CREATE POLICY qi_attempts_proprias_*`
  (corrige erro 42710 "policy already exists" ao reaplicar). ATENÇÃO:
  `testes/gerador-qi-seed.mts` REGRAVA a migration — o bloco idempotente
  também foi adicionado no template do gerador para não regredir.
- **Verificação**: tsc 0; build OK; e2e-simulacao-qi 27/27; qi-embaralhar 10/10;
  estruturais (persistencia-unica 122, conta-sem-perfil 33, sov-consistencia 6,
  onclick-guard, fluxo-usuario-novo 14); SSR flow/botaogame/futebol OK.

## Simulação de Teste de QI vs EXERCÍCIOS — módulos 100% separados (2026-08-28)

- **DOIS módulos, REGRA ABSOLUTA**: `teste-qi/` (componente `IQTestComponent`,
  tela `/teste-qi` + modal no CampusHub — "EXERCÍCIOS", treinamento, com
  explicação de regras e recompensa SALVE) e `simulacao-qi/` (rota
  `/simulacao-qi` — "SIMULAÇÃO", 32 questões inéditas, 25 min, 6 alternativas
  A-F em 3×2, sem feedback/dicas durante a prova, resultado só ao final).
  NENHUMA questão aparece nos dois — separação por `mode` (`exercise`/
  `simulation`) no BANCO (`qi_questions`) E no motor. `sim-*` NUNCA no banco
  de exercícios; `ex-*` NUNCA na prova.
- **Banco**: `supabase/migrations/qi_simulacao.sql` (ordem 14 no README) —
  seeds próprios 32 sim + 24 ex gerados por `testes/gerador-qi-seed.mts`
  (o seed REGRAVA a migration + `banco-local.ts`; se rodar, conferir o diff
  antes de commitar). `correct_option INTEGER CHECK (0..5)` (índice canônico
  nas options). `qi_test_attempts` com RLS `user_id = auth.uid()` (REVOKE
  anon/authenticated nas tabelas; GRANT SELECT q/UPDATE attempts p/ o dono;
  `correct_option` NUNCA exposta por RPC — `qi_buscar_questoes` projeta sem
  ela). RPCs: `qi_buscar_questoes(mode)` (ordena `difficulty_order ASC, id
  ASC`), `qi_criar_tentativa` (32, ordenada), `qi_obter_tentativa_ativa`
  (F5/retomada), `qi_salvar_respostas` (sessão), `qi_finalizar_simulacao`
  (SCORE NO SERVIDOR: cruza respostas × gabarito do banco, idempotente,
  `expired`/`submit`), `qi_listar_tentativas(n)`. **PRODUÇÃO: aplicar no SQL
  Editor**; sem ela a UI degrada com segurança (fallback local determinístico
  com aviso de não-persistência).
- **PROGRESSÃO DE DIFICULDADE NÃO EMBARALHÁVEL**: `difficulty_order` 1..6
  (1=1..6, 2=7..12, 3=13..18, 4=19..24, 5=25..28, 6=29..32). O motor ordena
  SEMPRE `difficulty_order ASC` — a questão 1 é a mais fácil e a 32 a mais
  difícil. O sistema pode randomizar só as ALTERNATIVAS, por tentativa.
- **EMBARALHAMENTO determinístico (NÃO usar Math.random)**: `embaralhar.ts`
  (FNV-1a + mulberry32 + Fisher-Yates) deriva a permutação do
  `attempt_id`. A mesma tentativa (F5) re-deriva a MESMA ordem; tentativas
  diferentes variam. A resposta é armazenada pelo **id estável da opção**
  (`op-{idx}-{questionId}`), então o scoring (local E servidor) compara ids,
  não posições. `OptionsGrid` renderiza `button[data-qi-option=A..F]` +
  `data-qi-id` (usado pelos testes E2E).
- **Persistência/F5 (local)**: `sessionStorage` `qi:simulacao:ativo:v1`
  (`{attemptId, questions, startedAt}`), `qi:simulacao:resp:v1`,
  `qi:simulacao:start:v1` POR ABA; relógio por `started_at` (nunca reinicia);
  F5 restaura questão/respostas/relógio e NÃO cria nova tentativa. No
  servidor, `qi_obter_tentativa_ativa` retoma a `in_progress` do user.
  `qi:simulacao:expired:start` só é criado quando o servidor real acusa
  tempo/expirada.
- **Perfil dos jogos**: `ProfileSetup.tsx` → `PainelQi` ("QI / Inteligência"):
  última simulação (acertos X/32, %, tempo, estimativa, data DD/MM/AAAA) +
  HISTÓRICO por `attempt_id` (nunca apaga resultados), lido por RPC
  `qi_listar_tentativas`. `calculateEstimatedResult` (scoring.ts) é a ÚNICA
  função de conversão (fórmula `100 + (acertos − 16) × 2` → 0=68 … 32=132,
  MESMA no servidor SQL) — nunca apresentar como "QI oficial".
- **CampusHub/brio**: duas entradas visuais distintas (Exercícios de QI →
  modal `IQTestComponent`; Simulação de Teste de QI → link `/simulacao-qi`).
  Rotas: `/teste-qi` (exercícios, existente) e `/simulacao-qi` (SSR, `brio.tsx`
  adiciona o card com ícone gauge).
- **Testes**: `testes/e2e-simulacao-qi.mjs` (27 checks SHUFFLE-AWARE: clica
  por `data-qi-option` e mapeia label→id; assert de acertos condicionado ao
  gabarito real da tentativa — clicar "A" não é deterministicamente correto),
  `testes/qi-embaralhar.test.mts` (10: hash estável, ids preservados, F5
  mesma ordem, correta varia de posição, bancos DISJUNTOS 32+24, modes
  corretos), `testes/gerador-qi-seed.mts` (gera 56 questões do seed).
  E2E roda contra `testes/serve-build.mjs` (porta 3417) — SEMPRE matar
  servidores velhos antes (servem HTML com hashes velhos → loading 0%).
- **Validado em postgres local docker**: migration aplica limpa; anon/JWT
  fora negado; `qi_criar_tentativa` 32 ordenadas; `qi_finalizar_simulacao`
  com 32 respostas corretas → raw_score 32, 100%, estimativa 132, tempo
  limitado a 1500s, idempotente; `qi_listar_tentativas` isola usuários;
  finalizar tentativa de OUTRA conta → "tentativa não encontrada ou de outro
  usuário".

## Futebol sem login (portão na Cidadela) + Trilha sem auto-captura (2026-08-28, 31ª passada)

- **LOGIN SAIDO DO FUTEBOL (†)**: o Futebol roda 100% sem conta — "Meu Time"
  (nome, sigla, cores, tática, nomes dos botões) vira estado local do
  navegador (`carregarTimeLocal`/`salvarTimeLocal`/`limparTimeLocal` em
  `online/auth.ts`, chave `qgfrases_time_local_v1`). ProfileSetup virou o
  módulo "Meu Time": quebrados todos os campos/UI de login/cadastro/logout/
  exclusão (`submitAuth`, `excluirConta`, `deslogar`, Modo login/cadastro).
  BotaoGame não tem mais `handleLogout` nem auto-login; conta sem cadastro
  mostra só toast e o jogo segue local.
- **Cidadela é o PORTÃO de conta**: `src/routes/cidadela.tsx` renderiza
  `AuthScreen` no hub quando `!perfil && !continuarComoVisitante && !convites
  && !activeGame` (botão "Continuar como visitante (jogar sem login)").
  `handleLoginCidadela(p?)` aplica o perfil ou marca visitante. O estado
  `mostrarLoginCidadela` foi REMOVIDO (morto). `useBotaoAuth` já expõe
  `aplicarPerfil`. Auto-login continua no hook (sessão detectada → entra).
  Cards de Amistoso/Campeonato Online mostram "Entre na Cidadela".
- **E2E: login virou `loginPelaCidadela`** (`testes/e2e-lib.mjs`): aceita
  cookies → espera "Entrar|Criar conta" → preenche email/senha → "Entrar" →
  espera "Estádio do Campus" → clica "Futebol". IMPORTANTE: o botão "Não
  tenho conta" aparece SEMPRE no AuthScreen em modo login (alterna pro
  CADASTRO) — o helper NÃO pode clicar nele para contas existentes; novos
  cadastros usam "Criar conta" (e2e-carreira tem fluxo próprio).
  Guarda em persistencia-unica agora exige `continuarComoVisitante` (não
  mais o `mostrarLoginCidadela` morto).
- **TRILHA — REGRAS FINAIS (NÃO mexer)**: captura só de peça INIMIGA (o
  moinho da própria peça nunca é alvo: `removableTargets(board, opponent)` +
  SQL `_trilha_remove_valido` + RPC `registrar_jogada_trilha` rejeitam via
  `IS DISTINCT FROM v_vitima`); **fim de jogo com 2 peças** do adversário
  (aniquilação `v_count_foe <= 2`) e **voo com 3 peças** (`<= 3` em
  `_trilha_tem_movimento`). commit `a1142ee` (fim em 2, voo em 3) é o estado
  certo apesar do texto da mensagem do usuário mencionar "3 peças" — o
  voo com 3 exige que o fim NÃO seja em 3.
- **Auto-captura travada em todas as camadas**: engine puro
  (`removableTargets` só inimigo), `TrilhaBoard` (renderiza só alvos inimigos),
  hook local (`captureTargets` inimigo) e SQL/RPC
  (`_trilha_remove_valido` rejeita peça própria). **Defesa nova** em
  `useLocalGame.commit` na captura pendente: revalida o alvo com
  `removableTargets(boardComPosta, opponent(cur.turn))` antes de `applyCapture`
  — chamada programática de `commit` com remoção da própria peça é descartada.
- **BUILD FIX raiz (Vercel)**: `149f975` (revert do Devin) gravou os arquivos
  da Trilha como UTF-16LE → rolldown "stream did not contain valid UTF-8".
  O re-fix `a1142ee` restaurou UTF-8 puro + regras; deployments de produção
  de `a1142ee` e `98d46c5` = SUCCESS (o único failure é o `149f975` do histórico).
- **Verificação**: tsc 0; build OK; estruturais: persistencia-unica 122,
  conta-sem-perfil 33, f5-partida 27, fluxo-usuario-novo 14, onclick-guard OK,
  sov-consistencia 6, sessao-antiga 11, celular-anuncios 12,
  gol-semantico-guarda 13, sov-invest 46; jiti: trilha 19, clube-financas 17,
  evolucao-botoes 34, gol-semantico 14, historia 53, onboarding OK,
  promocao-rebaixamento 136, transferencias 17, marketplace OK.
  ⚠️ Vercel tem Deployment Protection ativo (login) nos domínios — o deploy
  builda e completa (status success), mas a URL pede login.

## Campeonato Online provado (E2E) + código morto removido (2026-08-27, 30ª passada)

- **CAMPEONATO ONLINE FUNCIONAL (prova REST real, produção)**: novo
  `testes/e2e-campeonato-bots.mjs` agora 0 falhas ponta a ponta: regra dos
  50 SOV bloqueia conta endividada (criar/entrar), conta nova (bônus 50)
  cria a sala, convidado entra pelo LINK DIRETO, dono preenche com bots
  (32/32, bots usam `time_id` real da base TEAMS do código, NUNCA duplicam
  humano), convidado NÃO preenche (regra do dono), inicia o campeonato,
  31 rodadas × 16 confrontos = **496 pessoas no formato ACHATADO
  (confrontos[] com `rodada` por elemento — não aninhado por rodada)**,
  rodadas 1..31 cobrem o round-robin, dono resolve confronto bot×bot
  (`resolver_confronto_bots`), REJEITA confronto com humano, classificação
  atualiza pontos. **Não reintroduzir** crença de que `confrontos` é um
  array de 31 rodadas; é um array ACHATADO de 496 jogos com `status`.
- **`entrar_campeonato_online` só abre sala `aguardando`** — depois de
  iniciar, a fonte verdade dos confrontos é a própria tabela (`rest`), não
  a RPC. No E2E e no código, depois de `iniciar` leia `confrontos` da
  tabela (`botao_campeonatos_online`), não da RPC de entrar.
- **CÓDIGO MORTO REMOVIDO (12 arquivos)**: `Campo.tsx`, `GradeTimes.tsx`,
  `OnlineMatch.tsx` (V1), `OnlineMatchV2.tsx`, `src/engine/demoMatch.ts`,
  `src/hooks/useBotaoOnline.ts`, `src/lib/botao.functions.ts`,
  `src/lib/financial/antiCheat.ts`, `bettingSystem.ts`, `careerManager.ts`,
  `recoverySystem.ts`. Módulos vivos definitivos do online: `OnlineMatchV3`
  (Amistoso Online/Mesa), `OnlineChampionship` (Campeonato Online),
  `MesaOnlineMatch`+`AdminMesaPanel`, `TrilhaGame` (`useTrilhaChampionship`).
  Dois engines distintos seguem intocados: `src/engine` (3D, Match3DView/
  MatchEngine) e `src/components/botao/engine` (2D MatchView).
- **`src/engine/MatchEngine.ts`**: `PlayerState` ganhou o estado `"dribble"`
  (era provável cause de erro TS pré-existente); `formations.ts` (tracked no
  git, intacto) é importado via `formationSlots` pelo engine 3D.
- **Guards atualizados** (eram invariantes pré-existentes, não regressão):
  `persistencia-unica` (sem referência a `OnlineMatch.tsx` no `semSoberaniaUI`)
  e `conta-sem-perfil` (o `storage.ts` usa
  `cacheSoberaniaInteiro(saldoSov) : (currentData.pontos_soberania || 0)` — o
  guard antigo procurava string `saldoSov ?? ...` que nunca existiu em HEAD).
- **README-conta E2E**: `openhands.rookie.e2e@gmail.com` (Rookie FC) tem
  saldo SOV 0 (conta do README ficou endividada nas auditorias longas) — ele
  NÃO pode criar campeonato na regra dos 50 SOV. Os E2Es de campeonato criam
  conta NOVA elas mesmas (bônus 50 → elegível). Para E2Es de CARREIRA que
  precisam de campanha ativa (`entrar-em-campo`), a conta precisa ter uma
  carreira — o estado dela é volátil (o `e2e-2d-classificacao.mjs` falha se
  a conta está sem carreira, não por regressão de código).
- **Verificação**: tsc 0; build OK; estruturais (persistencia-unica 120,
  sov-consistencia 6, onclick OK, conta-sem-perfil 33, fluxo-usuario-novo 14,
  celular-anuncios 12, gol-semantico-guarda 13, sessao-antiga 11 — .mts via
  node); engines jiti 18 suites verdes (conversas 41, entregas 9, f5 19,
  ia 52, temporada 57, torcida 42+14, regras-fim 36, bolsa 29, história 53,
  onboarding, marketplace, promo-rebaix 136, clube-fin 17, evolucao 34,
  transferencias 17, sov-invest 46, gol-sem 14).

## 3D grava como o 2D (prova E2E) + SUBORNO REMOVIDO do jogo (2026-08-24, 29ª passada)

- **3D conta na tabela e nos saldos EXATAMENTE como o 2D**: os dois modos
  chamam o mesmo `finishTournamentMatch` (Match3D converte o placar do
  engine em MatchResult). Novo `testes/e2e-3d-classificacao.mjs` (16/16)
  prova com placar real 2×0 injetado no engine (detecção real de gol:
  |x|>halfLength): rodada 17→18, J 17→18, pontos 14→17, receita 36 no
  caixa, Δcarteira == Δsnapshot, invariante 5088 == 109 + 4979, F5 preserva.
  2D (`e2e-2d-classificacao.mjs`, 21/21) idem. O 2D E2E agora tolera a
  detecção de fim (CONTINUAR + 150 iterações — o último flick terminava a
  partida na iteração final e o loop lia a tela já em transição).
- **SUBORNO REMOVIDO cirurgicamente, RPG intacto**: apagados
  `career/subornoEngine.ts` e `career/SubornoStory.tsx`; removidos do
  BotaoGame (import, `aplicarSuborno`, branch do prioridadeCelular, gatilho
  do preparaEscolha, contexto `subornoAtivo` das manchetes), o campo
  `CareerState.suborno`, o choice event `subornador-abordagem` (+ remetente
  "Subornador") do choicesEngine, o pool T_SUBORNO do newsGenerator, a
  categoria "suborno" do templateEngine/NewsPortal e menções nos prompts/
  comentários. A prioridade do celular fica narrativa > choice (o RPG
  inteiro — narrativa dinâmica, choice events, patrocinador, Valéria,
  história John Adrian — segue intocado). Carreiras antigas com
  `suborno` no JSONB simplesmente ignoram o campo morto.
- **Guardas novas (persistencia-unica 120/120)**: arquivos apagados não
  voltam, BotaoGame/careerRemote/types/choices/news sem nenhuma referência
  a suborno. `celular-anuncios` usa NarrativeModal.onBack no lugar do
  SubornoStory.onFechar; testes SSR (test-ssr-flow/test-ssr-futebol)
  atualizados (narrativa no lugar do suborno).
- **Stubs legados corrigidos** (falhas pré-existentes no HEAD, não eram
  regressão): test-f5 e test-bolsa-persistencia criavam career sem
  `clubeCaixa` → a migração CLUBE×TREINADOR do normalizarCareer zerava o
  coach.sov. Stubs agora na forma moderna (f5 19/19, bolsa 29/29).
- **Verificação**: tsc 0; build OK; E2E 2D 21/21, E2E 3D→classificação
  16/16, E2E 3D headless 20/20; guardas 120/114+6; jiti: conversas 41,
  entregas 9, temporada 57, ia 52, torcida 42+14, f5 19, bolsa 29,
  regras-fim 36, clube-financas 17, promocao 136, evolucao 34,
  transferencias 17, marketplace OK, historia 53; sov-consistencia 6,
  fluxo-usuario-novo 14, onclick-guard OK. (test-ssr-flow/test-ssr-futebol
  têm 1 falha pré-existente no HEAD — `timeDesconhecido` no bundle SSR —
  sem relação com estas mudanças.)

## Coerência de saldo clube×pessoal + vitrine pública de clubes (2026-08-24, 28ª passada)

E2E do modo técnico 2D (partida conta, rodada avança, tabela atualiza — prova
REST: rodada 9→10, J 9→10, UI da classificação confere) + auditoria de saldo
em todos os módulos. Causas-raiz encontradas e corrigidas:

- **CACHE DO LEADERBOARD DERRUBADO A CADA SAVE (o "saldo do clube caindo como
  pessoal")**: `saveCareerToSupabase` gravava `pontos_soberania = coach.sov`
  (só o pessoal). A carteira é o TOTAL (pessoal + caixa): o cache caía de
  5147 → 288 a cada persistCareer e os módulos que leem o cache exibiam o
  dinheiro do clube como pessoal. Fix: cache = `coach.sov + clubeCaixa`.
- **DRIFT ledger × snapshot na partida de liga**: o snapshot somava a receita
  REAL (`receitaDa` × mult da divisão: 36/12/0 na série A) no clubeCaixa mas
  o ledger gravava o delta cru (3/1/0) — a carteira ficava 12× atrás a cada
  vitória. Fix: `aplicarResultadoRemoto(..., valorDelta)` e
  `aplicarFimCampanhaRemoto(..., valorBonus)` recebem os valores EXATOS que
  o snapshot aplicou (receitaPartida / premiacaoTemporada, separados no
  finishTournamentMatch — cada um com escritor/chave próprios).
- **Desafio de patrocinador no AMISTOSO**: ledger creditava e o snapshot não
  somava no caixa (drift inverso). Fix: cai no clubeCaixa com extrato.
- **Displays**: SovBankApp "Perfil Pessoal" = `saldo − clube.caixa` (a
  carteira é o TOTAL — mostrar o total como pessoal contava o clube 2×);
  hero rotulado "Saldo total (pessoal + caixa)"; EconomiaScreen discrimina
  "Pessoal: X · Caixa do clube: Y" no card SOV Bank.
- **Invariante provada por E2E**: `pontos_soberania(cache) == coach.sov +
  clubeCaixa` antes E depois da partida (5155 == 313 + 4842; Δcarteira 8 ==
  Δsnapshot 8 — salário r10 net-zero caixa→pessoal, patrocínio +8 no caixa).
- **futebol.sql (bug pré-existente de deploy limpo)**: GRANT de
  `criar_mesa_futebol(TEXT)` mas a função tem 3 parâmetros — o arquivo
  quebrava na linha do GRANT e TUDO depois (bloco de dono de clube!)
  não aplicava em banco fresco. Corrigido para a assinatura completa.
- **VITRINE PÚBLICA DE CLUBES (nova)**: migration `clubes_venda.sql`
  (ordem 13) — `botao_times.em_venda/preco_venda` + RPCs
  `cidadela_anunciar_venda_clube` (só o dono; preço NULL retira),
  `cidadela_listar_clubes_a_venda` (todo autenticado vê) e
  `cidadela_comprar_clube_anunciado` (ATÔMICA: lock FOR UPDATE, débito do
  comprador + crédito do vendedor no ledger, posse transferida, vitrine
  limpa e a participação do vendedor REMOVIDA do JSONB dele — sem isso o
  vendedor seguia recebendo dividendos de clube vendido). UI: PropriedadeScreen
  ("Anunciar venda" no clube 100% + seção "Clubes à venda" com compra em 1
  clique + reconciliação perdeu-clube pelo mapa) e SovMarket do celular
  (seção "Clubes à venda"). Validada em pg local docker: 19/19 (cadeia real
  de migrations + ciclo anunciar→listar→comprar→revender, bordas de dono,
  saldo insuficiente, idempotência).
- **PRODUÇÃO: aplicar `supabase/migrations/clubes_venda.sql` no SQL Editor**
  — sem ela a vitrine não existe no servidor (E2E `testes/e2e-vitrine-clube.mjs`
  detecta e instrui). Após aplicar, rodar o E2E: ele anuncia o Jacu do Norte
  (clube da conta de exposição) por 250 SOV e prova a visibilidade no
  Mercado de Clubes e no celular.
- **Harness E2E 3D estabilizado**: carga/chute agora observam a CONDIÇÃO de
  sucesso frame a frame com até 4 tentativas (a IA da partida podia marcar
  gol no meio da janela fixa de 600ms e zerar o estado — flake, não bug).
- **Verificação**: tsc 0; build OK; E2E 2D→classificação 21/21 (3 asserções
  novas de coerência); E2E 3D 20/20 ×3 runs; compra de clube 6/6; guardas
  114/114 (+10 novas: cache total, valorDelta/valorBonus, vitrine, displays);
  jiti (clube-financas 17, promocao 136, evolucao 34, transferencias 17,
  marketplace) OK.

## E2E temporadas: economia parava na 2ª temporada + React #418 + compra de clube (2026-08-24, 27ª passada)

E2E longo do campeonato offline (uma conta, T18→T23) + auditoria financeira
rigorosa. Três bugs reais encontrados jogando e corrigidos na causa:

- **ECONOMIA PARAVA NA 2ª TEMPORADA (o "campeonato offline quebra")**: ids de
  fixture são `liga-r{rodada}-{idx}` (seasonEngine) — IDÊNTICOS toda temporada.
  A chave idempotente do ledger era `partida:{uid}:{fixture}` → a receita da
  partida era registrada UMA vez na vida; da 2ª temporada em diante o ledger
  devolvia `duplicated` e a carteira parava de crescer enquanto o snapshot
  subia (drift UI × banco). Fix: chave com escopo de temporada
  (`t{temporada}:{fixture}`) no fluxo real (`aplicarResultadoRemoto`) e no
  harness E2E. Guarda estrutural no persistencia-unica. Padrão proibido:
  chave idempotente de dinheiro sem a temporada quando o id base se repete
  por temporada.
- **React #418 (hydration mismatch de texto, 12 passadas pendente)**:
  LoadingScreen e TrilhaLoadingScreen sorteavam o texto com `Math.random` no
  initializer do useState → SSR e cliente escolhiam textos diferentes. Fix:
  `conteudoDeterministico` (loadingContent.ts) no primeiro render; a seleção
  aleatória acontece em useEffect pós-montagem. Reproduzir #418: só no build
  SSR de produção E logado E reload dentro do futebol (a TrilhaLoadingScreen
  só monta nesse caminho); dev mode com login mostra o texto exato do
  mismatch no stack.
- **Compra/venda de cota de clube**: débito/crédito confirmado pelo ledger
  ANTES de persistir o snapshot; falha/saldo insuficiente aborta com toast
  ("Compra não concluída — saldo insuficiente."). `normalizarCareer` não
  herda mais coach.sov antigo para clubeCaixa (migração inflava o total).
- **Invariante econômica provada**: `user_wallets.balance == coach.sov +
  clubeCaixa` ao fim de CADA sessão (verificado via REST após 5 temporadas:
  2768.40 == 2768.4). Manutenção 1x/temporada (chave `manutencao:{uid}:t{n}`),
  salário par interno (líquido zero), premiação 100% no caixa do clube.
- **Conta E2E oficial desta auditoria**: openhands.rookie.e2e@gmail.com
  (senha via env E2E_PASSWORD, nunca no repo). UMA conta só — continuar
  nela, nunca criar outra.
- **Harness**: `__e2e.aguardarFila()` (drena fila de escrita + ledger
  pendentes) — chamar ANTES de F5/fechar o browser nos E2Es, senão as
  escritas do ledger morrem com o processo e viram drift falso.
- **Verificação**: E2E temporadas 0 falhas (5 temporadas, transições,
  promoção/rebaixamento, SeasonEndScreen, sem textos que entregam regras);
  E2E compra de clube 0 falhas; guardas 99/99; jiti (clube-financas,
  promocao-rebaixamento, evolucao-botoes, transferencias, marketplace,
  onboarding, sessao-antiga, historia) OK; tsc 0; build OK.

## Campeonato Online v2: link direto, bots, 50 SOV, aposta real (2026-08-23, 26ª passada)

Auditoria E2E do Campeonato Online/Amistoso + sincronização de dados.
Causas-raiz encontradas (NÃO reintroduzir):

- **OFF-BY-ONE jsonb (o bug que quebrava a mesa do campeonato)**: arrays
  jsonb são 0-based e `WITH ORDINALITY` é 1-based. As RPCs antigas
  (`vincular_mesa_campeonato`, `abrir_mesa_campeonato`) liam/gravavam o
  elemento ERRADO de `confrontos` — a mesa era vinculada ao confronto
  seguinte (ou nenhum). Correção em `campeonato_online_v2.sql`: `ord - 1` +
  `ARRAY[idx]::TEXT[]`. Padrão proibido: `jsonb_set(arr, ARRAY[int]...)`.
- **record_transaction antiga em produção**: crédito em conta negativa era
  REJEITADO (conta endividada não recebia prêmio/receita/bônus — probe real:
  `sov_bank_registrar(+1)` → "Saldo insuficiente"). A correção está DENTRO da
  `campeonato_online_v2.sql` (reaplicar o arquivo resolve).
- **Bye travava rodada**: confrontos `bye` nasciam `pendente` e o avanço de
  rodada exigia tudo `finalizado` → campeonato ímpar nunca avançava. Agora
  bye nasce `finalizado`.
- **Aposta de mesa era ficção**: `aposta_sov` era gravada mas nunca cobrada.
  Agora `criar_mesa_futebol`/`entrar_mesa_futebol` debitam via
  `sov_bank_registrar` (chave `aposta:{mesa}:{uid}`) e `pagar_premio_mesa`
  paga o pote zero-sum ao vencedor (idempotente `premio:{mesa}`; empate
  devolve). `aposta_cobrada_de` (UUID[]) marca quem pagou.
- **Campeonato v2**: salas 2..32 (CHECK + RPC), regra 50 SOV em
  criar/entrar (frontend valida via `obterSaldoSov`, RPC é a autoridade),
  `preencher_campeonato_bots`/`resolver_confronto_bots` (SÓ o dono; bots =
  clubes existentes da base TEAMS, `bot:true`, uuid gerado, nunca criam
  usuário), campeão bot → `vencedor_id NULL` (não quebra a FK).
- **Link direto**: `?camp=CODIGO` e `?mesa=id` em /cidadela — autenticado cai
  DIRETO na sala/mesa (BotaoGame `campCodigoInicial`/`mesaConviteInicial`;
  a tela inicial já é o fluxo e a hidratação/resume NÃO sobrescrevem);
  convidado novo → ConviteMesaScreen (modo mesa|campeonato) com profissão em
  1 pergunta (`escolherProfissao` após o cadastro) → entra direto.
- **Botões/UX**: "Preencher com Bots" e "Iniciar campeonato" só renderizam
  para `criador_id === userId`. Confronto humano×bot usa MatchView local +
  mesa de registro (criar/vincular/registrar); bot×bot é simulado
  deterministicamente pelo dono (`simularConfrontoBots`, hash FNV da chave).
- **Troféu de campeonato online**: ao finalizar, campeão humano ganha trophy
  `camp-online-{codigo}` em progress.trophies (dedupe por teamId).
- **Verificação**: tsc 0; 87 guardas estruturais; pg local docker: campeonato
  inteiro com bots ponta a ponta (4 jogadores, 3 rodadas, campeão humano,
  stats no perfil), aposta debitada/paga/idempotente, regra 50 SOV nas 3
  bordas; E2E navegador do link (3 cenários) 0 falhas.
  **PRODUÇÃO: aplicar `campeonato_online_v2.sql` no SQL Editor** (ordem 12 no
  migrations/README) — sem ela: salas 9+, bots e 50 SOV não valem no servidor.

## Auditoria E2E do ecossistema: Banco (Pessoal×Clube), Transferências, Mesas (2026-08-23, 25ª passada)

Auditoria ponta a ponta do celular, finanças, clubes, online e mesas, com
correções e E2E real de cada fluxo.

- **§3-§5 Banco no celular**: `SovBankApp` ganhou prop `clube` (Perfil Pessoal
  × **Perfil do Clube** — caixa/extrato próprios, card dedicado). Os extratos
  (pessoal e do clube) agora são **recolhíveis** (`extratoAberto` /
  `extratoClubeAberto`) — nunca abrem uma lista enorme por padrão. Fio:
  BotaoGame → CelularFixo → CelularConversas → SovBankApp.
- **§6 Ofertas de transferência**: `career/transferenciaEngine.ts` (PURO,
  jiti) — gatilho por DATA (meio da temporada r10 / fim r19), determinístico
  por temporada+seed. Prestígio (posição invertida + moral) decide se um
  clube da divisão de CIMA oferta no fim. A oferta chega como conversa no
  celular + card na área **Transferências** (CareerHub, badge de pendentes).
  Aceitar paga bônus de assinatura ao treinador (ledger idempotente; RPC
  antiga em produção não bloqueia o aceite) e marca `proximoClubeId` — o
  `startNextSeason` troca o clube (vaga do clube-assinado) e zera o caixa
  (a receita passa a ir para o novo clube). Persistido em
  `career.ofertasTransferencia` (saneado no normalizarCareer). E2E provado:
  oferta → aceitar → nova temporada na divisão do novo clube, F5 preserva.
- **§9-§11 Mesas online**: `mesas_futebol.data_liberacao` (+ `aposta_sov`,
  `aposta_cobrada_de`) — a mesa bloqueada até a data não abre para
  convidados (guarda na RPC `entrar_mesa_futebol`) e abre sozinha depois.
  `criar_mesa_futebol(time, data_liberacao, aposta_sov)` (retrocompatível).
  `linkConviteMesa(mesaId)` = link direto `/cidadela?mesa=...`. **Painel de
  Administração da Mesa** (`AdminMesaPanel`): criador vê participantes,
  status, aposta/arrecadado/premiação (zero-sum), data de liberação, link.
  **Fluxo do convidado** (`ConviteMesaScreen`): abre pelo link, vê 3
  propostas de clube, escolhe, cadastro rápido (nome + e-mail) e entra —
  NUNCA cai num cadastro genérico. Mesa bloqueada/cheia/inexistente tratadas.
  **PRODUÇÃO: re-aplicar `futebol.sql` (bloco final mesas) no SQL Editor.**
- **BUG hidratação sobrescrevendo remoto**: o save de reparo na hidratação
  (`saveCareerToSupabase`) regravava o snapshot inteiro — substituído por
  `mutateProgressInSupabase` (merge na fila; campos mais novos do remoto
  vencem). Era o que apagava ofertas recém-criadas entre o load e o save.
- **Verificação**: tsc 0 erros; build OK; persistencia-unica 67 (+10 guardas
  novas: banco pessoal×clube, extrato recolhível, transferências, mesas,
  convite); transferencias 17 (novo); demais suítes intactas. E2E real:
  celular/banco (7 checks), convite (3 clubes + cadastro rápido),
  transferência (oferta → aceitar → divisão nova, F5).

## Separação CLUBE×TREINADOR + promoção real + economia equilibrada + E2E magnata (2026-08-23, 24ª passada)

Jornada E2E longa da conta oficial (T15→T33+): promoções, rebaixamentos,
salários, manutenções e a economia toda sob observação. Bugs REAIS achados
jogando e corrigidos na hora:

- **§10-§14: CLUBE ≠ TREINADOR** (`career/clubeFinancas.ts`, PURO/jiti):
  `career.clubeCaixa` (receita esportiva: pontos da partida na escala da
  divisão, premiação por posição, patrocínio) + `clubeExtrato` (cap 60).
  O treinador enriquece SÓ pelo salário (a cada 10 rodadas, por divisão:
  C=10/B=15/A=25) e atividades pessoais. Manutenção sai do caixa do clube.
  Salário = transferência interna (wallet não muda de total): par de
  lançamentos no ledger (`salario:{uid}:t{t}:r{r}:saida/:entrada`), líquido
  zero — rastreável sem criar SOV. Migração: carreiras antigas sem
  `clubeCaixa` recebem o coach.sov acumulado como caixa inicial (a receita
  esportiva delas já era, na prática, do clube). `SovereigntyPanel` mostra
  "Seu SOV" × "Caixa do clube"; `SeasonEndScreen` rotula "Caixa do clube".
- **BUG PRODUÇÃO — crédito bloqueado em conta negativa**: `record_transaction`
  (sov_financial_system.sql) rejeitava QUALQUER transação que deixasse o
  saldo negativo, INCLUSIVE CRÉDITO — conta endividada não recebia receita/
  prêmio/salário e afundava para sempre (o E2E mostrou o ledger travado em
  -3292 com só manutenções gravadas). Fix: bloqueio só para DÉBITO
  (`p_amount < 0 AND v_new_balance < 0`). **PRODUÇÃO: re-aplicar
  `sov_financial_system.sql` no SQL Editor** (ver migrations/README).
- **BUG — promoção/rebaixamento não aplicada**: `startNextSeason` recriava as
  ligas com `career.divisao`/`composicoes` ANTIGAS (o jogador "subia" sem
  subir). Agora deriva `processarResultadoTemporada(ligas concluídas)` e cria
  as ligas da divisão NOVA. `finishTournamentMatch` não toca mais em
  divisao/composicoes (fonte única no avanço). Nomes desincronizados:
  `teamByIdSync` caía em `TEAMS[0]` (Rubro-Negro) para id fora da divisão —
  agora `timeDesconhecido(id)` (nunca mais "Flamengo" fantasma).
- **BUG — temporada sem veredito / veredito fantasma**: (a) liga completa
  clonada ficava com `phase="grupos"` para sempre (a temporada nunca fechava)
  → ligaFinal agora fecha phase+campeão quando completa, robusto a clone;
  (b) hidratação com ligas em andamento limpava NADA — o veredito da sessão
  anterior reabria na 1ª partida da temporada nova → hidratação zera o
  veredito quando as ligas não estão concluídas; (c) refs frescas
  (`careerRef/tourRef/vereditoRef` + `setVereditoRef`) sincronizadas em TODOS
  os caminhos (sim, startNextSeason, gameOverReset, hidratação) — chamadas
  rápidas não leem estado velho.
- **Economia equilibrada** (medida pelo E2E com campanha real): receita da
  partida por divisão (`RECEITA_MULT_POR_DIVISAO` C=5/B=8/A=12 × pontos) —
  time que vence lucra, time na média paga as contas, time em crise afunda
  (antes: Série A com 13V/19 ainda quebrava). Premiação por posição
  `premiacaoDa` (campeão/vice/top4/resto na escala da divisão).
  `COACH_LEVELS` por patrimônio pessoal (0/60/150/300/600/1200/2500, novo
  nível "Magnata") — sem isso o treinador nunca passava de "Promessa".
- **Harness E2E** (`?e2e=1`, `window.__e2e`): simula UMA rodada em estado
  LOCAL com as engines reais (applyResult, simularRodadaDivisoes, torcida,
  clubeFinancas, ledger idempotente por fixture) — a rajada não depende de
  re-render (a primeira versão chamava finishTournamentMatch e travava em
  closures velhas: 60 chamadas = 0 rodadas). Só existe com o parâmetro.
- **README**: conta E2E oficial documentada (e-mail + senha de teste) —
  decisão do dono: qualquer agente entra e CONTINUA, nunca cria outra conta.
- **Verificação**: tsc 0 erros; build OK; clube-financas 17 (novo);
  promocao-rebaixamento 136 (novo); evolucao-botoes 34; persistencia-unica 57;
  sov-consistencia 6; regras-fim 36; conversas 41; temporada 57; bolsa 29.
  E2E magnata 4 temporadas seguidas (0 falhas, promoção C→B→A e rebaixamento
  A→B naturais, salário r10 no extrato, ledger íntegro após o fix).

## Carreira com ofertas de clubes + evolução de botões + identidade do OpenHands (2026-08-23, 23ª passada)

Transformação da entrada da carreira e do módulo Meu Clube/Conta (prompt do
dono §1-§15). Tudo sobre as correções da 22ª passada (mantidas intactas).

- **ENTRADA DA CARREIRA = OFERTAS DE CLUBES PEQUENOS (§4)**: `career/
  ofertasIniciais.ts` (PURO, jiti) — `gerarOfertasIniciais(clubes, seed,
  torcida, manutencao)`: 3 ofertas determinísticas por usuário (hash FNV-1a;
  F5 não muda) dos clubes MAIS FRACOS da divisão inicial. Cada oferta mostra
  escudo, nome, porte, força, torcida, bônus de assinatura (5-20 SOV — clube
  pequeno, orçamento pequeno), estrutura ★ e discurso da diretoria. O clube
  aceito define a VAGA que o time do jogador assume na liga:
  `seasonEngine.composicoesIniciais(userTeam, divisao, clubeSubstituidoId)`
  remove o clube que "contratou" e insere o time do jogador. Bônus de
  assinatura vai ao ledger com chave `assinatura:{uid}:t1:{clubeId}`.
  `career.clubeOrigemId` persiste a escolha. CoachSetup mantém 3 etapas
  (ofertas → identidade → estilo) — a CareerIntro ("Entrar como Técnico")
  continua existindo entre o CareerMenu e o CoachSetup.
- **FORÇA DOS CLUBES (§5-§6)**: `career/forcaClube.ts` (PURO) — `porteDoClube`
  calibrado na distribuição REAL da base (C 51-65 = pequeno, B 58-70 = médio,
  A 70-88 = grande; o AGENTS dizia C 28-48 — desatualizado),
  `estruturaDoClube` 1-5, `forcaRealClube` = power + `bonusTorcida` (mesma
  curva da simulação — torcidaEngine) + ajuste de estrutura. A torcida de 1M
  (zero-sum) já existia e segue igual.
- **EVOLUÇÃO DE BOTÕES substitui "nomear botões" (§7-§10)**: `career/
  evolucaoBotoes.ts` (PURO) — 5 botões de linha, UMA habilidade cada, nível
  0..5, custos [20, 50, 120, 280, 650] (estritamente progressivos). Impacto
  real: `multTiro` (+5%/nível no impulso do chute) e `massaExtra` (botão mais
  pesado) aplicados no MatchView; `bonusForcaTime` (média 0..+5) soma no
  power do time. `estrelasNivel` = ★/☆. Persistido em `career.botoesNiveis`
  (JSONB, saneado no normalizarCareer). Compra é gasto VOLUNTÁRIO: exige
  saldo (dívida só existe pela manutenção), ledger-first com chave
  `botao:{uid}:{idx}:n{nivel}` — falhou o débito, nada evolui.
- **ESCUDO DENTRO DO BOTÃO (§11)**: `career.identidadeBotao {simbolo, cor}` —
  o jogador escolhe um símbolo dos escudos dos 60 clubes + uma das 3 cores do
  perfil; o MatchView desenha o símbolo dentro dos botões do usuário (o nome
  do jogador some quando o escudo está ativo) e usa a cor de acento.
- **ProfileSetup**: `PersonalizacaoBotoes` (nomear botões) REMOVIDO —
  `PersonalizacaoTatica` (formação + prévia) + `PainelEvolucaoBotoes`
  (estrelas, barra, "Aumentar — $X", picker de escudo/cor). `excluirConta`
  agora usa `excluirContaUsuario` (RPC de exclusão total — antes fazia DELETE
  direto só no perfil). Cadastro salva `botoes_nomes` padrão da formação
  (constraint do DB segue satisfeita, sem UI).
- **README.md reescrito**: conta oficial do OpenHands documentada
  (`open.rangers.fc.oficial@gmail.com`, Treinador Open × Clube Open FC) +
  regra de credencial: senha via variável `OPENHANDS_E2E_PASSWORD`, NUNCA no
  repo; outras IAs criam as próprias contas; contas duplicadas antigas serão
  apagadas pelo dono. README antigo (gerador de frases) movido para
  `README-FRASES-LEGADO.md`.
- **E2E REAL executado** (`testes/e2e-carreira.mjs`, puppeteer-core +
  chromium headless, viewport celular 390x844, build de produção servido por
  `testes/serve-build.mjs`): conta nova (Rookie × Rookie FC) → portão de
  profissão → 3 ofertas (asa/nor/alt, todas "Clube pequeno") → assinatura →
  hub temporada 1 → painel de evolução → ★☆☆☆☆ → evoluiu botão 1 → ★ e preço
  subiu para $50 → escudo+cor aplicados em campo (cor visível na partida) →
  6 jogadas sem travamento. **Ledger de produção provado**: signup +50,
  assinatura +8 (chave idempotente), evolução −20 (chave idempotente) →
  saldo 38 = hub. Zero duplicação entre runs (idempotência + regra "sem
  saldo não evolui" seguraram cliques repetidos). ATENÇÃO ao re-rodar: mate
  processos serve-build antigos — um servidor velho serve HTML SSR com
  hashes de assets velhos (404 → loading travado em 0%).
- **Bug menor registrado**: emojis de escudo aparecem como "tofu" no chromium
  headless (falta fonte de emoji no sandbox; em celular real renderizam).
- **Verificação**: tsc 0 erros; build OK; evolucao-botoes 34 (novo);
  persistencia-unica 54 (+8 guardas novas); demais suítes intactas
  (regras-fim 36, conversas 41, temporada 57, ia 52, torcida 42+14, f5 19,
  bolsa 29, história 53, sessão 11, entregas 9, onboarding 22,
  marketplace 11, sov-invest 46, conta-sem-perfil 33, fluxo-novo 14,
  celular-anuncios 12, sov-consistencia 6, f5-partida 27, onclick OK).

## Fim de temporada sem bloqueio + chances ocultas + entrada enxuta + exclusão total (2026-08-23, 22ª passada)

Correções pedidas pelo dono após auditoria da jornada do jogador (E2E da conta
Rangers). Nenhuma tabela/SQL novo além de UMA RPC anexada ao `futebol.sql`.

- **FIM DE TEMPORADA NUNCA BLOQUEIA POR DINHEIRO** (`competitionApi.ts`):
  `avaliarFimTemporada` retorna SEMPRE `continua: true`. Não pagou a
  manutenção → a temporada seguinte começa mesmo assim e o saldo fica
  NEGATIVO (dívida real): `iniciarNovaTemporada` devolve `sov - custo` sem
  clamp; o `BotaoGame.startNextSeason` registra o débito no ledger com tipo
  `penalty` e chave idempotente `manutencao:{uid}:t{n}` (F5/clique duplo
  nunca cobra duas vezes; ledger indisponível não bloqueia o avanço).
- **SISTEMA SECRETO DE CHANCES (§5)**: o contador `temporadasInadimplente`
  continua existindo mas virou 100% INTERNO — `SeasonEndScreen` não mostra
  mais "Tentativa de recuperação X de 3", e os avisos `AVISO_DIRETORIA`
  são pura narrativa ("cobrança dura da diretoria", "sob observação
  permanente") sem número de tentativas/restantes. Guarda estrutural no
  `testes/persistencia-unica.test.mjs` proíbe os padrões na UI/narrativa.
- **DÍVIDA É ESTADO VÁLIDO em toda a cadeia**: clamps `Math.max(0, ...)` de
  SOV removidos de `BotaoGame` (aplicarEscolha, copa, liga), `rpgEngine`
  (aplicarEscolhaRpg), `careerStorage.normalizarCareer` (piso defensivo
  -999_999, nunca zera dívida real no F5) e `careerRemote` (cache
  `pontos_soberania` segue clampado em 0 — é só leaderboard — mas o snapshot
  JSONB guarda o valor negativo; no load, `saldoSov ?? coachSalvo.sov ??
  pontos_soberania` — snapshot vence o cache para não apagar dívida).
  BUG PEGO: `finishCopaMatch` computava `novaSov` mas NUNCA aplicava ao
  `coach.sov` local (só ia ao ledger) — agora aplica.
- **ENTRADA DA CARREIRA EM 3 PASSOS** (`CoachSetup.tsx` reescrito): etapa 1 =
  OFERTA DO CLUBE da temporada 1 (contrato, divisão, manutenção, bônus),
  etapa 2 = identidade (nome pré-preenchido do login), etapa 3 = estilo
  tático + "Assinar contrato". Acabaram as 6 telas de enrolação.
- **NAMORADA É CONQUISTADA, NÃO DADA**: Valéria não é mais contato inicial
  ("Oi, amor!" removido de `garantirContatosRpg`; contatos-base = 3: Dona
  Cida, Torcedor, Pracinha). Apresentação via evento-gatilho
  `encontro-valeria` (rodada ≥2, uma vez); oficialização via `jantar-valeria`
  (relação 30-59); "seguidor" só com relação ≥40. `cargoValeria(score)` rotula
  a conversa (Conhecida → Amiga → Namorada em 60+, `LIMIAR_NAMORO`);
  carreiras legadas com rótulo "Namorada" têm o cargo rebaixado ao vínculo
  real na hidratação (mensagens preservadas). Respostas procedurais da Valéria
  reescritas por faixa de vínculo (sem "amor" antes da hora). choicesEngine
  tinha "Júlia" como namorada — nome canônico é Valéria.
- **MENSAGENS POR GATILHO, NÃO POR RODADA**: relatório médico (`Dr. Maurício`)
  só chega quando há o que reportar (goleada ≥3, desfalque, W.O., moral <35);
  reação da torcida vai para a REDE (feed público, `gerarPostManual` na
  carreira FRESCA do `careerRef` — nunca regrava snapshot velho), não para
  conversa privada a cada partida.
- **EXCLUIR CONTA APAGA TUDO**: RPC `excluir_conta_total()` no `futebol.sql`
  (SECURITY DEFINER): clubes voltam ao universo (`dono_user_id = NULL`),
  propostas canceladas, feira/inventário/cartório/chat/missões/presença/
  tempo/carreira relacional/mesas/campeonatos/lobbies, **ledger + carteira
  SOV**, `botao_usuarios`, `cidadela_perfis` e por fim `auth.users` (sem
  isso a conta "apagada" continuava entrando — o login fantasma). Frontend
  `excluirContaUsuario` chama a RPC com fallback legado (apaga só o perfil)
  se a migration não estiver aplicada. **PRODUÇÃO: re-aplicar `futebol.sql`
  no SQL Editor para ativar a exclusão total.**
- **Estado da conta E2E (produção, probe REST)**: `open.rangers.fc.oficial@
  gmail.com` — coach.sov=414 (JSONB), temporada 2, rodada 2, série C,
  história cap. 6, 22 partidas; cache pontos_soberania=50 dessincronizado
  (ledger é a verdade e realinha na hidratação). Economia global: 701 SOV
  em circulação / 200.000 emitíveis; 0 clubes com dono ainda. Senha da conta
  NÃO consta em nenhum arquivo do repo (README.md é legado do gerador de
  frases) — login E2E depende da credencial informada pelo dono.
- **Verificação**: tsc 0 erros; build OK; regras-fim-temporada 36 (reescrito:
  continua SEMPRE, dívida negativa, motivo sem vazar contador); conversas 41
  (3 contatos-base + rebaixamento do rótulo legado); persistencia-unica 46
  (6 guardas novas: 3 etapas, chances ocultas, dívida, exclusão total,
  Valéria por gatilho, mensagens por gatilho); demais suítes intactas
  (f5 19, temporada 57, ia 52, torcida 42+14, entregas 9, bolsa 29,
  história 53, sessão-antiga 11, sov-invest 46, conta-sem-perfil 33,
  fluxo-usuario-novo 14, celular-anuncios 12, sov-consistencia 6,
  f5-partida 27, onclick-guard OK, onboarding 22, marketplace 11).

## SOV BANK + SOV INVEST (duas carteiras) + Bolsa atômica + dividendos recorrentes (2026-08-22, 21ª passada)

Implementação definitiva do modelo "SOV Bank / SOV Invest / Bolsa de Valores".
NENHUM SOV é criado: Bank + Invest são o dinheiro do MESMO jogador.

- **Duas carteiras (mesma linha `user_wallets`)**: `balance` = SOV Bank
  (líquido); `invest_balance` = SOV Invest (alocado em investimento). Migração
  `supabase/migrations/sov_bank_invest.sql` (ordem 11, após `sov_bank.sql`).
- **RPCs atômicas** (FOR UPDATE + idempotência + auth.uid):
  `sov_bank_transferir_carteiras` (Bank→Invest **0%** / Invest→Bank **IOF 10%**,
  a taxa sai de circulação como `fee` no ledger), `sov_bank_pagar_dividendo`
  (dividendo → Invest, bruto→IOF 10%→líquido, idempotente por período `t:r`),
  `sov_bank_comprar_ativo`/`sov_bank_vender_ativo` (Bolsa paga com/credita o
  Invest, ledger-first) e `sov_bank_saldos`. Tipos novos no ledger:
  `invest_transfer`, `invest_withdraw`, `dividend`, `market_purchase`, `fee`.
- **Frontend**: `src/lib/financial/sovInvestApi.ts` (transferências, dividendo,
  compra/venda, saldos). `EconomiaScreen` virou a **Bolsa de Valores**: cards
  SOV Bank + SOV Invest + transferências (0% / IOF 10%), seção **Ações**
  (Mercado de Clubes) e **Ativos de Renda** (renda recorrente). Rótulos:
  CareerHub "Economia"→"Bolsa de Valores", "Propriedade"→"Mercado de Clubes";
  PropriedadeScreen título "Mercado de Clubes"; SovBankApp mostra os 2 saldos
  + tipos novos no extrato.
- **Atomicidade (§16)**: `handleComprarAtivo`/`handleVenderAtivo` (Bolsa) são
  ledger-first — o débito/crédito do Invest é confirmado pelo ledger ANTES de
  gravar a posição; falhou → nenhuma posição criada; trava `operacaoBolsaRef`
  impede compra fantasma por clique duplo. Mercado de Clubes (cotas) já era
  ledger-first (mantido no Bank).
- **Dividendos recorrentes (§8/§9 — bug "param depois do primeiro")**: causa
  raiz era o guarda `ultimaRodada >= rodada` que travava para sempre se o
  contador ficasse à frente (estado degradado/F5/replay). Corrigido para
  `=== rodada` (só não repete a MESMA rodada) em `propriedadeEngine.
  processarDividendosProprietario` e documentado em `bolsaEngine.pagarDividendos`.
  Dividendos agora caem no SOV Invest via `pagarDividendoInvest` (idempotente
  por período — nunca duplica, nunca para).
- **Anúncios (§11–§15)**: `adManager` ganhou cooldown de **15h por script**
  (`ad_script_ts:{monetag|adsterra|adsense}` em localStorage) verificado antes
  de injetar — F5 ou clicar no jogo NÃO reexibe antes do intervalo; nunca em
  loop; nunca abre várias páginas/janelas.
- **Celular (§1–§2)**: mensagem de "Número desconhecido" (O Corretor) nunca
  fica presa — o botão de leitura "Entendido — voltar às mensagens" retorna à
  LISTA de Contatos (`setAba("contatos")`), NÃO fecha o celular (antes chamava
  `onVoltar` = fechar o app). Suborno/narrativa têm saída (onFechar → hub).
- **Verificação**: tsc 0 erros; build OK. Testes: sov-invest-integridade 46/46,
  celular-anuncios 12/12, conta-sem-perfil 33/33, persistencia-unica 32/32,
  sov-consistencia 6/6, fluxo-usuario-novo 14/14, f5-partida 27/27.
- **PRODUÇÃO**: aplicar `supabase/migrations/sov_bank_invest.sql` no SQL Editor
  (após `sov_bank.sql`). Sem ela, transferências/dividendos no Invest falham de
  forma segura (null → toast de erro, nunca cria SOV).


## AUTENTICAÇÃO ≠ CONTA + fim do fallback econômico local (2026-08-22, 20ª passada)

Correção das pendências da auditoria de auth/persistência/economia. Cirúrgico:
economia SOV (user_wallets/bank_ledger/sov_bank_registrar/teto 200k) intacta.

- **LOGIN FANTASMA — CAUSA RAIZ**: limpar o schema `public` NÃO apaga
  `auth.users` (a autenticação mora no GoTrue). Sessão válida + perfil público
  inexistente → `useBotaoAuth.sync` fazia auto-provisionamento silencioso
  (criava `botao_usuarios` + carteira + bônus) e o usuário entrava. Agravante:
  `excluirContaUsuario` é soft-delete (auth.users permanece; hard-delete exige
  Dashboard/Admin API).
- **REGRA DETERMINÍSTICA** (`online/sessaoRegras.ts`, PURO, sem alias "@/"):
  `decidirDestinoSessao({temPerfil, usuarioCriadoEm, agora})` →
  `entrar` (perfil existe) | `recuperar-cadastro-recente` (sem perfil MAS
  `auth.users.created_at` dentro de `JANELA_CADASTRO_RECENTE_MS` = 10 min —
  primeiro acesso pós-signUp com trigger falho) | `recusar-conta-sem-cadastro`
  (sessão antiga sem perfil). Recusa: `sair()` (mata refresh token) +
  `limparCache()` + `contaSemCadastro=true` → BotaoGame mostra toast e abre a
  tela de cadastro ("profile"). NUNCA cria perfil/carteira/bônus na recusa
  (guarda estrutural com marcadores `RECUSA-CONTA-SEM-PERFIL:inicio/fim`).
- **RE-CADASTRO SEM DEADLOCK** (`auth.ts cadastrar`): signUp "already
  registered" → prova de posse via `signInWithPassword` (senha errada = nada
  criado) → perfil existe? devolve; não existe? `criarPerfilSeNaoExistir` com
  os dados do formulário (agora aceita `DadosNovoPerfil`: nome/time/sigla/
  número/cores). Bônus continua idempotente por `signup:{user}` — re-cadastro
  com ledger intacto NÃO dobra; com tudo apagado, é mundo novo.
- **FIM DO FALLBACK ECONÔMICO LOCAL** (regra: "ledger indisponível ⇒ operação
  econômica NÃO concluída; cache preservado, nunca confirmado localmente"):
  `adicionarPontosVideo` retorna null sem gravar (BotaoGame mostra toast de
  retry); `salvarResultado` (legado) mantém `pontos_soberania` sem soma local;
  `atualizarPontosSoberania`/`atualizarEstatisticasOnline` gravam cache só com
  saldo do ledger (estatísticas não-econômicas seguem gravando); aposta online
  (`aplicarApostaSoberania`) ABORTA (return null) sem confirmação. O fluxo de
  carreira (`aplicarResultadoRemoto`) mantém o cache coach.sov do snapshot
  local por design (realinhado pelo ledger; F5 nunca zera) — documentado.
- **BOLSA sem dupla contagem na UI**: EconomiaScreen — "Patrimônio = saldo +
  valor de mercado das cotas. Ativos NÃO são saldo disponível"; patrimônio da
  Cidadela rotulado "valor de mercado, não saldo de ninguém". BolsaResumoCard
  — "Em ativos: X SOV (valor de mercado — não é saldo)".
- **Testes**: `testes/sessao-antiga.test.mts` NOVO (11 invariantes runtime,
  Node strip-types — node_modules ausente neste workspace; jiti também vale):
  sessão antiga+sem perfil→RECUSA; signUp recente→recuperação; borda 10min;
  skew de relógio; monotonicidade. `testes/conta-sem-perfil.test.mjs` NOVO
  (30 estruturais: recusa sem provisionar, re-cadastro com prova, fim dos
  fallbacks, separação saldo/patrimônio). `sov-consistencia` atualizado (6/6).
- **Verificação**: tsc 0 erros; build OK; sov-consistencia 6/6;
  persistencia-unica 30/30; fluxo-usuario-novo 14/14; f5-partida 27/27;
  conta-sem-perfil 30/30; sessao-antiga 11/11; onclick-guard OK; jiti:
  torcida 42+14, temporada 57, ia 52, f5 19, conversas 38, entregas 9,
  regras-fim-temporada 20, bolsa-persistencia 29, história 53, marketplace OK,
  onboarding OK. Produção (RPC anon sov_bank_stats): emitido 103, retirado
  39,64, circulação 63,36 (= 103−39,64 ✓), disponível 199.897 ✓, 0 alertas.

## F5 na partida + lost update no ledger (2026-08-22, 19ª passada)

Continuação do E2E do Robô Doidão (diretiva: consertar o processo, não o
passado). Dois bugs reais encontrados pelo E2E e corrigidos:

- **F5 no meio da partida caía no menu — ORDEM DOS EFEITOS**: no BotaoGame o
  efeito de GRAVAÇÃO do resume (`botao:resume:v1`) era declarado ANTES do
  efeito de restauração e ambos disparam quando `perfil?.user_id` carrega.
  A gravação rodava primeiro com `screen="menu"` → `removeItem(RESUME_KEY)` →
  a restauração lia nada. Fix: efeito de restauração movido para ANTES do de
  gravação (comentário no código marca a invariante; guarda estrutural em
  `testes/f5-partida.test.mjs`). E2E prova: F5 com 24 jogadas → mesma partida,
  24 jogadas, rodada e placar preservados; "Sair" (abandono) NÃO restaura.
- **LOST UPDATE NO LEDGER (dinheiro evaporando)**: `concluirColetiva` dispara
  DUAS `registrarTransacaoSov` em paralelo (coletiva + recompensa de
  investigação da história). O `record_transaction` lia
  `user_wallets.balance` SEM lock → as duas liam o MESMO saldo (74) e a
  última escrita ganhava: ledger somava +25, carteira guardava +10 (15 SOV
  evaporados; extrato mostrava as duas linhas com `balance_before=74`).
  Fix na migration EXISTENTE `sov_financial_system.sql`:
  `SELECT ... FROM user_wallets WHERE user_id = p_user_id FOR UPDATE`.
  Prova no pg local: +10 e +15 paralelos → 50→65→75 encadeado, carteira=75.
  **PRODUÇÃO: re-aplicar `sov_financial_system.sql` no SQL Editor.**
- **Ciclo econômico completo provado em produção** (extrato real do ledger
  do Robô): desafio de patrocinador +7 → resultado de partida +1 (empate) →
  coletiva +10 (`coletiva:{partidaId}`) → investigação +15
  (`historia:cap1:{partidaId}`) — história avançou cap 0→1, entrevista
  persistida no JSONB, `rodadaAtual` avança. F5 pós-coletiva NÃO repaga
  (guarda de sessão + chave idempotente no servidor). Logout/login: saldo
  idêntico (84=84).
- **F5 na tela de fim de partida**: volta à MESMA tela de fim (resume blob
  com matchEnd) — verificado com screenshot.
- **Splash duplo no F5**: resolvido de fato — o efeito em ordem errada também
  derrubava a sessão para o menu (que re-hidratava e abria loading de novo).
  Timeline pós-fix: UM único intervalo de loading contínuo.
- **Coletiva tem confirmação de patrocinador** (ControlledMonetagButton):
  "Finalizar coletiva" abre modal "Uma página de patrocinador pode abrir" →
  CONTINUAR → aí sim `concluirColetiva` roda. E2E precisa clicar os DOIS.
- **Bug registrado (não corrigido, fora do foco)**: React error #418
  (hydration mismatch de texto) aparece no console a cada carga — app
  recupera client-side, sem impacto visível. Investigar depois (E2E-007).
- **Verificação**: tsc 0 erros; build OK; f5-partida 27/27; fluxo-usuario-novo
  14/14; sov-consistencia 6/6; persistencia-unica 30/30; onclick-guard OK;
  historia 53/53; onboarding OK; marketplace OK; cadeia de 10 migrations
  aplica limpa em banco fresco (stubs locais: auth.users, auth.role(),
  publication supabase_realtime; pg_cron só existe no Supabase).

## E2E em produção com o Robô Doidão + blindagem obterSaldoSov (2026-08-22, 18ª passada)

E2E real no navegador (build de produção servido localmente + Supabase de
produção), conta-canário "Robô Doidão". SEM backfill de contas de teste.

- **BUG NOVO ENCONTRADO PELO E2E (zeragem pós-F5)**: após criar a carreira
  (coach.sov=50, cache=50) e dar F5, a hidratação ZERAVA cache e coach.sov em
  produção. Cadeia: `loadCareerFromSupabase` → `obterSaldoSov` → RPC ANTIGA
  `obter_saldo_soberania` devolve **0** para usuário sem wallet (não erro!) →
  `coach.sov = 0` → próximo `saveCareerToSupabase` grava JSONB com 0 e cache
  `Math.max(0, 0)` = 0. Violação exata da regra "erro/ausência nunca vira 0".
- **FIX (`sovApi.obterSaldoSov`)**: se a RPC devolve 0, confere a linha em
  `user_wallets` (RLS permite ao dono ler) — carteira inexistente ⇒ saldo
  DESCONHECIDO (null), nunca 0; o chamador cai no cache e o
  `bootstrapFinanceiro` da sessão cria a carteira. Defesa em profundidade que
  funciona com a RPC antiga E com a nova (a nova cria a carteira na leitura).
- **E2E PROVADO (conta-canário, produção)**:
  1. login → bootstrap falha com log (`create_or_update_wallet` 42601) e
     NÃO toca no cache (50 preservado — antes zerava);
  2. carreira criada (Técnico, Robô FC, Série C) → JSONB produção com
     coach/torneio/190 fixtures;
  3. F5 → CareerMenu "SOV: 50" (antes mostrava 0 e regravava 0);
  4. partida completa (84 flicks, 0-2) → recompensa chama
     `sov_bank_registrar`, recebe `transaction_id NULL` da RPC antiga →
     tratada como FALHA (fallback local, log completo — nunca saldo 0);
  5. persistência pós-partida: `partidas_jogadas=2`, rodadaAtual=2,
     moral=53, 20 fixtures jogados, 7 conversas, 10 headlines — tudo no
     JSONB de produção; cache=50 estável;
  6. login em navegador limpo (sem sessão) → SOV 50 + carreira intactos.
- **Como servir o build localmente** (vite dev quebra atrás do proxy do
  work-host): `npm run build` (preset nitro/vercel) + adaptador Node que
  serve `.vercel/output/static` e delega ao handler
  `.vercel/output/functions/__server.func/index.mjs` (exporta `{fetch}`).
  Partida dirigida por puppeteer-core + /usr/bin/chromium (flicks por
  eventos de mouse no canvas — browser tools não fazem drag).
- **PENDENTE (bloqueio real do ledger)**: re-aplicar em produção, no SQL
  Editor, `sov_financial_system.sql` + `sov_integracao_cartorio.sql` +
  `futebol.sql` + `sov_bank.sql` (ordem do README). Até lá, TODA recompensa
  cai no fallback local — degradado mas honesto (cache nunca zerado).
- **Verificação**: tsc 0 erros; build OK; fluxo-usuario-novo 14/14;
  sov-consistencia 6/6; persistencia-unica 30/30.


## Fluxo do usuário novo — causa raiz corrigida (2026-08-22, 17ª passada)

Auditoria E2E da cadeia financeira do usuário novo (diretiva: "não conserte o
passado, conserte o processo"; sem backfill de contas de teste).

- **PRODUÇÃO ESTAVA COM O FINANCEIRO MORTO** (probes REST com a chave
  publishable do bundle pracinha.online): `create_or_update_wallet` quebrava
  com `42601 query has no destination for result data` para qualquer usuário
  real → **nenhuma wallet jamais foi criada**; `sov_bank_registrar` era a
  versão ANTIGA que engole EXCEPTION (`{transaction_id:null,balance:0}`) →
  **nenhuma transação jamais chegou ao ledger**; `sov_bank_stats()`:
  `usuarios_com_carteira=0, transacoes_total=0, em_circulacao=0`. Todo SOV
  exibido na UI sempre foi fallback local/cache — ficção.
- **CADEIA DO BUG (usuário novo)**: trigger `handle_new_user` criava o perfil
  com cache `pontos_soberania=50` mas não criava wallet nem registrava o
  bônus; como o perfil já existia, `useBotaoAuth` nunca chamava
  `criarPerfilSeNaoExistir` (único lugar que chamava `bonusCadastro`) →
  bônus nunca ia ao ledger → cache 50 × ledger 0 desde a 1ª ação.
- **CORREÇÕES (repo)**:
  - `futebol.sql`: `handle_new_user` agora chama `sov_bank_bonus_cadastro`
    (idempotente `signup:{user}`) dentro do próprio trigger — carteira+bônus
    nascem no ledger junto com o perfil; EXCEPTION-guard não quebra o
    cadastro se o financeiro ainda não estiver aplicado.
  - `sov_financial_system.sql`: `create_or_update_wallet` sem cláusula de
    exceção — erro real sobe como 400 (nunca NULL silencioso).
  - `sov_integracao_cartorio.sql`: `obter_saldo_soberania` cria a carteira na
    primeira leitura ("wallet inexistente" nunca vira "saldo 0" ambíguo).
  - `sov_bank.sql`: `sov_bank_bonus_cadastro` retorna `credited=FALSE` no
    retry idempotente (antes mentia TRUE).
  - Frontend: `bootstrapFinanceiro(userId)` (sovBankApi) roda em TODA sessão
    no `useBotaoAuth` — garante wallet+bônus e alinha o cache
    `pontos_soberania` ao saldo AUTORITATIVO via `alinharCacheSoberania`
    (lib/botao/api.ts); erro real → null, nunca sobrescreve cache com 0.
    `criarPerfilSeNaoExistir` usa o mesmo bootstrap (não assume 50 sem
    ledger).
- **PROVA E2E (Postgres local docker, migrations REAIS na ordem do README)**:
  insert em auth.users → trigger → perfil(50)+wallet(50)+ledger(signup +50)
  +time em 1 passo; retry do bônus = sem duplicar; partida +3 idempotente por
  chave (duplicated=true no retry); obter_saldo=53; reconciliação
  consistente; teto de emissão e saldo insuficiente PROPAGAM erro (não viram
  0). Teste estrutural `testes/fluxo-usuario-novo.test.mjs` (12 invariantes).
- **BLOQUEIO DE PRODUÇÃO (ação manual do usuário)**: as 4 correções SQL
  precisam ser re-aplicadas no SQL Editor (ordem e verificação no
  `supabase/migrations/README.md`, seção "RE-APLICAÇÃO OBRIGATÓRIA"). Sem
  isso, o frontend degrada com segurança (erro ≠ 0) mas o ledger não grava.
  Após re-aplicar, o bootstrap no 1º login auto-cura qualquer conta (inclui
  a canário "Robô Doidão", robo.doidao.e2e@gmail.com — sem backfill manual).
- **Verificação**: tsc 0 erros; build OK; suítes jiti (53+38+29+9+52+20+57+
  42+14+19) + estruturais (12+30+6+onclick) + SSR (4 bundles, 0 falhas).

## Coerência global do usuário + história testada (2026-08-21, 16ª passada)

Verificação de "história principal + RPG" (§do prompt mestre) + resposta à
questão arquitetural "por que botao_usuarios E cidadela_perfis":

- **HISTÓRIA PRINCIPAL FUNCIONA** — fiação verdadeira no BotaoGame:
  `concluirColetiva` → `processarGatilhoEntrevista` (PURO, idempotente por
  partidaId via `historia.entrevistasProcessadas`) → avança
  `historia.capitulo` (0→6) → entrega conversa do NPC (Helena caps 1-3,
  John Adrian caps 4+, id `conv-npc-{npc}`) → post críptico na rede
  (`anexarPost`) → SOV `historia:cap{n}:{partidaId}` idempotente →
  `persistCareer`. `registrarPosicaoFinal` só abre no cap final (6) e é
  uma vez só (`historia.posicaoFinal` guard). **Gap real**: a suite de
  "36 testes da história" SÓ existia citada no AGENTS — nunca foi commitada.
  Agora `testes/historia-engine.test.mts` cobre 53 invariantes (gatilho,
  idempotência, troca de mensageiro, desfecho, perfil-varia-tom, dica vaga).
  Engine PURO sem alias `@/` (import relativo) → jiti executável.
- **POR QUE DUAS TABELAS**: `botao_usuarios` = identidade/domínio **futebol**
  (nome do time, cores, tática, W/D/L, `pontos_soberania` cache, JSONB
  `progresso_caminpanha` = carreira/bolsa/torneio) criado no cadastro/login
  do Futebol. `cidadela_perfis` = perfil/domínio **cidadela** (profissão,
  reputação, nível, `estado` JSONB = onboarding/profissão, `nome`/`bio`
  públicos) criado via RPC `obter_perfil_cidadela` no primeiro acesso à
  Cidadela. **Chave de ligação: UMA — `user_id = auth.uid()`** (mesma FK
  `REFERENCES auth.users`, UNIQUE nas duas). Um usuário, dois perfis de
  domínio: NÃO é duplicação de identidade — é separação por domínio com o
  MESMO usuário dinossauro-de-vs. Não há campos repetidos de verdade:
  dinheiro/SOV NUNCA em `cidadela_perfis`; pontuação de futebol NUNCA em
  `cidadela_perfis.estado`; `cidadela_perfis.nome/.bio` são o rótulo público
  opcional do RPG (separação válida por domínio — o "Perfil Público"
  mistura-se com `botao_usuarios` para partidas/SOV).
- **IDENTIDADE CANÔNICA**: `auth.users` (auth.uid()) → um perfil por domínio,
  TODOS ligados por `user_id`. Prova: `cidadela_perfil_publico(user_id)`
  reúne campos de AMBAS numa leitura (nome/bio/nível de `cidadela_perfis` +
  partidas/vitórias de `botao_usuarios`). Nenhum módulo inventa seu próprio
  "usuário" — todos resolvem `perfil.user_id` (futebol) ou `userId` (RPC).
- **CELUΛR SEPARADO POR TIPO — JÁ EXISTIA, SEM DUPLICAR FONTE**:
  mensagens privadas = `CareerState.conversas` (`ConversaCelular[]` —
  uma conversa por contato/NPC via `anexarConversa` id por npcId) → aba
  "contatos"; posts/notícias públicas = `CareerState.feedCidadela`
  (`PostFeed[]` com `selo` noticia/torcedor/rival/oficial/rumor —
  `anexarPost`) → aba "rede"; missões = RPC `cidadela_missoes_diarias` →
  aba "missoes"; notícias também em `headlines[]` (manchetes da carreira).
  Um evento (derrota) gera UMA consequência + representações (post do
  jornalista na rede/reação do rival na conversa) TODAS apontando para o
  mesmo `partidaId`. Não são 4 entidades — são leituras do mesmo
  `career.historia/entrevistas/...`. Persistência F5: `normalizarCareer`
  sana `conversas`/`headlines`/`feedCidadela`; missoes vêm do servidor RPC.
- **SINCRONIZAÇÃO**: SOV ledger → `obterSaldoSov` é a ÚNICA leitura em todos
  os módulos (celular `saldoSov` prop = saldoSovRemoto ?? coach.sov,
  re-busca 1.8s; SovBank/SovMarket/PerfilApp/BolsaResumoCard mesmo RPC).
  `pontos_soberania` é cache denormalizado (só escrito em storage.ts com
  `saldoSov ?? local`). Carreira/bolsa/torneio/classificação → UM JSONB
  serializado.
- **Verificação**: tsc 0 erros; 53 (história) + 38 + 29 + 20 + 19 + 9 + 30
  + 6 + onboarding + marketplace OK. Não arquiteturei nada novo — mapa e
  testes do que existia.

## Arqueologia git + verdade do banco em produção (2026-08-21, 15ª passada)

Investigação com `git fetch --unshallow` (330 commits) + probes REST na
produção (chave publishable extraída do bundle pracinha.online):

- **`cidadela_rpg.sql`**: criado na Fase 1 (`2e20bb4`) e **deletado no HEAD**
  (`1044aa5` "Unificar tabelas SQL"). A unificação movia colunas do perfil
  (profissao/estado/reputacao/bio) para `botao_usuarios.estado_cidadela`.
  **Produção prova que a unificação NUNCA foi deployada**: REST mostra
  `column botao_usuarios.estado_cidadela does not exist` (42703), enquanto
  `cidadela_perfis` EXISTE e os RPCs `obter_perfil_cidadela`/
  `atualizar_estado_cidadela` FUNCIONAM (P0001 = auth, não 404). Veredito:
  a fonte única do perfil da Cidadela É `cidadela_perfis`; o commit HEAD
  era uma meia-migração (frontend duplicava, backend não). Resolução:
  arquivo restaurado do histórico (fresh deploys precisam dele —
  `tempo_cidadao.sql`/`cidadela_chat_missoes.sql`/`feira.sql` dependem da
  tabela) e bloco-fantasma removido do `futebol.sql` (com guarda no teste
  estrutural).
- **Origens das regressões de persistência** (pickaxe -S): queue
  `writeQueues` nasceu em `d4f6b24` mas `aplicarResultadoRemoto`
  (nascido em `686cbc1`) e o padrão `writeProgress({career: nextCareer})`
  (solidificado em `d4f6b24`/`4d8608c`) ficavam FORA dela — leitura velha
  regravada por cima (rollback F5). Corrigido na 14ª passada.
- **patchSob duplicado**: introduzido no HEAD (`1044aa5`) — delta da partida
  ia ao ledger no `finishTournamentMatch` E em `aplicarResultadoRemoto`.
  Removido na 14ª passada.
- **Rotas/F5**: pickaxe de `navigate`/`redirect` em `src/routes/*.tsx` = 0
  ocorrências em TODO o histórico. Não existe redirect para /cidadela; os
  jogos são telas internas (Screen) da rota /cidadela e a tela ativa restaura
  via sessionStorage. Problema inexistente — confirmado.
- **§13 nome pedido de novo**: `CoachSetup` nunca recebeu a identidade do
  login; agora `nomeInicial={perfil?.nome}` preenche o campo (editável).
  Fluxo permanece: login → coach (prefill) → CareerIntro (Treinador/
  Proprietário) → ofertas.
- **Tour mapa do usuário** (rota → tela → escrita): / → hub BRIO; /cidadela →
  BotaoGame (screens internos: menu/hub/tournament-match/economia/...);
  /campus → ProfissaoHub/CampusHub; /biblioteca → cartório/livro; /brio →
  Notícia/comentarista. Escritas: perfil→botao_usuarios; Cidadela-perfil→
  cidadela_perfis via RPCs; carreira/bolsa/torneio→JSONB
  `botao_usuarios.progresso_caminpanha` (fila serializada); dinheiro→
  `user_wallets`/`bank_ledger` via sov_bank_registrar; onboarding→
  `cidadela_perfis.estado.onboarding` via RPC; missões→`cidadela_missoes`
  via RPC; feira→`cidadela_inventory/market_listings` via RPCs feira_*;
  grupo→`cidadela_chat_messages`.
- **Verificação**: tsc 0 erros; build OK; estruturais + suites jiti OK.

## Persistência total — corrida no JSONB + double-count no ledger (2026-08-21, 14ª passada)

Auditoria integral (prompt "Bolsa não persiste após F5"). Nada de tabela/hook/
serviço novo — a arquitetura existente foi fechada em volta das fontes únicas.

- **CAUSA RAIZ (rollback F5 da Bolsa e da carreira)**: `aplicarResultadoRemoto`,
  `inserirManchetesRemotas`, `aplicarEscolhaRemoto` e `iniciarCampanhaRemota`
  faziam SELECT **fora** da fila de escrita (`writeQueues`) e depois regravam
  a carreira INTEIRA (`writeProgress({career: nextCareer})`). A leitura solta
  podia ser anterior a escritas recentes (compra na Bolsa, dividendos,
  conversas) → a última escrita sobrescrevia com snapshot VELHO → a sessão
  mostrava o estado novo e o F5 revelava o antigo.
- **Fix**: `storage.mutateProgressInSupabase(userId, mutator)` — leitura e
  mutação DENTRO da fila (enqueueProgressWrite compartilhado com o merge).
  `aplicarResultadoRemoto` agora só sincroniza contadores (partidas/gols) +
  `coach.sov` autoritativo do ledger — NÃO reconstrói moral/bônus (o snapshot
  local do persistCareer é o dono). `inserirManchetesRemotas` anexa na carreira
  fresca da fila. `aplicarEscolhaRemoto`/`iniciarCampanhaRemota` REMOVIDAS
  (re-aplicavam poder/moral/campanhasJogadas — double-apply após F5).
- **Double-count no ledger eliminado**: o `patchSob` do finishTournamentMatch
  somava TUDO (delta da partida + dividendos + desafio + bônus de título) e
  registrava no ledger, enquanto cada componente TAMBÉM tinha escritor próprio
  (aplicarResultadoRemoto, bloco de dividendos, desafio, aplicarFimCampanhaRemoto)
  → saldo do banco divergia ~2× da UI. Agora: delta da partida =
  `aplicarResultadoRemoto` (chave `partida:{uid}:{fixture}`, módulo
  parametrizado — MesaOnlineMatch passa `"online"`); dividendos =
  `dividendo:{t}:r{n}`; desafio = `desafio:{uid}:{desafioId}` (chave NOVA);
  decisão RPG = `decisao:{uid}:{choiceId}` (chave NOVA); fim de temporada =
  `fim-campanha:{uid}:t{n}:{div}` (e não re-incrementa títulos quando
  careerAtual já os somou — bug do contador dobrado).
- **Manchetes**: BotaoGame não chama mais inserirManchetesRemotas (o snapshot
  já carrega as headlines; a chamada extra duplicava/rolava back). A função
  segue para o fluxo ONLINE (MesaOnlineMatch), agora mutate-safe.
- **Onboarding/estado de profissão**: campo unificado `CidadelaPerfil.estado`
  (o tipo dizia `estado_cidadela`, o código lia `estado` — um dos dois sempre
  undefined em runtime). `salvarOnboarding` fazia UPDATE direto em
  `botao_usuarios.estado_cidadela` (coluna INEXISTENTE → PostgREST 400 engolido
  → tour nunca persistia no servidor e repetia); agora usa a RPC
  `atualizar_estado_cidadela` (merge no JSONB do perfil), mesma da migração
  anônimo→conta. `normalizarPerfil` aceita `estado`/`estado_cidadela` (defesa).
- **salvarResultado (legado OnlineMatchV2, morto)**: não sobrescreve mais o
  JSONB inteiro — mescla só `friendlies` via fila (trophies/titles desse fluxo
  usam formato string[] incompatível com a carreira).
- **Rotas/F5**: NÃO existe redirect fixo p/ /cidadela — jogos são estado interno
  da rota /cidadela e a tela ativa restaura via sessionStorage
  (`botao:resume:v1` inclui "economia"; `cidadela:jogo-ativo:v1` por aba).
  Nada a corrigir — o problema descrito não existe no código atual.
- **Gap reportado (não inventado)**: `supabase/migrations/cidadela_rpg.sql`
  consta no README (passo 4) mas o arquivo NÃO está no repo — a tabela
  `cidadela_perfis` e as RPCs `obter/escolher/atualizar_estado/obter_world_state`
  só existem aplicadas em produção. Sem o arquivo, deploy novo quebra.
- **Testes**: `test-bolsa-persistencia.mts` NOVO (29 invariantes jiti: compra→
  JSONB→normalizarCareer pós-F5 = cotas/saldo/patrimônio idênticos; venda
  parcial/total; dividendos idempotentes; saneamento de JSONB corrompido) +
  `testes/persistencia-unica.test.mjs` NOVO (25 checagens estruturais das
  invariantes acima). `onclick-guard` atualizado (OnboardingTour→TourContextual).
  Suites: 38+9+57+52+19+42+14+20 jiti OK, 25+19+6+22+11 estruturais OK,
  `tsc --noEmit` 0 erros (HEAD tinha 5 pré-existentes — corrigidos),
  `npm run build` OK.

## Consistência SOV — banco engolindo erro → "saldo 0" no cache (2026-08-21, 13ª passada)

Vistoria cirúrgica da fonte de verdade SOV (ledger + cache). TODAS as
recompensas gravam em `bank_ledger`/`user_wallets` via `sov_bank_registrar`;

o bug era de confiabilidade da confirmação:

- **CAUSA RAIZ (SQL)**: `sov_bank_registrar` tinha `EXCEPTION WHEN OTHERS`
  que devolvia `{transaction_id NULL, balance 0, duplicated FALSE}` QUALQUER
  erro (saldo insuficiente, teto de emissão, auth violado) — a UI lia só
  `balance` e cacheava **0** (pontos_soberania/coach.sov zerados mesmo sem
  escrita no ledger). Migração `sov_bank.sql` corrigida: sem EXCEPTION, o
  erro sobe como 400 legível. Para produção: re-aplicar no SQL Editor.
- **Defesa no frontend (redundante após migration)**: `sovApi.registrarTransacaoSov`
  detecta `transaction_id NULL` → log completo + retorna null → fallback
  local (nunca saldo 0). Guard permanece como defesa em profundidade.
- **Aposta online sync**: careerRemote usa o saldo do ledger para gravar o
  cache (antes computava local e gravava mesmo com ledger falho).
- **Compra de clube**: se o banco recusa o débito, o grant era entregue
  mesmo assim; agora aborta com toast de erro (§14 do prompt mestre).
- **Teste estrutural**: `node testes/sov-consistencia.test.mjs` 6/6.

## AUDITORIA TOTAL — React #130 + carteira 400 + tour contextual (2026-08-21, 12ª passada)

- **React #130 CAUSA RAIZ (fixada)**: `SubornoStory.Chip` recebia um ELEMENTO
  React (`icon={<TrendingUp/>}`) e renderizava como componente (`<Icon/>`) →
  "Element type is invalid: got object". Carreira com `suborno.nodeAtual`
  ativo → `prioridadeCelular` renderiza SubornoStory → crash ao entrar no
  Futebol. Agora Chip renderiza o elemento direto (`{icon}`), tipo
  `ReactNode`. Provar/validar: `node run-ssr.cjs test-ssr-flow.mts` +
  `node test-ssr-flow.bundle.mjs` (harness rolldown com alias "@" → src).
- **400 do Supabase (probes em produção pracinha.online)**: PostgREST 400 =
  uuid inválido no payload OU RAISE EXCEPTION no corpo da função (ambos
  verificados via curl com sb_publishable extraída do bundle). RPCs SOV
  existem com assinaturas batendo; `tempo_cidadao_heartbeat` existe e RAISE
  "usuario nao autenticado" quando a sessão expira mas userId (perfil
  cacheado) ainda existe — era o loop de 400. Agora `useTempoCidadao` checa
  `supabase.auth.getSession()` antes de bater. `sovApi.logErroRpc` loga
  code/message/details/hint+payload (nunca engolir o 400).
- **Leitura de saldo SOV consolidada**: `pracinhaCore.obterSaldoSov`
  (direto user_wallets + create_or_update_wallet a cada leitura) REMOVIDA;
  todos leem `sovApi.obterSaldoSov` (RPC obter_saldo_soberania).
  SovMarket não grava mais 0 falsificado quando a leitura falha.
- **Tour contextual substitui portão full-screen**: `OnboardingGate` =
  pass-through; `TourContextual.tsx` (bolhas ancoradas em `data-tour`
  reais, overlay pointer-events-none) monta DEPOIS da escolha do módulo em
  /cidadela (botao: perfil/carreira/trofeus/celular; trilha:
  trilha-trofeus/celular). Conclusão persiste via `useOnboarding`
  (onboarding engine) — botão "?" re-executa. `OnboardingTour.tsx` +
  `ChatAuthCard.tsx` REMOVIDOS (só existiam por causa do portão).
  Âncoras: MenuCard ganhou `dataTour` prop; CelularFixo button
  `data-tour="celular"`; TrilhaGame "Troféus" `data-tour="trilha-trofeus"`.
- **Ads**: `adManager` não injeta mais `data-cfasync` na tag do AdSense
  (era o warning "AdSense head tag doesn't support data-cfasync").
- **Sistema de recompensa é O sistema**: `registrarTransacaoSov` →
  `sov_bank_registrar` (ledger) — todos os 15 call sites em BotaoGame +
  careerRemote + storage + useCelularCarreira + campus. Docs de inventário
  no AGENTS §"Sistema de IA" — recompensas nunca duplicadas por UI.
- **Log de debug removido**: "[BotaoGame] onLoadCareer chamado" saiu de
  produção.
- **Verificação**: tsc 0 erros, build OK, 38 render checks SSR (suites
  test-ssr-flow/futebol/celular/botaogame, 0 falhas), 283+ testes jiti OK.
## Regras de fim de temporada + marco de liderança + celular/Bolsa (2026-08-21, 11.5ª passada)

- **Regra das 3 temporadas (§9 recuperação de dívida)**: `CareerState.temporadasInadimplente`
  (0-3, clamp no `normalizarCareer`) + `avaliarFimTemporada(sov, divisao, prev)` —
  pagou → contador zera e motivo "renova"; falhou 1ª/2ª → CONTINUA com motivo
  narrativo "(n)/3 temporadas ... restantes"; 3ª → falência. Chamadas em
  hidratação (F5 seguro) e em `finishTournamentMatch`; `startNextSeason`
  persiste o contador do veredito. `SeasonEndScreen` mostra "Tentativa de
  recuperação X de 3". `MAX_TEMPORADAS_INADIMPLENTE = 3` exportado.
- **Marco de 1º lugar (§10)**: `chegouAoPrimeiroLugar(pos, temp, marco)` PURO +
  `career.marcoLiderTemporada` persiste a celebração — posição 1 real dispara
  UMA vez por temporada: toast 🏆 + conversa do Dirigente no celular
  (fila `enfileirarConversas`, id `marco-lider-t{temp}`). F5 não repete.
- **LoadingScreen unificado (fix de UX)**: overlay único cobre duas fases —
  auth inicial (`carregando`, snapshots intro) + hidratação da campanha
  (`loading`, snapshots onboarding-college); `onCompleto` em React state
  (identidade estável — texto e duracao no mesmo render do estado `loading`).
  Nunca dois overlays concorrentes.
- **Onboarding anônimo→conta**: `carregarOnboarding(uid)` migra o espelho
  `ID_ANONIMO` para o userId (localStorage + RPC `atualizar_estado_cidadela`)
  quando o remoto é vazio — tour feito antes do login não se perde.
- **Bolsa visível**: `components/financial/BolsaResumoCard.tsx` somente-leitura
  (índice/patrimônio investido/posições + seta de tendência vs preçosAnteriores)
  montado (a) na aba "banco" do celular (`CelularConversas.bolsa` prop;
  CelularFixo repassa; `useCelularCarreira` alimenta /cidadela+/campus) e
  (b) nos `extras` do `EmpresarioHub` (rota /cidadela). Operações ainda SÓ
  na tela Economia da carreira — o Banco nunca escreve.
- **Conexão do dirigente (§6)**: `consequenciasEntrevista` agora emite, junto
  com a reação do Bragança/torcedor, a voz do Dir. Aldemir — provocação
  (importância alta → aviso da diretoria) ou postura de orgulho/humildade
  (registro de blindagem). Funde na conversa única via `anexarConversa`.
- **Testes**: `test-regras-fim-temporada.mts` NOVO (20 invariantes jiti das
  chances de dívida/marco/dedução de manutenção), `test-entregas.mts`
  atualizado (9/9 —
  provocação espera dirigente+Bragança). Suites: temporada 57, conversas 38,
  f5 19, torcida 42+14, ia 52, onboarding 22, marketplace 11, onclick-guard 19.
  `tsc --noEmit` 0 erros, `npm run build` OK.

## Onboarding re-aplicado + login fora do futebol + auditoria celular/env (2026-08-21, 11ª passada)

- **Re-aplicado o onboarding** (onboardingEngine + OnboardingGate + OnboardingTour
  + ChatAuthCard + CareerIntro/Marketplace) sem tocar nas variáveis do Supabase
  — os reverts 361f808/4c58cc1 foram desfeitos (git revert dos reverts +
  cherry-pick ddf0079); conflitos resolvidos preservando a fiação da 10ª passada.
- **Login NÃO é tela separada no Futebol**: screen "auth"/AuthScreen removida
  do BotaoGame; o módulo "Meu Clube / Conta" (ProfileSetup) no hub principal
  (junto de Amistoso, Amistoso Online, Campeonato Online, Carreira no Campus,
  Sala de troféus) cuida de login/cadastro. Gates online apontam para
  "profile"; logout volta ao "menu". AuthScreen segue existindo SÓ dentro do
  celular (CelularConversas) e no OnboardingTour (ChatAuthCard).
- **Auditoria do Celular**: `useCelularCarreira` (hook único de /cidadela e
  /campus) agora espelha TODAS as integrações das escolhas RPG do BotaoGame —
  SOV no ledger (`efeitos?.sov`), pedido no Cartório (`efeitos?.cartorio`
  → linkCartorio) e desfecho da História (`onRegistrarPosicao` com a MESMA
  chave `historia:desfecho:{uid}` — clicar nos dois lugares não duplica).
  Rotas recebem `perfil` como 2º argumento do hook. Onde ele aparece (tudo
  enrolado): BotaoGame (Shell/durante partida), /cidadela (dentro do
  OnboardingGate), /campus (dentro do OnboardingGate), OnboardingTour (exclusivo).
  Apps → o que carrega: Contatos (career.conversas), Rede (feedCidadela),
  Missões (pracinhaCore RPC), Grupo (cidadela_chat_messages+membros RPC),
  Marketplace (feira_* RPC), Banco (sovBankApi), Arquivo (historia.pergaminhos),
  Perfil (cidadela_perfil_publico RPC). Salva: responder/escolher/excluir
  (saveCareerToSupabase), bio (cidadela_atualizar_perfil), ofertas
  (feira_* no ledger), mídia de conversa, Tempo de Cidadão (heartbeat RPC),
  Grupo leitura (localStorage `cidadela:grupo:visto`).
- **Variáveis de ambiente** (.env.example atualizado): Supabase
  `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`/`VITE_SUPABASE_PUBLISHABLE_KEY`
  /`SUPABASE_SERVICE_ROLE_KEY`; Ads `VITE_ADSENSE_CLIENT`/`VITE_ADSTERRA_INVOKE_URL`
  /`VITE_MONETAG_SRC`/`VITE_MONETAG_ZONE` (defaults em src/lib/adManager.ts).
  Leu bem com `readEnv(name)`; chaves legadas n8n/Cloudflare são legadas de
  infra do repo (não usadas em src).
- **Verificação**: `tsc --noEmit` 0 erros, `npm run build` OK; testes: 38+9
  (conversas/entregas) + 42+14 (torcida) + 57 (temporada) + 52 (IA) + 19 (F5)
  + 22 (onboarding) + 11 (marketplace) + 19 (onclick-guard) = 283 OK.

## Torcida global + IA estratégica + fim de temporada (2026-08-21, 10ª passada)

Implementação definitiva do Modo Carreira sobre a 9ª passada (66bec00):

- **`career/torcidaEngine.ts` (NOVO, PURO)**: 1.000.000 de torcedores globais,
  soma EXATA e invariante (zero-sum) em TODA operação. `distribuirTorcidaInicial`
  (peso = power², maior resto), `aplicarResultadoTorcida` (vitória 0,6-2,2% +
  bônus sequência; empate migra 0,1% p/ quem VINHA de sequência — comparar
  ANTES de zerar seqs), `aplicarTituloTorcida` (campeão suga 0,3% de todos),
  `garantirTorcida` (clubes novos entram com fatia ≤5% e o mapa é
  RENORMALIZADO a 1M — também cura estados degradados pós-sanitização),
  `forcaEfetiva` = qualidade + bônus torcida (≤+6) + forma (±3), clamp 28-99.
- **`career/torcidaIntegracao.ts` (NOVO)**: ponte carreira↔engine (cópia
  profunda por clube — o engine muta; NUNCA passar estado React direto).
  `garantirTorcidaUniverso` idempotente, `aplicarRodadaTorcida` (todos os
  jogos da rodada nas 3 divisões), `aplicarTitulosDaTemporada`,
  `forcasDaTemporada`, `formaDoJogador` (derivada da seq real).
- **Simulação usa força efetiva**: `tournament.simulateMatch` aceita
  `powerOverrides`; `seasonEngine.simularRodadaDivisoes` consome o mapa.
  Torcida é UMA variável — nunca decide sozinha (testado: time 40 com 100%
  da torcida não passa de 49).
- **`engine/estrategia.ts` (NOVO, PURO)**: cérebro da CPU. `decidirIntencao`
  PURO (escore/tempo → atacar/contra_atacar/reter/defender/bloquear) +
  `analisarPadroes` (janela de 16 tiros do jogador — lado/força/zona; só
  reage com amostra ≥6) + `perfilDoClube` (força→precisão/leitura) +
  `balancearPerfil` (jogador invicto → CPU mais disciplinada, teto 0,97;
  má fase → alívio com piso 0,25). LLM opcional (`gerarIntencaoLlm` via
  AIService.generateText) SEMPRE validado por `validarIntencaoLlm` com
  fallback determinístico. `executarIntencao` traduz intenção → impulso
  físico (defesa do goleiro preservada).
- **MatchView**: prop `aiContext` (BotaoGame passa força/torcida/forma);
  tiros do jogador registrados em `onPointerUp` (handlePlayerShoot) —
  memória POR PARTIDA, reseta a cada jogo.
- **Fim de temporada DEFINITIVO**: `SeasonEndScreen.tsx` (NOVO) com dados
  REAIS via `seasonEngine.resumoTemporada` (determinístico — re-derivável
  pós-F5). Renderiza DEPOIS da MatchEndScreen (`screen !== "match-end"`).
  `careerRemote.aplicarFimCampanhaRemoto` race-safe (lê dentro da fila
  serializada). Hidratação DERIVA o veredito de `ligasConcluidas` — F5 no
  fim da temporada não trava mais a carreira (dead-end eliminado).
- **Saldo SOV no celular**: barra de status (Coins) no CelularConversas via
  prop `saldoSov`; BotaoGame e `useCelularCarreira` buscam `obterSaldoSov`
  (user_wallets autoritativo) com re-busca 1,8s após mudança do cache local.
- **Testes**: test-torcida.mts (42), test-torcida-integracao.mts (14),
  test-temporada.mts (57), test-ia.mts (52), test-f5.mts (19) — jiti.
  Legados: test-conversas (38) + test-entregas (9). tsc 0 erros, build OK.

## Celular: UMA conversa por contato + F5 sem reset (2026-08-21, 9ª passada)

Auditoria completa sobre o commit 361f808 (revert do onboarding). Causas-raiz
corrigidas no SISTEMA ORIGINAL (sem celulares paralelos):

- **`career/conversasEngine.ts` (NOVO)**: `anexarConversa(career, conv)` —
  identidade estável por `npcId` → `canal` → `nome` (fallback p/ legado).
  Mensagens novas entram na conversa existente (dedupe por id de mensagem),
  conversa sobe ao topo, dilema pendente (eventoRpg !respondido) nunca é
  sobrescrito (vira entrada separada). Caps: 30 conversas / 100 msgs.
  `normalizarConversas(lista)` funde duplicatas legadas na hidratação
  (rodado por `careerStorage.normalizarCareer` — sana o JSONB do banco).
- **Todos os produtores migrados**: rpgEngine (eventoParaConversa id estável
  `conv-npc-{npc}`, msg `rpg-m-{eventoId}`), garantirContatosRpg (idempotente
  POR CONTATO — antes um único npcId pulava TODOS os contatos), convite da
  Trilha entra na conversa do Pracinha (msg `ritual-m-...-r{rodada}`),
  historiaEngine (capítulos = mensagens na conversa de Helena/John Adrian),
  entrevistaEngine (reações em `conv-npc-npc-braganca`/torcedor, msg por
  partidaId), médico/redes pós-jogo (`conv-canal-medico`/`conv-canal-redes`),
  decisões viram mensagem na conversa do remetente (`remetenteDecisao` em
  choicesEngine, canal `decisao:{eventoId}` — ChoiceModal usa o mesmo mapa).
- **Fila do BotaoGame** (`enfileirarConversas`) drena via anexarConversa
  (uma msg por vez, 2.6s, toast+som — sem lote).
- **F5**: resume `botao:resume:v1` (sessionStorage, por usuário, 2h) agora
  guarda TAMBÉM telas seguras (hub/classificacao/calendario/economia/
  trophies/profile/career-menu) + `patrocinioPagoPartida`; `telaRestauradaRef`
  impede `hidratarCampanha` de devolver ao menu. `concluirColetiva` idempotente
  em 2 camadas: guarda da sessão + `career.entrevistas` (F5 não repaga).
  Rota /cidadela: jogo ativo (Estádio/Trilha) persiste em sessionStorage
  `cidadela:jogo-ativo:v1` (aba nova entra limpa).
- **Celular fora do Modo Carreira**: hook único `src/hooks/useCelularCarreira.ts`
  (carrega career, handlers responder/escolher/excluir com persistência) —
  usado por /cidadela e /campus (antes /campus tinha `<CelularFixo/>` pelado).
- **Adsterra**: `AdsterraBanner` REANEXA o invoke script a cada montagem
  (ele executa 1x por carga e preenche o container do instante — remount
  deixava banner vazio; era o "carrega em alguns lugares e não em outros").
- **CSS**: `.phone-screen` com `height: min(74vh, 42rem)` — lista e chat
  rolam internamente; o aparelho não estica a página.
- **Limitações honestas**: fila em memória — F5 durante o drain perde as
  mensagens de flavor ainda não entregues (estado crítico persiste); vite dev
  atrás do proxy do work-host não hidrata (ambiental, confirmado no commit
  limpo) — auditar UI via Vercel. Testes: `JITI_TSCONFIG_PATHS=true
  ./node_modules/.bin/jiti test-conversas.mts` (38) + `test-entregas.mts` (9).
  `tsc --noEmit` 0 erros; `npm run build` OK.

## Onboarding obrigatório + Entrada Triunfal da Carreira + Marketplace (2026-08-20, 9ª passada re-aplicada)

- **Onboarding como máquina de estados persistente** (§7): `lib/onboarding/onboardingEngine.ts` (PURO, jiti-testável) com `OnboardingStage` (`nao-iniciado`→`identificacao`→`introducao`→`ambientes`→`sov`→`destino`→`primeiro-jogo`→`concluido`), `avancarStage`, `marcarDestino`, `responderPracinha` (IA ativa — corrige palavrão, rotas de destino por texto, fallback contextual sempre covia-no-norte); `lib/onboarding/onboardingApi.ts` (RPC `atualizar_estado_cidadela` para autenticado + localStorage `cidadela:onboarding:{anon|uid}`), `useOnboarding` (mutar() central). Gate `components/cidadela/OnboardingGate.tsx` envolve /cidadela, /campus e /gerador — novo usuário vê o tour obrigatório; usuário com `onboarding.concluido` entra direto (§33). O tour NUNCA exibe "Pular" (§31). `testes/onboarding-eng.test.mts` 22/22 OK.
- **Tour do Pracinha** (`components/cidadela/OnboardingTour.tsx`): celular premium full-screen com scroll (overflow-y-auto), AuthScreen embutida na fase de identificação, destino escolhido navega para a rota. Palavrão tem resposta de correção (§4).
- **Entrada Triunfal da Carreira** (`career/CareerIntro.tsx` + screen "career-intro" no BotaoGame): duas trilhas reais — **Treinador** (contrato com clube existente) ou **Proprietário** (compra clube no Marketplace). Persistida em `CareerState.modoEntrada`.
- **Marketplace (§13)**: `career/marketplaceClubes.ts` — `precoClube(clube) = power*5 × mult divisão` (determinístico, sem Math.random), `estrelasClube` 1-5 por power, `podeComprar`. Compra de clube: débito idempotente no SOV Bank (`transfer`, sourceEvent `compra_clube`, idempotencyKey `clube:compra:{id}:{uid}`), clube adquirido atualiza identidade do perfil via `atualizarPerfilClube`. "Feira" renomeado → "Marketplace" em CelularConversas/SovMarket/pracinhaCore. `testes/marketplace-clubes.test.mts` 11/11 OK.
- **Bug One Click — correção estrutural confirmada** (§21-28): guardas já existentes + reforço. `ControlledMonetagButton` usa `executionLockRef` + cooldown 3s (voltadeiya ao idle); `adManager.dispararMonetagUmaVez` = autorização de popup único cancelada por timer; `BotaoGame` falha `visibilitychange/pageshow` → `cancelarAutorizacao()` — nunca reexecuta após retorno da página. SOV Bank idempotente (`clube:compra`, `coletiva:{partidaId}`, `historia:cap{n}:{partidaId}`, `missao:{id}`). Estrutura verificada por `testes/onclick-guard.test.mjs` 19/19 OK.
- **Verificação**: `tsc --noEmit` 0 erros; `npm run build` OK; testes jiti end-to-end signaling OK.
- **Problema latent**: `agora` parâmetro não usado em `avancarStage` — remove ambientalmente e o jiti aprovou; checar quando crescer.

## Grupo Cidadela — fictício, 100% interno (2026-08-20, 8ª passada)

- **Correção de interpretação**: o "Grupo Cidadela" NÃO é WhatsApp/Evolution/
  webhook — é um **app fictício dentro do celular do jogo**. Nenhuma integração
  externa existe ou é necessária; a referência visual é só inspiração.
- **Membros reais do próprio app (§2/§5)**: RPC `cidadela_listar_membros()`
  (seção 7 de `tempo_cidadao.sql`) lista TODOS os cidadãos registrados (a RPC
  legada `cidadela_listar_jogadores` filtrava 30min e escondia quem saiu) com
  presença real computada (heartbeat ≤3min → ● online, senão ○), online
  primeiro. `grupoCidadao.listarMembrosGrupo` usa a nova com fallback na legada.
- **Mesmo user_id (§4)**: zero cadastro/identidade/autenticação paralela —
  o grupo lê `cidadela_jogadores_online` (mantida pelo heartbeat do Tempo de
  Cidadão) e o perfil lê `cidadela_perfil_publico`. Clique no nome → PerfilApp
  público (implementado na 7ª passada).
- **Grupo vivo (§6)**: `grupoCidadao.textoEventoGrupo` (PURO, determinístico
  via hash — retry não muda a fala) gera falas de NPCs (Valéria, Dirigente,
  Torcedor, Cícero Ramos, Helena Páginas) sobre eventos REAIS: resultado de
  partida da carreira, coletiva concluída (com o tom da declaração), sinal do
  acervo. Postadas em `cidadela_chat_messages` tipo 'sistema' (sender fictício,
  sender_id NULL) por `postarNoGrupoUmaVez(chave, evento)` no BotaoGame —
  guard `grupoPostadoRef` idempotente por partidaId.
- **Notificação (§7)**: `useNotificacaoGrupo` — poll leve (90s, só aba
  visível, só com o celular fechado), posição de leitura em localStorage
  (`cidadela:grupo:visto`, marcada também ao abrir o grupo), nunca notifica
  a própria mensagem nem o histórico. `💬 Nova mensagem no Grupo Cidadela`
  clicável + `tocarSom("mensagem")` → abre o celular já no GRUPO (prop
  `abaInicial` do CelularConversas). Fechar reseta a aba-alvo.
- **Verificação**: engine jiti 8/8; estruturais OK; `tsc --noEmit` 0 erros;
  `npm run build` OK.

## Tempo de Cidadão + Presença + Perfil + Sons (2026-08-20, 7ª passada)

- **`supabase/migrations/tempo_cidadao.sql`** (10ª migração, ordem no
  `migrations/README.md`): colunas `nome`/`bio` em `cidadela_perfis` (corrige
  bug latente — `cidadela_atualizar_status` lia `nome` inexistente); tabela
  `cidadela_tempo` (tempo_total_segundos, horas_recompensadas,
  primeira_entrada); RPCs `tempo_cidadao_heartbeat` (≤120s/chamada travado no
  servidor; 1h=+10 SOV via `sov_bank_registrar` chave `tempo:{user}:{hora}`;
  hora não paga se o teto barrar — retenta depois), `cidadela_perfil_publico`
  (só dados públicos; online = heartbeat ≤3min) e `cidadela_atualizar_perfil`
  (SÓ nome/bio — SOV/tempo/decisões nunca editáveis).
- **`lib/cidadela/tempoCidadao.ts`**: `useTempoCidadao(userId, onRecompensa)` —
  heartbeat 1x/min só com aba visível, líder entre abas via lock em
  localStorage (TTL 90s), `formatarTempoCidadao` ("10h 24min"). Montado no
  `CelularFixo` (cobre BotaoGame e /cidadela); recompensa → `tocarSom(
  "recompensa")` + badge "💰 +10 SOV · Tempo de Cidadão".
- **PerfilApp** (`components/cidadela/PerfilApp.tsx`): 9º app do celular —
  nome + ●ONLINE real, Tempo de Cidadão, entrada, partidas/missões (RPC),
  decisões/entrevistas (statsCarreira do BotaoGame), SOV (só no próprio
  perfil, via obterSaldoSov), bio editável inline. Grupo → clique no cidadão
  abre perfil público (`cidadela_perfil_publico`).
- **Sons centralizados** (`lib/notificacao.ts`): `tocarSom(categoria)` com 6
  categorias (mensagem/missao/recompensa/entrevista/noticia/pergaminho),
  WebAudio sem assets. `tocarNotificacao()` virou alias de "mensagem". A fila
  do celular mapeia conversa.tipo→categoria (Helena/John = "pergaminho").
- **Restauração pós-refresh (§20-22)**: `botao:resume:v1` em sessionStorage
  guarda matchEnd+destino por usuário (2h); refresh na tela de fim de partida
  → volta à mesma tela (entrevista reabre fechada, abertura idempotente).
  Removido ao sair da tela ou trocar de usuário.
- **Auditoria One Click**: entrevista (`!entrevistaAberta && !coletivaJaPaga`
  + `patrocinioPagoPartida` + chave `coletiva:{partidaId}` no SOV Bank),
  patrocínio (ControlledMonetagButton executionLockRef + cooldown 3s, volta
  ao idle), nova aba (adClickGuard consome autorização única; pageshow/
  visibilitychange invalidam o restante — sem reexecução). Grupo/WhatsApp:
  interpretação corrigida na 8ª passada (grupo fictício interno, nada externo).
- **Verificação**: 56 testes estruturais OK; `tsc --noEmit` 0 erros;
  `npm run build` OK.

## Finalização SOV BANK + História Principal John Adrian (2026-08-20, 6ª passada)

- **§2 correção de semântica**: 200.000 SOV = estoque econômico TOTAL da
  remessa (nunca por usuário); 50 SOV = bônus de cadastro. UI do SovBankApp
  deixa explícito; `sov_bank_stats` ganhou `transacoes_total` e
  `alertas_reconciliacao` (admin agregado na aba Economia).
- **Feira implementada** (`supabase/migrations/feira.sql`): `cidadela_itens`
  (pergaminhos), `cidadela_inventory`, `cidadela_market_listings`,
  `cidadela_item_grants` + RPCs `feira_publicar_oferta` / `feira_cancelar_oferta` /
  `feira_comprar` / `feira_conceder_item`. Compra = débito do comprador +
  crédito do vendedor via `sov_bank_registrar` (chaves `feira:compra:{oferta}:{uid}`
  / `feira:venda:{oferta}`), lock FOR UPDATE na oferta, preço sempre do banco.
  Schemas alinhados aos tipos JÁ existentes em `integrations/supabase/types.ts`
  (`raridade`, `comprador_id`). Stubs do pracinhaCore substituídos por RPCs reais.
- **Legado §6**: `salvarResultado` (lib/botao/api.ts) agora registra no ledger
  via `registrarTransacaoSov` (sourceEvent `salvar_resultado`) — se o morto
  OnlineMatchV2 for reativado, não cria SOV fora do banco.
- **História principal (John Adrian)** em `career/historia/`:
  - `types.ts`: `HistoriaState` (capítulo, pergaminhos, perfil, ledger,
    entrevistasProcessadas, posicaoFinal) + `ClassificacaoFonte` (7 classes,
    §19) + `DecisaoHistoria` (Narrative Ledger §29-30).
  - `referencias.ts`: banco de referências reais (USHMM/eugenia, Nuremberg,
    FEB/Arquivo Nacional, Jane Jacobs, Tesla/Smithsonian, Meyer=UNVERIFIED_CLAIM,
    tese de John Adrian=HYPOTHESIS). Nunca hipótese como fato (§33).
  - `pergaminhos.ts`: 8 fragmentos (perg-01..08), fragmento→referência→pergunta.
  - `historiaEngine.ts` (PURO, jiti): `processarGatilhoEntrevista` — gatilho
    ÚNICO = entrevista concluída (§20/§39), idempotente por partidaId, 1
    capítulo por entrevista; Helena (npc-bibliotecaria) entrega caps 1-3, John
    Adrian (NOVO `npc-john-adrian` em personagens.ts/NpcId) do cap 4; perfil de
    decisão acumulado dos tons (§21) varia o texto da revelação; post críptico
    p/ a Rede (§26); `registrarPosicaoFinal` = desfecho não-dogmático com 3
    posições (§28); `dicaInvestigacao` vaga de propósito (§27).
  - `ArquivoApp.tsx`: 8º app do celular ("Arquivo") — fragmentos com badge de
    classificação (fato/hipótese/ficção), referência e pergunta; desfecho com
    3 posições; estado final registrado.
  - Integração: `BotaoGame.concluirColetiva` chama o gatilho (após
    consequenciasEntrevista), entrega conversas na fila, registra SOV
    "Recompensa de investigação" (chave `historia:cap{n}:{partidaId}`, §31);
    `handleRegistrarPosicao` idempotente (`historia:desfecho:{uid}`).
    `careerStorage.normalizarHistoria` saneia JSONB antigo. Quem pula a
    coletiva não avança (§40) — carreira continua 100% jogável (§23).
- **Migrações**: `supabase/migrations/README.md` documenta ordem de aplicação
  manual + verificação (`SELECT * FROM sov_bank_config`).
- **Verificação**: 36 testes jiti da história + 31 estruturais da Feira OK;
  `tsc --noEmit` 0 erros; `npm run build` OK.

## SOV BANK — livro-caixa central da Cidadela (2026-08-20, 5ª passada)

Centralização e rastreabilidade da economia SOV (prompt mestre SOV BANK §1–§28).
Já existiam `user_wallets`/`bank_ledger`/`record_transaction`
(`sov_financial_system.sql`) — o SOV BANK NÃO recria, só reforça:

- **SQL `supabase/migrations/sov_bank.sql`** (aplicação manual no SQL Editor):
  - `sov_bank_config` (única fonte dos limites da 1ª remessa:
    `max_users_initial=100`, `max_sovereign_initial=200000`, `signup_bonus=50`).
  - `bank_ledger` ganha `idempotency_key`, `source_event`, `currency` ('SOV'),
    `balance_before` + índice único parcial `(user_id, idempotency_key)`.
  - RPC `sov_bank_registrar` = porta de entrada central: valida auth.uid,
    idempotência (mesmo evento → retorna existente, `duplicated=true`),
    teto de emissão (soma de créditos > limite → exception), usa
    `record_transaction` e enriquece a linha (origem/moeda/balance_before).
  - RPCs `sov_bank_extrato` (extrato rastreável), `sov_bank_reconciliar`
    (saldo vs SUM(amount); divergência → `anti_cheat_log`
    `reconciliation_mismatch`, NUNCA corrige), `sov_bank_stats` (estoque
    monetário agregado JSONB), `sov_bank_bonus_cadastro` (50 SOV idempotente
    `signup:{user}`; acima do limite de usuários não emite, não quebra o app),
    `sov_bank_noticias` (boletins derivados de dados reais do ledger).
  - **Bug corrigido**: `cidadela_resgatar_missao` creditava a carteira com
    UPDATE direto (SOV sem registro); agora passa por `sov_bank_registrar`
    com chave `missao:{missao_id}`.
- **Frontend**: `src/lib/financial/sovBankConfig.ts` (espelho dos limites p/ UI),
  `src/lib/financial/sovBankApi.ts` (extrato/stats/notícias/reconciliar/bônus).
  `registrarTransacaoSov` (sovApi) virou wrapper da RPC central com
  `opcoes?: {sourceEvent?, idempotencyKey?}`; fallback p/ RPC legada SÓ em
  erro PGRST202/42883 (função inexistente) — nunca em duplicidade/teto.
  `SovModule` estendeu com `'mission'|'system'`.
- **UI**: `components/financial/SovBankApp.tsx` — saldo, badge de reconciliação,
  últimas movimentações, abas Extrato/Notícias/Economia (dados reais).
  Virou 7º app-card "Banco" (ícone Landmark) no menu do `CelularConversas`
  (aba `"banco"`) — SEM segundo celular.
- **Chaves idempotentes em call sites**: coletiva `coletiva:{partidaId}`,
  dividendos `dividendo:{temporada}:r{rodada}`; bônus de cadastro chamado em
  `criarPerfilSeNaoExistir` (alinha cache inicial 50 ao ledger).
- **Gaps conhecidos (reportados, não corrigidos)**: `salvarResultado`
  (lib/botao/api.ts) muta `pontos_soberania` fora do ledger — só é chamado
  pelo morto `OnlineMatchV2`; `SovMarket` (Feira) lê saldo mas
  compra/venda são stubs (tabelas `cidadela_inventory`/
  `cidadela_market_listings` não existem em nenhuma migração);
  módulos mortos `careerManager/bettingSystem/recoverySystem/antiCheat`
  (lib/financial) não são importados por ninguém.
- **Verificação**: testes runtime Node (28 invariantes: config, SQL, chaves,
  wire-in do celular) OK; `tsc --noEmit` 0 erros; `npm run build` OK.

## Celular da Cidadela como overlay com menu de apps (2026-08-20, 4ª passada)

Reestruturação completa do celular (§1–§19 do prompt mestre). O botão Celular
no header da Cidadela e as cards de notificações (`PainelReputacao`/
`PainelMundo`) foram removidos — a Cidadela fica limpa e eventos chegam ao
celular. O CelularFixo virou overlay de tela cheia (`fixed inset-0`) com
container max-w-md, cabeçalho e botão Fechar. `CelularConversas` ganhou menu
inicial com 6 app-cards (Contatos / Rede / Missões / Grupo / Feira / Alertas)
em 2 colunas; abrir um app exibe header com voltar-para-menu. `AbaCelular`
estendeu com `"menu"` e `"contatos"` (alias para a lista de conversas);
badge de não-lidas no card Contatos (`naoLidasContatos`). Estado único de
aba; navegação interna por state sem remontar CelularFixo. Rota /cidadela
limpa — só puxa CelularFixo (botFixo sempre disponível, sem CelularConversas
inline). tsc 0 erros; build OK.

## Reestruturação do Modo Carreira — Prompt Mestre (2026-08-20, 3ª passada)

Implementação dos pontos §1–§34 do prompt mestre (personagens-IA, coletiva,
celular único, interface focada, economia/bolsa). Ordem: mapa completo →
tipos/engines → UI → integração no BotaoGame → testes jiti.

- **Jornalista/Bibliotecária/Dirigente são NPCs com systemPrompt** (§1-§2):
  `npc-jornalista` (Cícero Ramos), `npc-bibliotecaria` (Helena Páginas),
  `npc-dirigente` (Dir. Aldemir) em `career/rpg/personagens.ts`; `NpcId`
  estendido em `rpg/types.ts`. Compartilham o AIService (§32 — sem spaghetti de IA).
- **Entrevista Coletiva = IA-jornalista** (§6-§12): `career/entrevistaEngine.ts`
  com contexto escopado (§31: só dados da partida + declarações passadas
  públicas) via `contextoJornalista`/`gerarPerguntaJornalista` (persona IA
  > fallback procedural). `interpretarDeclaracao` classifica provocacao/
  humildade/orgulho/neutro + importância (§11). `registrarEntrevista` guarda
  na memória narrativa (`EventoNarrativo` em `career.memoriaNarrativa`, §5),
  idempotente por `partidaId`. `consequenciasEntrevista` (§12): provocação →
  reação do rival (rel-coes do `memoriaRpg`), headline e post no feed.
- **NADA de segunda entrevista** (§8): `EntrevistaPatrocinio` REMOVIDO; a
  coletiva descartada de `finishTournamentMatch` (Promise.all [coletiva,
  relMed, redes]) virou só `[relMed, redes]`. Única entrevista:
  `components/EntrevistaColetiva.tsx` (intro → q1 → q2 -> COLETAR).
- **onClick SÓ na coleta final** (§9): `concluirColetiva(declaracoes)` é o
  único disparo (recompensa SOV + registrarEntrevista + consequencias +
  persistCareer + fila). Idempotência: `patrocinioPagoPartida === partidaId`
  + guarda de partidaId no registrarEntrevista. ControlledMonetagButton só
  existe no rodapé da EntrevistaColetiva ("Apoie a imprensa") — nunca gateia
  o fluxo da entrevista.
- **Fila de mensagens do celular** (§13-§14): `filaConversasRef` +
  `filaProcessandoRef` no BotaoGame; `enfileirarConversas(novas)` entrega uma
  por vez (2.6s), com toast `📱 Nova mensagem: {nome}` + som `tocarNotificacao()`
  (`src/lib/notificacao.ts`, WebAudio). Relatório médico/redes sociais e
  reações da entrevista SÓ chegam por essa fila.
- **UM celular** (§15): telas `celular`, `celular-conversas` e `suborno`
  REMOVIDAS do Screen. `CelularFixo` ganhou props `prioridade` (ReactNode —
  renderiza SubornoStory/NarrativeModal/ChoiceModal quando há decisão pendente,
  calculados no BotaoGame via `prioridadeCelular`) e `naoLidas` (badge).
  CareerHub sem card/celular interno. `aplicarEscolha` volta ao `hub`.
- **Interface focada** (§16-§18): CareerHub com botões compactos (menu-card
  com icon) Calendário/Bolsa/Tabela → cada um abre em tela própria (`calendario`,
  `economia`, `classificacao` = Screen). Classificação resumida top-5 +
  ZoneLegend. CoachSetup subtítulo reduzido para 1 linha curta.
- **Bolsa de Valores da Cidadela** (§22-§26): `career/bolsaEngine.ts` —
  ATIVOS = clube/ciencia/biblioteca/trilha nomes/fix/setores/yield/cap.
  `evoluirBolsa(bolsa, imp)`: drift determinístico por rodada (`ruidoRodada`
  hash) para setores não-clube; clube reage ao resultado/moral; eventos do
  mundo (crise/cartorio/ritual/provocação/ciência) impactam setores.
  atualiza `patrimonioCidadela`. `pagarDividendos` a cada 3 rodadas,
  idempotente por rodada via `ultimaRodadaBolsa`. `comprarAtivo`/`venderAtivo`
  atualizam carteira com custo médio. Integrado em `finishTournamentMatch` do
  bloco career (antes do persistCareer). Compras/vendas/dividendos passam
  pelo ledger SOV com module `'market'`. `EconomiaScreen.tsx` é a tela do
  módulo (patrimônio da Cidadela + carteira + fila de transações).
- **Pré-existentes corrigidos** sem regressar: `CelularFixo` import ruim
  (`./lib/cidadela/profissoes` → `@/...`), `CelularConversas.onLogin` tipo
  (`| undefined`), `rpgEngine` msgTimestamp indefinido em `aplicarEscolhaRpg`,
  RPCs `cidadela_atualizar_status`/`cidadela_listar_jogadores` agora tipadas
  em `integrations/supabase/types.ts`.
- **Verificação**: `tsc --noEmit` 0 erros, `npm run build` OK. Engines com
  testes jiti runtime (coletiva provocação→rival reage/memória salva;
  idempotência; bolsa determinística/compra/venda/dividendos idempotentes).

## Auditoria integral do Modo Carreira (2026-08-20, 2ª passada)

- **Ritual da Trilha é notificação do celular, não card**: `CareerHub` NÃO tem
  mais card da Trilha nem `PainelMundo` (o elemento azul "Crise Financeira na
  Cidadela" — world state global — ficou exclusivo da rota /cidadela). O
  convite chega via `convidarRitualTrilha(career)` (trilhaIntegracao.ts) como
  `ConversaCelular` do NPC **Pracinha** (`npc-pracinha`, novo personagem em
  rpg/personagens.ts + 4º contato-base em `garantirContatosRpg`), com
  `ConversaCelular.linkExterno` {rotulo,to} renderizado no CelularConversas.
  Idempotência por rodada: id determinístico `ritual-trilha-{temporada}-r{rodada}`.
  Gatilhos: hidratação da campanha + fim de cada partida da liga.
- **Navegação**: o Futebol de Botão NUNCA abre a Carreira automaticamente —
  `hidratarCampanha` sempre restaura o estado e volta ao `menu` (antes: ia ao
  `hub` quando a campanha estava ativa). CareerMenu → "Continuar Campanha" → hub.
- **Persistência real**: `careerStorage.normalizarCareer(bruta)` saneia o JSONB
  (conversas/headlines/ultimasEscolhas/feedCidadela arrays, divisao válida,
  clamps de moral/soberania) — aplicado em `loadCareerFromSupabase`. Sem isso,
  carreiras antigas quebravam o celular e o CareerMenu (divisao null).
  Mensagens IA pós-jogo agora passam por `persistCareer` (antes: setCareer sem
  persist → sumiam no refresh e corrompiam o snapshot). `garantirContatosRpg`
  roda também na hidratação (contatos existiam só no cadastro do técnico, por
  isso o celular de carreiras antigas abria vazio).
- **Classificação Completa é tela própria**: screen `classificacao` +
  `career/ClassificacaoScreen.tsx` (menu esquerdo: Classificação, Artilheiros,
  Menos gols sofridos, Maiores goleadas, Copa do Brasil; painel direito com
  tabs de divisão; dados reais via sortTable/groupFixtures). `ZoneLegend` passou
  a morar nela. `ChampionshipModule.tsx` e `StatsModule.tsx` foram REMOVIDOS.
- **Bug de reexecução pós-anúncio**: fluxo único — ControlledMonetagButton
  (confirm modal) → Monetag (portão one-shot) → abre entrevista ONCE por
  partida. `MatchEndData.partidaId` único por partida; BotaoGame guarda
  `patrocinioPagoPartida` (estado) e `concluirPatrocinio` é idempotente
  (recompensa paga 1x). `adClickGuard` agora chama `cancelarAutorizacao()` no
  retorno (visibilitychange=visible + pageshow) — a volta do anúncio nunca
  reexecuta a ação anterior. MatchEndScreen sem o passo "Liberar Entrevista".
- **Contrato front↔back real**: RPC `registrar_transacao_soberania` retorna
  `TABLE(balance)` — `registrarTransacaoSov` (sovApi) estava esperando number
  plano e caía sempre em fallback; agora aceita array `[{balance}]`. Nenhuma
  tabela/coluna/RPC nova foi necessária (schema já cobre o fluxo).
- **Rótulos**: "Sovereign"/"sovereign" em UI virou "Soberania" (Portuguese UI) —
  MatchEndScreen, CareerMenu, SovereigntyPanel, SeasonHub, SeasonTransition,
  TitleCeremony, ProfileSetup, LeaderboardTreinadores, OnlineMatchV3, SeoContent,
  CidadelaIntro, /cidadela. Campos do DB (`pontos_soberania`, `user_wallets`)
  já estavam corretos. Nomes internos do Banco Central (`SovereignBank` em
  src/lib/financial) permanecem (proper noun do módulo legado, fora de UI).
- **Verificação**: engines testados runtime com jiti (convite idempotente por
  rodada, 4 contatos-base, normalização com dados ruins). `tsc --noEmit` 0 erros,
  `npm run build` OK.

## Modo Carreira integrado ao Campus — nomenclatura e audição (2026-08-20)

- **Nomenclatura**: "Estádio do Campus" (header/menu principal do BotaoGame),
  "Carreira no Campus" (MenuCard principal, CareerMenu, CoachSetup) e
  "Campeonato do Campus" (subtítulo/módulo/loading). Rótulos visíveis usam
  "Soberania" (pt-br); v. nota de 2026-08-20 (2ª passada).
- **CareerHub**: NÃO integra mais `PainelMundo` (removido junto com o card do
  Ritual — v. nota mais recente). Classificação resumida (top 5) abre a tela
  dedicada `ClassificacaoScreen`. Copa do Brasil tab visível em todas as
  divisões (era gated em série-a — bug legado do módulo antigo).
- **Auditoria RPG/celular (jiti)**: engines puros testados runtime —
  `garantirContatosRpg` (4 contatos iniciais: Valéria, Dona Cida, Zé, Pracinha),
  `processarEventosRpg` (gatilhos + espaçamento de 3 rodadas),
  `aplicarEscolhaRpg`, narrativa dinâmica (fecha em <=3 avanços), suborno,
  patrocinador (`cumpriuDesafio(desafio, golsPro, golsContra)`), choicesEngine
  (`sortearEvento(idsUsados: string[])`). Cadeia no BotaoGame:
  `atualizarSequenciaRpg` → `anexarPost` (Rede) → `processarEventosRpg` →
  `convidarRitualTrilha` → `preparaEscolha` → `aplicarDesafioPatrocinador` a
  cada partida; `handleEnviarMensagem` → `responderContatoNpc`;
  `handleEscolhaRpg` → SOV ledger + cartório link.
- **Aviso ambiental**: `vite dev` no proxy do work-host quebra a hidratação
  do entry `@tanstack/react-start` (SSR via curl funciona) — auditar UI por
  curl/jiti ou no dashboard Vercel. `tsc --noEmit` 0 erros, `npm run build` OK.
- **Fix extrínseco**: `src/routes/campus.tsx` tinha erro de tipo pré-existente
  (`section.disabled` não tipado) — declarado tipo com `disabled?: boolean`.

## Soberania unificada com Banco Central SOV + Cartório — 2026-08-19

- **Fonte de verdade da soberania**: `user_wallets.balance` (SOV) via `bank_ledger`.
  `botao_usuarios.pontos_soberania` virou cache/backup. API unificada em
  `src/lib/financial/sovApi.ts`: `obterSaldoSov`, `registrarTransacaoSov`,
  `historicoTransacoesSov`, `garantirCarteira` (chamada no primeiro login em
  `useBotaoAuth`). Source modules: 'career', 'rpg', 'online', 'market'.
- **Todos os pontos de mutação de soberania** registram no ledger:
  storage.ts (liga, online, vídeo/reward), careerRemote.ts (resultado, bônus de
  posição de fim de temporada, apostas online), BotaoGame (desafio de
  patrocinador amistoso/carreira, Copa do Brasil, narrativa dinâmica, suborno,
  choice events com impactoFinanceiro/penaltyPontos, Ritual da Trilha — este
  último usa `perfilRef` pois roda dentro de useEffect com deps vazias).
  Escolhas RPG (`handleEscolhaRpg`) usam source 'rpg' com metadata
  {eventoId, escolhaIdx, npcId}.
- **NUNCA reintroduzir** delta local de soberania no bloco de carreira de
  `finishTournamentMatch` — `aplicarResultadoRemoto` já devolve o saldo
  autoritativo do ledger; somar localmente causava double-count.
- **Cartório** (`src/components/botao/cartorio/` + `career/rpg/cartorioApi.ts`):
  3 eventos RPG (`contrato-pendente`, `peticao-necessaria`, `multa-judicial`)
  com efeito `cartorio` na `EscolhaRpg` criam pedido em `cartorio_pedidos`
  (RPC `criar_pedido_cartorio`) e anexam `linkCartorio` na conversa do celular
  (renderizado como Link em `CelularConversas`). Biblioteca abre o formulário
  via query params `?acao=contrato|peticao|multa&pedidoId=...`
  (`validateSearch` em `routes/biblioteca.tsx`). IA Bibliotecária
  (`SYSTEM_PROMPT_BIBLIOTECARIA` em `cartorioTypes.ts`) gera o documento salvo
  em `cartorio_documentos` (RPC `salvar_documento_cartorio`) e o pedido é
  concluído (`concluir_pedido_cartorio`).
- **SQL**: `supabase/migrations/sov_integracao_cartorio.sql` — RPCs
  `registrar_transacao_soberania`, `obter_saldo_soberania`,
  `historico_transacoes` + tabelas/RPCs do cartório. Depende de
  `sov_financial_system.sql` (create_or_update_wallet/record_transaction).
  Aplicação manual via SQL Editor.
- **Ads**: `adManager.ts` aceita `VITE_ADSTERRA_INVOKE_URL` (override do invoke
  URL), `getAdsterraSrc()`, `loadMonetagOnDemand()`, diagnóstico exposto em
  `window.adManager`. `AdsterraBanner` no branch passivo agora realmente injeta
  o script (antes só reservava espaço — bug que impedia os banners de
  aparecer). Monetag on-click SÓ em botões com aviso (`ControlledMonetagButton`):
  dentro do celular (tela principal), na classificação e na nova tela de fim
  de jogo.
- **Tela de fim de jogo** (`components/MatchEndScreen.tsx`, `MatchEndData`):
  placar, resultado, gols, Δsoberania/Δmoral, posição na tabela, "extra"
  (campeão), botão Continuar + bloco "Patrocínio" (Adsterra + Monetag).
  `BotaoGame` mantém `matchEnd`/`matchEndDestino` e a renderiza após
  amistoso/liga/copa (liga captura `patchSob/patchMoral/posTabela` no bloco de
  carreira).
- **Teste runtime**: módulos RPG testáveis com
  `JITI_TSCONFIG_PATHS=true ./node_modules/.bin/jiti <teste.mts>` (jiti resolve
  o alias `@/` do tsconfig). `selecionarEvento` NÃO é exportado do rpgEngine —
  testar via `processarEventosRpg`/`aplicarEscolhaRpg`. Stub mínimo de career
  precisa de `headlines: []` e `memoriaRpg: null`.

## Reconstrução da Carreira Infinita (Futebol de Botão) — 2026-08-18

- Base canônica de times em `src/components/botao/data/teams.ts`: 60 clubes ficcionais, IDs únicos/persistentes, 20 por divisão (A=88..71, B=71..48, C=48..28). Reuse esses IDs — evita conflitos e sobrescrição na base.
- `career/seasonEngine.ts` gera 3 ligas por temporada usando o pool completo. A liga ativa do usuário usa os 19 NPCs divisão + usuário. Nunca derivar campeão com colchete sem nullable.
- Copa do Brasil usa pool de 15 NPCs das três divisões + usuário; não há bloqueio por Série A na rodada-gatilho.
- `career/careerRemote.ts` agora usa persistência híbrida: snapshot em `progresso_caminpanha` + histórico relacional pelas RPCs `registrar_temporada_carreira`, `registrar_partida_carreira`, `finalizar_temporada_carreira`, `registrar_evento_carreira`. TODAS falham silenciosamente para carreiras antigas.
- `supabase/migrations/futebol.sql` adiciona `forca`/`divisao` em `botao_times`, 60 seeds e tabelas `botao_temporadas_carreira`, `botao_partidas_carreira`, `botao_tabelas_carreira`, `botao_eventos_carreira`. Aplique manualmente via SQL Editor (sem CLI/service-role).
- `AIContext` agora aceita `divisao`, `temporada`, `competicaoNome`, `moralTime`, `soberania`, `posicaoTabela`, `rodadasRestantes`, `decisaoPendente`. `AIService`/`templateEngine` preenchem esses placeholders (`{divisao}`, `{temporada}`, `{posicao}`, `{moral}`, `{soberania}`, `{restantes}`, `{pendencia}`).
- `atualizar_perfil_clube` deve ter 7 parâmetros (sem `p_escudo`) — remover `p_escudo` do frontend/types evita falha de produção.

<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Setup Supabase sem mock — 2026-08-18
- `src/integrations/supabase/client.ts` é env-driven (`VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`/`VITE_SUPABASE_PUBLISHABLE_KEY`; SSR aceita sem
  `VITE_`) e **não usa mock**. Se faltar config, `isSupabaseConfigured()` é
  false, `getSupabaseConfigError()` explica e qualquer uso do proxy `supabase`
  lança erro limpo.
- `useBotaoAuth` depende do evento `INITIAL_SESSION` de `onAuthStateChange`
  (não chamar `getUser()` antes, pois isso causava loading infinito).
- `entrar()` deve retornar o perfil (`Promise<Perfil | null>`). Tela login
  precisa chamar `onPronto(perfil)`; `onPronto(undefined)` é reservado para
  logout/exclusão de conta.
- `/cidadela` lê `localStorage` só no cliente (`hydrated` gate) para evitar
  erro SSR/hidratação. `vite dev` atrás do proxy do work-host pode falhar no
  entry `@tanstack/react-start` (ambiental); validar com curl ou build.
- Validação atual: `tsc --noEmit` 0 erros; `npm run build` OK (preset Nitro
  `vercel`; ESLint global ainda tem dívidas Prettier em arquivos antigos não
  tocados).


## Sistema de IA Centralizada (AIService) — 2026-08-18

Arquitetura da "Comentarista Sarcástica" (voz do jogo), on-device + fallback
procedural. Custo ZERO de API.

### Módulos (`src/components/botao/ai/`)
- `AIService.ts`: fachada singleton `AIService.generateText(ctx, promptType)`.
  Detecta hardware; se `potente` e a lib `webllm` estiver disponível, usa IA
  local (SmolLM2-360M/Qwen2.5-0.5B). Senão, cai em `gerarTemplate` (procedural).
  `AIService.init()` pré-aquece o veredito de hardware. Estrutura modular/
  expansível para outros modos.
- `hardwareDetect.ts`: `detectarHardware()`/`vereditoHardware()` testam
  `navigator.deviceMemory`, `hardwareConcurrency` e WebGPU (`gpu` no adapter).
  Veredito: `"potente"` (≥4 cores, ≥4GB, WebGPU) | `"fraco"`.
- `templateEngine.ts`: `gerarTemplate(promptType, ctx)` — busca frases em
  `botao_frases_ia` (Supabase, cacheado) e preenche placeholders `{T},{coach},
  {W},{L},{gH},{gA},{diff}`. Fallback local se a tabela estiver vazia/offline.
- `aiContent.ts`: `coletivaPosJogo`, `relatorioMedico`, `redesSociaisRodada`,
  `bundlePosJogo` — reaproveitam o AIService (item 8 do spec: coletiva, médico,
  redes sociais). Disparados no `finishTournamentMatch` (fire-and-forget) e
  anexados como `ConversaCelular` (tipo `"medico"`/`"evento"`).
- `types.ts`: `PromptType` (`comentarista|coletiva|medico|redes_sociais|noticia`),
  `AIContext` (todos os campos `| undefined` por `exactOptionalPropertyTypes`),
  `SYSTEM_PROMPT_COMENTARISTA`.

### SQL (`supabase/migrations/futebol.sql`)
- Tabela `botao_frases_ia` (prompt_type, categoria, template_text, ativo, ordem)
  com unique index `(prompt_type, categoria, ordem)` para seed idempotente
  (`ON CONFLICT (...) DO NOTHING`). RLS read-all (anon+authenticated). Seed com
  ~20 frases sarcásticas. **Aplicação obrigatória pelo usuário no SQL Editor.**

### Pacote opcional `webllm`
- NÃO é dependência obrigatória. Importado dinamicamente com especificador em
  variável + `/* @vite-ignore */` (`const modName="webllm"; import(modName)`),
  para o bundler (rolldown/vite) não tentar resolver estaticamente e quebrar o
  build. Declaração de ambiente em `src/types/webllm.d.ts` silencia o tsc.
  Se ausente em runtime → catch → fallback procedural. **Zero Crash Guarantee.**

### Tipos Supabase (`src/integrations/supabase/types.ts`)
- Adicionada tabela `botao_frases_ia` (Row/Insert/Update) ao `Database.Tables`.

## Splash/Loading + Portal de Notícias — 2026-08-18
- `LoadingScreen.tsx`: overlay 100% CSS/JS, zero imagens. Barra 0→100%
  (easeOutCubic), `%` animado, textos introdutórios/dicas REAIS rotativos
  (soberania, celular, W.O., portal). Props `passos`/`intros`/`duracao`/
  `onCompleto`. Integrado no `BotaoGame` via estado `loading` + `runWithLoading`
  (início de carreira, entrada em campo). Renderizado no Shell.
- `NewsPortal.tsx`: carrossel continuous-loop (avança a cada 3.5s), mescla
  `headlines` reais da carreira + notícias IA geradas via `AIService` (noticia).
  Substituiu o bloco estático "Últimas Notícias" no Hub.

## Hotfixes UI/UX — 2026-08-18
- `CareerMenu`: opção "Nova Carreira" (Plus icon) além de "Carregar".
  Prop `onNewCareer` → `handleNewCareer` no BotaoGame. Props alinhadas
  (`onSaveCampaign` — antes `onSaveCareer` causava mismatch).
- `Screen` type: adicionados `"career-menu"` e `"celular-conversas"`.
- Bug do celular: removida mensagem automática padrão que travava a tela;
  `CelularConversas` robusto (guards, conversa virtual de patrocinador,
  inicia limpo — só notificações de eventos reais).

## Economia & Regras — 2026-08-18
- `POINTS`: V=+3, E=+1, D=0. `bonusCampeao(dificuldade)` → 100-200 Soberania.
  `careerRemote.computeSovereigntyDelta` D=0; `aplicarFimCampanhaRemoto`
  bonusPos 100-200.
- Promoção/rebaixamento por divisão: Série C (2 sobem), Série B (2 sobem/2
  caem), Série A (rebaixa últimos, vagas Copa/Libertadores).
- Calendário unificado (`CalendarView`): mescla Brasileirão + Copa do Brasil
  numa linha do tempo (`COPA_RODADAS_GATILHO`).
- Tabela: colunas P J V E D GP GC SG.
- AdSense no intervalo (`MatchView`): estado `halftime` + overlay `AdSlot` no
  meio das jogadas (container formato TV, classes `halftime-tv-*`).
- Sanções: `Choice` com `wo`/`desfalqueBotao`/`perdaPontos`/`impactoFinanceiro`;
  `CareerState` com `woProximaPartida`/`desfalqueBotaoProxima`/
  `perdaPontosProxima` (reset em nova carreira/fim de partida).

## TypeScript — verificação (2026-08-18)
- `tsc --noEmit`: 0 erros fora do módulo `trilha` (que tem 10 erros
  pré-existentes: tabelas/RPCs `mesas_trilha` não tipadas no Supabase —
  independentes desta tarefa). `vite build`: OK.


## Módulo Online (Futebol de Botão) — como funciona

O modo Online foi liberado (sem telas de "Em breve"). Há dois modos:

- **Amistoso Online** (`screen="online"` -> `OnlineMatchV3`): cria/entra numa
  `mesas_futebol` e joga em tempo real via `MesaRealtime`.
- **Campeonato Online** (`screen="online-championship"` -> `OnlineChampionship`):
  sala round-robin com até 8 jogadores; cada confronto vira uma mesa.

### Camada de dados (Supabase)
- Tabelas: `mesas_futebol` (colunas `modalidade`, `campeonato_id`) e
  `botao_campeonatos_online`. Schema em
  `supabase/migrations/futebol_campeonato_online.sql` (após `futebol.sql`).
- RPCs de campeonato: `criar/entrar/sair/iniciar_campeonato_online`,
  `vincular_mesa_campeonato`, `registrar_resultado_campeonato`.
- Frontend: `src/lib/multiplayer/campeonato.api.ts` e `mesa.api.ts`.
- `MesaRealtime` ganhou `trocarTurno()` e `finalizarPartida()`.

### Componentes
- `components/botao/components/MesaOnlineMatch.tsx`: wrapper reutilizável da
  partida online (placar/turno/cronômetro/início/fim). Emite `onFinalizada`
  com `{ vencedorId, golsJ1, golsJ2, empate }`.
- `OnlineMatchV3` e `OnlineChampionship` usam `MesaOnlineMatch`. Ao finalizar,
  o perfil é recarregado para refletir soberania/ranking (RPCs autoritativas).

### Observação de tipos
As chamadas `.rpc("...")` geram erros `TS2345 ... 'never'` porque
`Database["Functions"]` estava tipado como `[_ in never]: never`. Esse padrão já
existia em `mesa.api.ts`/`useBotaoOnline.ts` e não impede o build (Vite/esbuild
ignora tipos). Para silenciar definitivamente, tipar as RPCs em
`src/integrations/supabase/types.ts` — **FEITO (commit c188adc)**: `Functions`
agora declara todas as RPCs usadas (criar/entrar/sair/iniciar campeonato,
vincular/abrir mesa campeonato, registrar_resultado, criar/entrar mesa,
registrar_jogada/gol/heartbeat, abandonar, tempo_restante, iniciar_partida,
blocos, limpar_salas). Assinaturas alinhadas ao SQL em
`supabase/migrations/futebol.sql`.

## TypeScript — correções estruturais (commit c188adc, 2026-08-17)

- `tsconfig.json`: `strict`, `noUncheckedIndexedAccess` e
  `exactOptionalPropertyTypes` ligados. Consequências comuns:
  - `arr[i]` é `T | undefined` → sempre fazer fallback (`x || default`).
  - Props opcionais `onBack?: () => void` exigem `(() => void) | undefined`,
    não `(() => void)?` implícito.
- `botao.functions.ts` (TanStack Start `createServerFn`): handlers validados
  devem desestruturar de `ctx.data`, NÃO do `ctx` top-level:
  `.handler(async ({ data: { nome, ... } }) => ...)`. Sombrear `data` com
  `const { data } = await supabase...` dentro do handler é seguro.
- `MatchView.tsx`: `onJogadaAdversaria`/`onFimDeTurno`/`onGolAdversario` são
  **registradores de callback** `(handler: (payload) => void) => void`, não
  notificadores diretos. O pai `MesaOnlineMatch` registra o handler e depois
  invoca via `fimDeTurnoHandlerRef.current(payload)` quando o realtime entrega
  o payload.
- `BotaoGame.tsx`: `screen !== "auth"` é redundante após o early-return
  `if (screen === "auth") return ...` — TS sinaliza "no overlap". Remover a
  guarda. Para narrowing de `t: Tournament | null` em guards com optional
  chaining (`if (perfil?.user_id && t)`), extrair `const uid = perfil?.user_id`
  antes para o TS aplicar control-flow narrowing.
- `tsc --noEmit`: **0 erros** | `vite build`: OK.

## Modo Carreira — refatoração UI/UX + correções (2026-08-18)

### Fundação
- `CareerState` em `types.ts` ganhou `Divisao = "serie-a" | "serie-b" | "serie-c"` e
  campo `divisao: Divisao | null`. Imports mortos de `seasonApi`/`seasonTypes`
  removidos de `BotaoGame.tsx`. `tsc --noEmit` 0 erros.

### Camada de competições (`career/competitionApi.ts` — NOVO)
- `resolveTeam(teamId, userTeam)`: devolve `userTeam` só quando `teamId === userTeam.id`,
  senão `teamByIdSync(teamId)`. **Corrige o bug "FB vs FB"** — antes o `getTeam` do
  `ChampionshipModule` retornava sempre `userTeam` para qualquer id.
- `calcularStats(tour, userTeam)`: estatísticas REAIS derivadas da tabela e partidas
  disputadas (artilheiro = maior `gp`, goleiro = menor `gc`, maior goleada = maior
  diff em `groupFixtures` jogados). Usa `for...of` (não `forEach`) para o TS acompanhar
  o narrowing do acumulador mutável.
- `gerarCopaBrasil(userTeam, difficulty)`: mata-mata de 16 times. 2ª fase definida,
  fases seguintes como confrontos TBD (placeholders) que se resolvem ao avançar.
  Rounds ganham rótulos em `COPA_BRASIL_STAGES` para o calendário.
- `dataDaRodada(indice)`: data simbólica (hoje + indice×7 dias) p/ o calendário.
- `DIVISAO_LABEL`/`DIVISAO_SHORT`: mapas `Record<Divisao, string>`.

### Navegação de campeonatos (`ChampionshipModule.tsx`)
- Submenu funcional: **Copa do Brasil** | **Brasileirão**.
- Ao selecionar Brasileirão, abre sub-toggle Série A/B/C (default = divisão do
  usuário, marcada com badge "você"). Estatísticas centralizadas no `StatsModule`.

### Estatísticas centralizadas (`StatsModule.tsx` — estilo PS2)
- Painel único (`stats-panel`) com 3 módulos/cards distintos: Artilharia,
  Defesa menos vazada, Maior goleada. Acento de cor por divisão
  (`DIVISAO_ACCENT` — emerald/sky/fuchsia). Props: `{ title, stats, divisao }`.

### Calendário (`CalendarView.tsx`)
- Filtro de competição (Brasileirão | Copa do Brasil). Mostra rodadas da liga
  + rounds da Copa do Brasil com datas. Props: `{ tour, userTeam, currentDivisao, copaBrasil }`.

### Decisões do jogo → celular/chat em 1ª pessoa
- `playNext` agora roteia decisões pendentes para a tela `celular` (não mais
  narração bloqueante "⚠ Decisão pendente"). Tela `celular` (NOVA em `Screen`) é
  inbox unificado: prioriza `eventoPendente` (chat), senão mostra `suborno`.
- `ChoiceModal.tsx` reescrito como chat de celular (phone-frame, bolhas, avatar
  do remetente). `SENDER` mapeia cada `ChoiceEvent.id` a um remetente/cargo.
- `choicesEngine.ts`: descrições reescritas em **1ª pessoa** diretas ao treinador
  ("Treinador, aqui é o Dr. Maurício..."), nunca mais narração em 3ª pessoa.
- Tela antiga `choice` removida (superseded pela `celular`). Tela `suborno`
  mantida como fallback.

### UI/UX premium (`styles.css` — design system novo)
- Classes: `next-match-card`, `celular-card`, `comp-tab`/`div-tab`, `stats-panel`/
  `stat-card` (gold/green/flame), `zone-row` (libertadores/copa-brasil/rebaixamento),
  `phone-frame`/`phone-bubble`/`phone-reply`, `cal-rodada`/`cal-jogo`,
  `copa-phase-chip`, `menu-card` (accents gold/sky/emerald/fuchsia/amber),
  `sovereignty-panel`/`stat-tile`. Usa `color-mix(in oklab, ...)` e `oklch()`.
- `Hub` reescrito: 2 colunas (`lg:grid-cols-[1fr_1.1fr]`) sem blocos vazios;
  stats duplicadas removidas (centralizadas no `ChampionshipModule`).
- `MenuCard` ganhou prop `accent` e barras de cor laterais. `SovereigntyPanel`
  redesenhado como hero com tiles e barra de progresso.

### Verificação
- `tsc --noEmit` → 0 erros. `vite build` → OK.
- O `vite dev` sob o proxy do work-host exibe erro de hidratação do
  `@tanstack/react-start/.../client.tsx` — **ambiental, não relacionado ao código**
  (não ocorre no build de produção). Verificar no dashboard Vercel.

## Deploy Vercel — observação importante

O script `build` é só `vite build` (não roda `tsc`). Ainda assim, o Vercel
aparentemente executa checagem de tipos e/ou falha quando `tsc` tem erros.
Após o commit `c188adc` (tsc 0 erros) enviado para `origin/main`, o Vercel
**não criou novo deployment** em ~6 min, embora pushes idênticos anteriores
(`02896bf` etc.) tenham disparado deploys em segundos. Repositório não tem
webhooks GitHub (Vercel usa GitHub App). Sintoma = integração Git do Vercel
parou de responder — exige verificação no dashboard Vercel (limite do plano
Hobby, reconexão do repo, ou branch de produção desconfigurada). Não é
problema de código: `tsc` e `vite build` passam localmente.

## Campeonato Online — RPC `abrir_mesa_campeonato` (400)

**Sintoma:** ao clicar "Jogar" num confronto do Campeonato Online, a RPC
`abrir_mesa_campeonato` retorna HTTP 400 ("nenhum confronto pendente encontrado
para voce nesta rodada") para AMBOS os jogadores, repetidamente.

**Diagnóstico (reproduzido com usuários de teste):** o confronto no JSONB estava
válido (`status='pendente'`, `rodada=rodada_atual`, `j1_id`/`j2_id` = auth.uid()
dos participantes). A versão original da função casava via cast
`(v_item->>'j1_id')::UUID = v_uid` (UUID = UUID) + indexação manual
`v_confrontos[v_i + 1]` em FOR loop. Já `entrar_campeonato_online` (que
funciona) casava via `el->>'user_id' = v_uid::TEXT` (texto = texto).

**Correção** (`supabase/migrations/20260817000000_fix_abrir_mesa_campeonato.sql`
+ espelho em `futebol_campeonato_online.sql`): reescrita set-based com
`jsonb_array_elements WITH ORDINALITY`, comparação por TEXTO
(`t.item->>'j1_id' = v_uid::TEXT`), `COALESCE(jsonb_array_length, 0)` contra
NULL, e mensagens de erro com uid/total para diagnóstico. Adicionada RPC
`debug_confronto_campeonato` que retorna o estado de cada confronto sob a ótica
do usuário (pode ser removida após estabilizar).

**Aplicação obrigatória:** como o workspace não tem `service_role` nem
`supabase` CLI, a migração NÃO é aplicada automaticamente. O usuário deve colar
o conteúdo de
`supabase/migrations/20260817000000_fix_abrir_mesa_campeonato.sql` no **SQL
Editor do Supabase** e rodar. Sem isso, o Campeonato Online continua quebrado
(não há workaround no frontend — a criação da mesa depende desta RPC).

## Modo Carreira (single-player) — arquitetura (2026-08-18)

Reatoração completa do modo carreira com sistema narrativo dinâmico (suspense/
drama em 1ª pessoa via celular), economia de Soberania e temporada infinita.

### Núcleo
- `career/types.ts`: `CareerState` com `bonusProximaPartida`,
  `penaltiesProximaPartida`, `moralTime`, `narrativa`, `suborno`, `copaBrasil`,
  `temporada`, `divisao`, `rodadasDesdeEventoNarrativo`, `vereditoTemporada`.
  Props opcionais tipadas como `| undefined` (necessário por
  `exactOptionalPropertyTypes`).
- `career/competitionApi.ts`: `calcularStats()` (artilheiro/goleiro/
  maiorGoleada reais da tabela), `CopaBrasilState` com chaveamento de 16 times
  (4 fases: Oitavas/Quartas/Semifinal/Final), `COPA_RODADAS_GATILHO=[4,9,14,18]`,
  `avaliarFimTemporada`/`iniciarNovaTemporada` (custo de manutenção por divisão),
  `CUSTO_MANUTENCAO` (serie-a=120, serie-b=80, serie-c=50).
- `career/narrativeEngine.ts`: gera histórias com persona × gancho × reviravolta.
  `gerarNarrativa` → `cenaDaNarrativa` → `avancarNarrativa`. Arco de 2 cenas
  (raiz → desfecho). Final cenas têm `final: true` + `desfecho`.
- `career/NarrativeModal.tsx`: UI de chat no celular. Cenas finais exibem um
  botão "Concluir" sintético (`id:"concluir"`, sem `proximoId`, com `desfecho`)
  que dispara `avancarNarrativa` retornando `finalizado=true` + registra headline.
- `career/SeasonTransition.tsx`: veredito de fim de temporada (continua/falência).
- Persistência do torneio/carreira: todo patch de `progresso_caminpanha` deve
  passar por `mergeProgressInSupabase` (`storage.ts`), que serializa escritas por
  usuário e preserva chaves (`career`, `tournament`, gols). Não fazer update do
  JSONB inteiro — isso apagava a carreira/torneio em chamadas concorrentes.
- `BotaoGame.hidratarCampanha` carrega progresso + torneio + career do Supabase
  uma vez por usuário (auto-login e login manual). Se remoto vazio, preserva o
  save local e o envia ao Supabase. `persistTournament(null)` remove também o
  localStorage para não voltar um torneio antigo.

### Fluxo do BotaoGame
- `preparaEscolha`: prioridade suborno > narrativa > choice event.
- `playNext`: suborno/narrativa/evento → tela `celular`; copa → `copa-match`;
  senão liga → `tournament-match`.
- `aplicarNarrativa`: avança cena, aplica efeitos (bonusPoder/moral/soberania),
  registra headline se finalizado, zera `cenaAtual`.
- `finishCopaMatch`: `advanceCopaBrasil` + define `rodadaGatilhoConsumida`.
- `finishTournamentMatch`: fim da liga → `avaliarFimTemporada` → `setVeredito`.
- `userTeam.power`: 75 + bonusProximaPartida - penaltiesProximaPartida (40-99).

### Bug crítico corrigido (não reintroduzir)
- `GANCHOS_BASTIDORES`/`GANCHOS_TRAICAO`/`GANCHOS_MIDIA` DEVEM ter 5 entradas
  cada (índice acessado via `ganchoIdx % 5`). Quando tinham só 4, `idx=4` →
  `mensagemRaiz` undefined → `fillTemplate(tpl=undefined)` quebrava o jogo.
- `CopaBrasilState.rodadaGatilhoConsumida`: obrigatório para evitar que a
  próxima fase da copa dispare na MESMA rodada-gatilho (sem avançar a liga).

### Testes de runtime (Node 22 `--experimental-strip-types`)
- `narrativeEngine.ts` é testável isoladamente (sem imports com alias `@/`).
- `competitionApi.ts` NÃO é executável em Node puro (importa `@/lib/times.functions`
  via `data/teams.ts`) — validar por `tsc` + revisão manual.

## Módulo de Login/Conta (PS2-style) — 2026-08-18

Reatoração do login num módulo estável na tela principal, com personalização de
time/botões/tática no estilo PS2. Tudo persistido no Supabase (`futebol.sql`).

### SQL (`supabase/migrations/futebol.sql`)
- Colunas aditivas em `botao_usuarios` (idempotentes, `ADD COLUMN IF NOT EXISTS`):
  - `tatica TEXT NOT NULL DEFAULT '1-2-2'` com CHECK em
    `('1-2-2','1-3-1','1-1-3','1-2-1-1','2-2-1')`.
  - `botoes_nomes JSONB NOT NULL DEFAULT [...]` com constraint
    `check_botoes_nomes` (array de 5).
- RPC `atualizar_perfil_clube(p_uid, p_nome, p_time, p_abreviacao, p_cores,
  p_tatica, p_botoes)`: SECURITY DEFINER, valida `auth.uid() = p_uid`. Atualiza
  nome/time/sigla/cores/tática/botões com COALESCE (só altera o que vier não-null).
- Policy DELETE: `"Dono pode excluir propria conta"` (`auth.uid() = user_id`).
  GRANT DELETE já existia para authenticated.
- **Aplicação obrigatória:** como não há `supabase` CLI/service_role no
  workspace, o usuário deve colar o SQL atualizado no SQL Editor do Supabase.

### Frontend
- `career/formacoes.ts`: 5 formações (1-2-2, 1-3-1, 1-1-3, 1-2-1-1, 2-2-1), cada
  uma com 5 posições [x,y] + nomes padrão. `formacaoById()`,
  `normalizarBotoesNomes()`.
- `career/ProfileSetup.tsx`: módulo de conta (login/cadastro/edição). PS2-style:
  nome do time, sigla, cores (3 únicas), número, **tática**, **nomear os 5
  botões**, preview de campo (SVG). Login automático via `useBotaoAuth`.
  Deslogar / excluir conta / salvar personalização.
- `online/auth.ts`: `Perfil` estendido com `tatica?` e `botoes_nomes?` (nullable
  para casar com o DB). `cachePerfil` persiste tatica/botoes no localStorage.
  `STORAGE_KEYS.TATICA`/`BOTOES`.
- `lib/botao/api.ts`: `atualizarPerfilClube()` (RPC) + `excluirContaUsuario()`.
- `BotaoGame.tsx`: screen `"profile"`, card "Meu Clube / Conta" no menu,
  `formation` useMemo deriva posições de `perfil.tatica` e passa ao `MatchView`.
  `aoLogar(undefined)` → volta à tela `auth` (logout/exclusão).
- `engine/physics.ts`: `initialDiscs(formation?)` e `resetPositions(discs, formation?)`
  aceitam formação personalizada. Default = `FORMATION` 1-2-2.
- `components/MatchView.tsx`: prop `formation?` propagada a initialDiscs/resetPositions.
- `integrations/supabase/types.ts`: `botao_usuarios` Row/Insert/Update com
  tatica/botoes_nomes; RPC `atualizar_perfil_clube` tipada.

### Fluxo de auto-login
- `useBotaoAuth` escuta `onAuthStateChange`. Se há sessão ativa, busca/cria o
  perfil e popula `perfil`. O `ProfileSetup` abre em modo "editar" quando
  `perfil` existe; em modo "login" quando não. Logout/excluir → `onPronto(undefined)`
  → `aoLogar` → screen `"auth"`.

## TypeScript — observações (2026-08-18)
- `tsc --noEmit`: **0 erros** | `vite build`: OK | `npm run lint`: 1872 erros
  de prettier pré-existentes em TODO o repo (não bloqueiam build). `--fix`
  resolve a maioria mas não foi aplicado globalmente.
- Prefer-const: ESLint recomenda `const` mesmo quando o array é mutado via
  `.push()` (binding não é reatribuído).

## Persistência de fotos (escudo do clube) — commit e9cf53b (2026-08-18)
- **SQL** (`supabase/migrations/futebol.sql`):
  - Coluna `escudo_url TEXT` em `botao_usuarios`.
  - Bucket Storage `escudos` (público) + policies RLS por `auth.uid()`
    (`escudos_upload_dono`/`escudos_read_public`/`escudos_update_dono`/
    `escudos_delete_dono` em `storage.objects`).
  - RPC `atualizar_perfil_clube` ganhou parâmetro `p_escudo TEXT DEFAULT NULL`.
- **Frontend**:
  - `src/lib/botao/api.ts`: `uploadEscudo(userId, file)` faz `upsert` no Storage
    (`escudos/{uid}/escudo.{ext}`) e devolve a URL pública. `PerfilClubeInput`
    tem campo `escudo?`; `atualizarPerfilClube` envia `p_escudo`.
  - `src/components/botao/online/auth.ts`: `Perfil.escudo_url`, `STORAGE_KEYS.ESCUDO`,
    `cachePerfil` persiste o escudo.
  - `src/components/botao/career/ProfileSetup.tsx`: `<input type="file">` no
    avatar do resumo, preview `<img>`, hover com overlay de upload, valida
    `image/*` e ≤2MB; `trocarEscudo()` faz upload + salva via RPC.
  - `OnlineMatchV3`/`OnlineChampionship`: `meuTime` exibido no card.
- **REMOVIDO (2026-08-18)**: a feature de escudo/foto quebrava o RPC
  `atualizar_perfil_clube` em produção (o parâmetro `p_escudo` não existia no
  banco deployado, fazendo toda chamada de salvar perfil falhar). Revertido
  para a assinatura original de 7 parâmetros (sem `p_escudo`): perfil salva
  apenas nome do time, abreviação, cores, tática e nomes dos botões. Blocos SQL
  de `escudo_url`, bucket storage e policies foram removidos de `futebol.sql`.

## SQL consolidado — commit e9cf53b (2026-08-18)
- Toda a schema de futebol vive em **`supabase/migrations/futebol.sql`** (único
  arquivo). `futebol_campeonato_online.sql` e
  `20260817000000_fix_abrir_mesa_campeonato.sql` foram mesclados e removidos.
- `biblioteca.sql` e `trilha.sql` são módulos separados (livro de frases / jogo
  de trilha) e **não** devem ser tocados ao consolidar SQL de futebol.

## Amistoso online (MesaOnlineMatch) — commit e9cf53b
- Série melhor-de-3: estados `serieJ1`/`serieJ2`; vencedor ao alcançar 2 vitórias.
- 28 jogadas totais (14 por jogador) via `TOTAL_JOGADAS`/`turnsLeft`.
- Chat: `MesaRealtime.enviarChat()` + listener broadcast `chat` (`onChat`).
  Overlay `ChatOverlay.tsx` com respostas prontas + campo de digitação.
- Placar exibe nomes dos treinadores sincronizados do Supabase (`meuNome`/
  `nomeOponente` via `perfilOponente`) — escalação em primeira pessoa.

## Decisões pendentes (celular) vs narrativa
- Decisões pendentes **não** devem aparecer como histórico/narrativa em 3ª
  pessoa. São acessadas no fluxo do botão "celular" como mensagens em 1ª pessoa
  (comunicação direta do clube, estilo chat/notificação corporativa).

## Refatoração UI/UX + sistema de patrocinador (2026-08-18)
- **Desafio de patrocinador** (`career/patrocinadorEngine.ts`): a cada partida
  o patrocinador propõe uma meta (vitória por margem, não levar gols, etc.).
  Cumprir = +soberania (`aplicarDesafioPatrocinador` em `finishTournamentMatch`/
  `finishFriendly`). `CareerState.desafioPatrocinador` persiste no JSONB.
- **Celular do Treinador** (`screen="celular"`): sempre acessível no hub. O
  desafio do patrocinador aparece como bubble de chat em 1ª pessoa (estilo
  WhatsApp corporativo), com nome do patrocinador, mensagem e recompensa.
  `mensagensPendentes` inclui o desafio ativo.
- **Aposta de soberania (online)**: `OnlineMatchV3` permite apostar soberania na
  partida. `aplicarApostaSoberania()` (careerRemote) aplica: venceu = +aposta,
  perdeu = -aposta, empate = 0 (devolve). Nunca arrisca mais que o saldo.
- **Nomes dos botões no campo**: `Team.botoesNomes` (5 nomes) propagado de
  `perfil.botoes_nomes` → `userTeam`/`meuTime` → `MatchView.drawDiscs`, que
  desenha o nome do jogador (até 10 chars) no disco do lado do usuário
  (home ou away conforme `userSide`). Goleiro não recebe rótulo.
- **Bug "FB vs FB" (stats duplicadas)**: `teamByIdSync` agora consulta
  `cachedTeamsSync` (populado por `getAllTeams()`/`loadTeamsFromDB()` na
  montagem) antes do fallback local `TEAMS`. Assim times do torneio (IDs do
  banco) resolvem corretamente em vez de cair todos em `TEAMS[0]`.
- **Navegação de campeonatos** (`ChampionshipModule`): submenu
  "Copa do Brasil | Brasileirão" + sub-seleção Série A/B/C (a "você" marca a
  divisão do usuário). Stats (`StatsModule`) rotuladas pela divisão selecionada.
- `exactOptionalPropertyTypes`: props opcionais precisam de `| undefined`
  explícito (ex.: `botoesNomes?: string[] | undefined`).


## Cidadela dos Clássicos — RPG unificado por profissões (2026-08-20)

- **SQL**: `supabase/migrations/cidadela_rpg.sql` — `cidadela_perfis`,
  `cidadela_world_state` + RPCs `obter_perfil_cidadela`, `escolher_profissao`,
  `atualizar_estado_cidadela`, `obter_world_state`. Aplicação manual no SQL Editor.
- **5 profissões** (`lib/cidadela/profissoes.ts`): tecnico/estudante/empresario/
  bibliotecario/pesquisador com gating por reputação (100). A rota `/cidadela`
  força escolha de identidade quando perfil existe sem profissão.
- **Engine de decisões compartilhada** (`components/campus/`): `EstudanteState`
  genérico reutilizado por todas as profissões (`atividadesEngine.aplicarOpcao`
  registra SOV via source `'campus'`, reputação e traços emergentes).
  `ProfissaoHub` é hub genérico (Empresário/Pesquisador); Estudante usa
  `CampusHub` com tour (EstudanteTour).
- **Pesquisador**: pipeline em cadeia coleta→análise→publicação via
  `prerequisitos` de Atividade. **Empresário**: pauta própria
  (NEGOCIOS_INICIAIS) em `comercial/empresarioEngine.ts`.
- **Integração diária** (`campus/integracaoEngine.ts`): atividades rotativas
  (hash do dia ISO) conectam Estudante às outras profissões; IDs com sufixo de
  data permitem repetição diária.
- **World state** (`lib/cidadela/eventosGlobais.ts`): evento global da semana
  determinístico com efeito por profissão; `PainelMundo` lê RPC e cai em
  fallback local. `PainelReputacao` mostra reputação/nível no hub.
- **Testes runtime**: engines puros testáveis com
  `JITI_TSCONFIG_PATHS=true ./node_modules/.bin/jiti <teste.mts>`. Engines de
  decisão NÃO podem importar módulos com alias `@/` (use caminhos relativos).
- **Ads**: `/brio` usa `AdSlot` Banner Rodapé (Adsense permitido por default
  no adManager). `/cidadela` permanece Monetag (sem banner adsense).
