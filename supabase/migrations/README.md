# Migrações Supabase — como aplicar

O projeto **não** usa `supabase` CLI nem `service_role` no workspace: cada
migração é aplicada **manualmente** colando o conteúdo do arquivo no
**SQL Editor** do painel Supabase e executando. Todas são idempotentes
(`IF NOT EXISTS` / `CREATE OR REPLACE`) — podem ser reexecutadas com segurança.

## Ordem obrigatória

1. `futebol.sql` — base do Futebol de Botão (usuários, times, mesas, RPCs).
2. `biblioteca.sql` — Livro de Frases (módulo separado).
3. `trilha.sql` — Jogo da Trilha (módulo separado).
4. `cidadela_rpg.sql` — perfis/profissões da Cidadela.
5. `cidadela_chat_missoes.sql` — chat e missões diárias.
6. `sov_financial_system.sql` — carteiras + ledger base (`user_wallets`,
   `bank_ledger`, `record_transaction`).
7. `sov_integracao_cartorio.sql` — SOV + Cartório.
8. `sov_bank.sql` — **SOV BANK**: config da remessa (100 usuários /
   200.000 SOV de estoque total / 50 SOV de bônus de cadastro), colunas de
   rastreabilidade no ledger, RPCs `sov_bank_*`.
9. `feira.sql` — **Feira**: `cidadela_itens`, `cidadela_inventory`,
   `cidadela_market_listings` + RPCs `feira_*` (depende de `sov_bank.sql`).
10. `tempo_cidadao.sql` — **Tempo de Cidadão + Presença + Perfil**:
    colunas `nome`/`bio` em `cidadela_perfis` (corrige bug latente do RPC de
    presença), tabela `cidadela_tempo`, RPCs `tempo_cidadao_heartbeat`
    (acumula tempo validado, paga +10 SOV/hora via SOV Bank com chave
    `tempo:{user}:{hora}`), `cidadela_perfil_publico` e
    `cidadela_atualizar_perfil` (depende de `sov_bank.sql` e
    `cidadela_chat_missoes.sql`).
11. `sov_bank_invest.sql` — **SOV BANK + SOV INVEST** (duas carteiras do
    MESMO jogador): `user_wallets.invest_balance` (SOV Invest) ao lado de
    `balance` (SOV Bank). RPCs atômicas: `sov_bank_transferir_carteiras`
    (Bank→Invest 0% / Invest→Bank IOF 10%), `sov_bank_pagar_dividendo`
    (dividendo → Invest, líquido de IOF 10%, idempotente por período),
    `sov_bank_comprar_ativo` / `sov_bank_vender_ativo` (Bolsa paga com/credita
    o Invest, ledger-first) e `sov_bank_saldos`. Tipos novos no ledger:
    `invest_transfer`, `invest_withdraw`, `dividend`, `fee` (IOF).
    **Depende de `sov_bank.sql`** (colunas de rastreabilidade do ledger).
12. `campeonato_online_v2.sql` — **Campeonato Online v2** (2026-08-23):
    salas de até 32 jogadores, regra dos 50 SOV para criar/entrar,
    `preencher_campeonato_bots` + `resolver_confronto_bots` (só o dono),
    correção CRÍTICA do off-by-one de indexação jsonb em
    `vincular_mesa_campeonato`/`abrir_mesa_campeonato` (a mesa do campeonato
    gravava no confronto errado), byes nascem finalizados, campeão bot não
    quebra a FK, aposta da mesa cobrada de verdade (criação/entrada) +
    `pagar_premio_mesa` (zero-sum, idempotente), e a correção definitiva do
    `record_transaction` (crédito NUNCA bloqueado em conta negativa).
    **Depende de `futebol.sql`, `sov_financial_system.sql` e `sov_bank.sql`.**
    Sem ela: salas 9+ não criam, bots não preenchem e a regra dos 50 SOV não
    é imposta pelo servidor (o frontend degrada com mensagem clara).
13. `clubes_venda.sql` — **Vitrine pública de clubes** (2026-08-24):
    `botao_times.em_venda` + `preco_venda` e as RPCs
    `cidadela_anunciar_venda_clube` (só o dono; preço NULL/0 retira),
    `cidadela_listar_clubes_a_venda` (vitrine visível para todo autenticado)
    e `cidadela_comprar_clube_anunciado` (atômica: débito do comprador +
    crédito do vendedor no ledger, posse transferida, vitrine limpa e a
    participação do vendedor removida do JSONB dele — senão ele seguia
    recebendo dividendos de clube vendido). **Depende de `futebol.sql`
    (botao_times.dono_user_id) e `sov_financial_system.sql`
    (record_transaction).** Sem ela, a vitrine de clubes simplesmente não
    existe no servidor (a UI mostra lista vazia).
14. `qi_simulacao.sql` — **QI: SIMULAÇÃO + EXERCÍCIOS** (2026-08-28):
    banco de questões próprio (`qi_questions`, mode `exercise`/`simulation`
    separados de verdade no banco; simulação NUNCA usa questão de exercício e
    vice-versa), 32 questões de simulação em `difficulty_order` 1..6 (ordem
    ASC obrigatória, as 4 mais difíceis são sempre as últimas) + 24 de
    exercício, e `qi_test_attempts` (tentativas por usuário com RLS
    `user_id = auth.uid()`). RPCs: `qi_buscar_questoes(mode)` (retorna as
    questões SEM `correct_option`), `qi_criar_tentativa` (cria prova de 32),
    `qi_obter_tentativa_ativa` (F5/retomada), `qi_salvar_respostas`
    (sessão), `qi_finalizar_simulacao` (pontuação calculada NO SERVIDOR,
    resposta correta conferida contra o banco, idempotente) e
    `qi_listar_tentativas`. Validação local docker: 56 seeds aplicam, fluxo
    completo pontua 16/32 com respostas alternadas, RLS isola usuários e
    nega anon. **Sem ela, a simulação degrada com segurança** (o app usa
    banco local determinístico + resultado local avisando que não persiste).

15. `jogos_campanha_ranking.sql` — **CAMPANHA + RANKING DOS JOGOS**
    (2026-11-17): dá a cada jogo da Cidadela uma campanha com fases,
    patrono e história (`cidadela_perfis.estado.jogos`, JSONB — nenhuma
    tabela nova de perfil) e um ranking por jogo
    (`cidadela_ranking_jogos`, RLS `user_id = auth.uid()`). RPCs:
    `cidadela_gerar_missoes_diarias` (missões do dia por profissão),
    `cidadela_registrar_resultado_jogo` (grava vitória/derrota/empate +
    sequência, idempotente por `partida_id`), `cidadela_ranking_do_jogo`
    (**público** — `anon` + `authenticated`; expõe só o nome de exibição,
    nunca dado pessoal) e `cidadela_meu_recorde_jogo`. O SOV da campanha é
    pago pelo SOV BANK com chave idempotente `jogo:{jogo}:fase:{n}` — uma
    fase paga UMA vez, mesmo com F5 ou clique repetido. **Sem ela, o jogo
    continua jogável**, mas a fase não persiste e o ranking não aparece.

16. `guerra_de_brio.sql` — **GUERRA DE BRIO** (duelo intelectual 1×1):
    acervo próprio (`brio_questions` — 6 alternativas A–F, explicação,
    referência, categoria/subcategoria, dificuldade, parâmetros TRI
    `tri_a`/`tri_b`/`tri_c`, `assinatura` de antirrepetição, `status`
    rascunho/revisão/aprovada), catálogo de áreas/subcategorias
    (`brio_categorias` — área e subcategoria na MESMA tabela, via `area_slug`
    nulo ou não), partidas sincronizadas (`brio_partidas`, `brio_rodadas`,
    `brio_respostas`) e o índice de conhecimento por área (`brio_habilidade`),
    mais a calibração acumulada por item (`brio_calibracao`).
    RPCs de jogo: `brio_catalogo`, `brio_criar_partida`, `brio_entrar_partida`,
    `brio_estado_partida`, `brio_responder`, `brio_fechar_rodada`,
    `brio_listar_partidas`, `brio_meu_indice`, `brio_recalcular_habilidade`
    e `brio_estatisticas`.
    RPCs administrativas (**só `service_role`**): `brio_importar_lote`,
    `brio_aprovar_perguntas`, `brio_calibrar` e o auxiliar `brio_b_inicial`.
    O acesso às tabelas é SÓ por RPC: `brio_questions` não tem policy alguma,
    porque `letra_correta` não pode vazar para o cliente antes da revelação.
    **Aplicação:** rode o arquivo inteiro no SQL Editor (idempotente).
    **Alimentação contínua do acervo** (não é SQL — é script, e exige a
    `service_role`):

    ```bash
    # 1. importa o acervo curado em src/lib/brio/acervo.ts (entra como rascunho)
    SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
      node scripts/brio-importar.mjs --acervo acervo-curado

    # 2. importa um diretório de lotes JSON (escala: quantos lotes quiser)
    SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
      node scripts/brio-importar.mjs --lotes lotes/ lote-2026-11

    # 3. revisão editorial em lote (publica o que estava em revisão)
    SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
      node scripts/brio-importar.mjs --aprovar acervo-curado

    # 4. recalibra os itens com as respostas reais (idempotente)
    SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
      node scripts/brio-importar.mjs --calibrar 30
    ```

    O importador valida (6 alternativas, gabarito A–F, explicação, categoria,
    dificuldade), deduplica (assinatura idêntica + Jaccard ≥ 0,9) e manda a
    `assinatura` pronta no payload — a MESMA composição do seed
    (`<enunciado>##<alternativas ordenadas>`, sem acento, minúsculo).
    Testes: `node testes/brio-importacao.test.mjs` (18 checks).
    **NÃO simplificar a assinatura** para só o enunciado: o acervo já gravado
    usa enunciado+alternativas, e a antirrepetição passaria a aceitar tudo de
    novo como inédito (ver a nota em `brio_normalizar_texto`).
    Sem esta migração, o Guerra de Brio não existe no servidor.

    **ATUALIZAÇÃO DO ACERVO (137 perguntas)**: o arquivo foi regerado com o
    acervo expandido (49 do núcleo + 88 da expansão), cobrindo as 91
    subcategorias do catálogo — antes 44 delas não tinham nenhuma pergunta, e
    quem escolhesse, por exemplo, "Neuropsicologia" caía em partida vazia. O
    seed é idempotente (`ON CONFLICT (id) DO UPDATE`), então reaplicar o
    arquivo inteiro atualiza as existentes e insere as novas, sem duplicar.
    Alternativa sem reaplicar o SQL: `node scripts/brio-importar.mjs --acervo
    acervo-curado` (exige `SUPABASE_SERVICE_ROLE_KEY`), que faz o mesmo pelo
    caminho da RPC com deduplicação por assinatura.

    **CALIBRAÇÃO DA TRI (`brio_calibrar`)**: a dificuldade declarada é só a
    estimativa INICIAL de `tri_b` (`brio_b_inicial`: fácil −1,5 …
    especialista +1,7). O acervo aprende com o comportamento real quando
    `brio_calibrar` roda: recalcula a discriminação (ponto-bisserial) e a
    dificuldade (inverso da 3PL) com SHRINKAGE para o valor provisório, e
    grava o acumulado em `brio_calibracao` — o que permite recalibrar sem
    reprocessar o histórico inteiro. Enquanto um item tiver menos de
    `p_minimo` respostas (padrão 30) ele continua `tri_provisorio = TRUE`; é
    HONESTO dizer provisório, não calibrado. Itens com comportamento suspeito
    (acerto abaixo do chute ou discriminação negativa) ganham `tri_suspeita` e
    SAEM da seleção de perguntas.
    **Sempre que reaplicar o arquivo, rode `--calibrar` depois**: o seed
    reescreve `tri_b` com o valor inicial por dificuldade, o que é correto
    para item novo, mas descarta a calibração já acumulada.

## Como verificar se o SOV BANK está operacional

Após aplicar `sov_bank.sql`, rode no SQL Editor:

```sql
SELECT * FROM sov_bank_config;
SELECT sov_bank_stats();
```

Se `sov_bank_config` tiver as chaves `max_users_initial=100`,
`max_sovereign_initial=200000` e `signup_bonus=50`, o banco central está
operacional. Sem a migração, o app **degrada com segurança** (fallback para
as RPCs antigas) — mas nesse estado o SOV BANK **não deve ser declarado
operacional**.

## RE-APLICAÇÃO OBRIGATÓRIA (2026-08-23 — 3 blocos pendentes)

1. **`sov_financial_system.sql`** — `record_transaction` passa a bloquear só
   DÉBITO sem saldo. A versão antiga rejeitava CRÉDITO em conta negativa
   ("Saldo insuficiente" num crédito!), então conta endividada NUNCA recebia
   receita de partida/prêmio/salário e afundava para sempre (bug achado pelo
   E2E magnata). Rode o arquivo inteiro (idempotente).
2. **`futebol.sql`** — só o bloco final `-- EXCLUIR CONTA TOTAL` (RPC
   `excluir_conta_total`): apaga auth.users + todos os domínios.
3. **`sov_bank.sql`** — se ainda não foi re-aplicado na 22ª passada
   (`sov_bank_registrar` sem engolir erros).

## RE-APLICAÇÃO OBRIGATÓRIA (produção em estado quebrado — 2026-08-22)

Auditoria E2E em produção (conta-canário "Robô Doidão") provou que o banco
está com versões ANTIGAS/quebradas do sistema financeiro:

- `create_or_update_wallet` quebra com `42601 query has no destination for
  result data` → **nenhuma carteira jamais foi criada** (`usuarios_com_carteira = 0`).
- `sov_bank_registrar` ainda é a versão que ENGOLE erros
  (`{transaction_id: null, balance: 0}` em vez de propagar) → **nenhuma
  transação jamais chegou ao ledger** (`transacoes_total = 0`).
- O trigger de signup (`handle_new_user`) criava o perfil com cache
  `pontos_soberania = 50` sem criar carteira nem registrar o bônus.

Para corrigir, re-aplique **nesta ordem** no SQL Editor (tudo idempotente):

1. `sov_financial_system.sql` — corrige `create_or_update_wallet` (erro sobe,
   não é engolido) **e agora também** `record_transaction` com
   `SELECT ... FOR UPDATE` na carteira (sem esse lock, dois créditos
   paralelos — ex.: coletiva + investigação — liam o mesmo saldo e um deles
   evaporava; ver entrada de 2026-08-22 no AGENTS.md).
2. `sov_integracao_cartorio.sql` — `obter_saldo_soberania` agora cria a
   carteira na primeira leitura (wallet inexistente nunca vira "saldo 0").
3. `sov_bank.sql` — `sov_bank_registrar` sem `EXCEPTION WHEN OTHERS`.
4. `futebol.sql` — trigger `handle_new_user` agora credita o bônus de
   cadastro no ledger junto com a criação do perfil. **Não precisa rodar o
   arquivo inteiro**: basta executar o bloco que vai de
   `-- Trigger para criar perfil automaticamente` até
   `FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();`.

Verificação do fluxo de usuário novo (rode após criar uma conta de teste):

```sql
-- troque pelo id do usuário de teste
SELECT (SELECT balance FROM user_wallets WHERE user_id = '<uid>') AS wallet,
       (SELECT pontos_soberania FROM botao_usuarios WHERE user_id = '<uid>') AS cache,
       (SELECT COUNT(*) FROM bank_ledger WHERE user_id = '<uid>'
          AND idempotency_key = 'signup:<uid>') AS bonus_no_ledger;
-- esperado: wallet = 50, cache = 50, bonus_no_ledger = 1
```
