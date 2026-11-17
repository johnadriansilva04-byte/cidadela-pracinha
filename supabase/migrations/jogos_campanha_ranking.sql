-- ============================================================================
-- CAMPANHA E RANKING DOS JOGOS DA CIDADELA
--
-- Adiciona o que faltava para os jogos deixarem de ser "partida solta":
--   1. Missões diárias dos jogos de tabuleiro/dados/cartas/duelo (as missões
--      do futebol/trilha já existiam — aqui só entram as que faltam).
--   2. Ranking por jogo, com RLS: cada jogador só grava a própria linha e
--      todos leem o ranking (é vitrine pública, como o leaderboard do futebol).
--
-- REUTILIZA o que já existe:
--   • cidadela_missoes_diarias + cidadela_progresso_missao + cidadela_resgatar_missao
--   • cidadela_perfis.estado (JSONB) para o progresso da campanha de cada jogo
--   • user_wallets/bank_ledger via sov_bank_registrar (recompensa de fase)
--
-- NÃO cria tabela de progresso: o progresso da campanha vive no JSONB
-- `cidadela_perfis.estado.jogos[jogoId]`, gravado pela RPC que já existe
-- (`atualizar_estado_cidadela`, que faz merge). Uma tabela nova aqui só
-- duplicaria a fonte de verdade.
--
-- Aplicação: SQL Editor do Supabase, depois das migrations anteriores.
-- Idempotente: pode ser reaplicado sem erro.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. MISSÕES DOS JOGOS
--
-- A função original criava 5 missões (futebol, trilha, chat, mercado). O
-- CREATE OR REPLACE mantém as antigas e acrescenta as dos jogos novos, sem
-- tocar nas linhas já existentes (ON CONFLICT DO NOTHING).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cidadela_gerar_missoes_diarias()
RETURNS TABLE(id uuid, missao_key text, titulo text, descricao text, alvo integer, progresso integer, recompensa_sov integer, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid UUID := auth.uid();
  v_hoje DATE := CURRENT_DATE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'usuario nao autenticado';
  END IF;

  DELETE FROM cidadela_missoes_diarias
  WHERE user_id = v_uid AND data_criada < v_hoje;

  INSERT INTO cidadela_missoes_diarias (user_id, missao_key, titulo, descricao, alvo, recompensa_sov, data_criada)
  VALUES
    -- Missões que já existiam (mantidas na íntegra).
    (v_uid, 'botao_vitoria', 'Ganhe um jogo', 'Vença uma partida no modo carreira', 1, 5, v_hoje),
    (v_uid, 'botao_partida', 'Jogue 3 partidas', 'Dispute 3 partidas no modo carreira', 3, 8, v_hoje),
    (v_uid, 'trilha_jogo', 'Jogue Trilha', 'Entre na Cidadela e jogue uma partida de Trilha', 1, 5, v_hoje),
    (v_uid, 'chat_convite', 'Convide alguém', 'Envie uma mensagem no grupo da Cidadela', 1, 3, v_hoje),
    (v_uid, 'explorar_mercado', 'Explore o mercado', 'Acesse a aba Feira do celular', 1, 2, v_hoje),
    -- Jogos de tabuleiro (xadrez, dama, dominó).
    (v_uid, 'jogo_tabuleiro', 'Jogue no tabuleiro', 'Dispute uma partida de Xadrez, Dama ou Dominó', 1, 4, v_hoje),
    (v_uid, 'jogo_tabuleiro_vitoria', 'Vença no tabuleiro', 'Vença uma partida de tabuleiro', 1, 6, v_hoje),
    -- Dados e cartas.
    (v_uid, 'jogo_dados', 'Role os dados', 'Jogue uma partida de Yahtzee', 1, 4, v_hoje),
    (v_uid, 'jogo_cartas', 'Sente na mesa', 'Jogue uma partida de Blackjack', 1, 4, v_hoje),
    -- Duelo de conhecimento.
    (v_uid, 'brio_duelo', 'Duelo de conhecimento', 'Dispute um duelo no Guerra de Brio', 1, 5, v_hoje),
    (v_uid, 'brio_vitoria', 'Vença um duelo', 'Vença um duelo de conhecimento', 1, 7, v_hoje),
    -- Corrida.
    (v_uid, 'jogo_corrida', 'Entre na pista', 'Dispute uma corrida no Car Brawl', 1, 4, v_hoje)
  ON CONFLICT (user_id, missao_key, data_criada) DO NOTHING;

  RETURN QUERY
  SELECT m.id, m.missao_key, m.titulo, m.descricao, m.alvo, m.progresso, m.recompensa_sov, m.status
  FROM cidadela_missoes_diarias m
  WHERE m.user_id = v_uid AND m.data_criada = v_hoje;
END;
$function$;

REVOKE ALL ON FUNCTION public.cidadela_gerar_missoes_diarias() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cidadela_gerar_missoes_diarias() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. RANKING POR JOGO
--
-- Uma linha por (jogo, jogador): vitórias, partidas e melhor sequência. Serve
-- ao ranking público e ao "seu recorde" na tela de fim de partida.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cidadela_ranking_jogos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  jogo_id TEXT NOT NULL,
  nome_exibicao TEXT,
  vitorias INTEGER NOT NULL DEFAULT 0,
  derrotas INTEGER NOT NULL DEFAULT 0,
  empates INTEGER NOT NULL DEFAULT 0,
  partidas INTEGER NOT NULL DEFAULT 0,
  sequencia_atual INTEGER NOT NULL DEFAULT 0,
  melhor_sequencia INTEGER NOT NULL DEFAULT 0,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cidadela_ranking_jogos_unico UNIQUE (user_id, jogo_id),
  CONSTRAINT cidadela_ranking_jogos_nao_negativo CHECK (
    vitorias >= 0 AND derrotas >= 0 AND empates >= 0 AND partidas >= 0
    AND sequencia_atual >= 0 AND melhor_sequencia >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_ranking_jogos_jogo_vitorias
  ON public.cidadela_ranking_jogos (jogo_id, vitorias DESC);

ALTER TABLE public.cidadela_ranking_jogos ENABLE ROW LEVEL SECURITY;

-- Todos autenticados leem o ranking (é vitrine pública). Idempotente.
DROP POLICY IF EXISTS "ranking_jogos_leitura_publica" ON public.cidadela_ranking_jogos;
CREATE POLICY "ranking_jogos_leitura_publica"
  ON public.cidadela_ranking_jogos FOR SELECT
  TO authenticated
  USING (true);

-- Cada um só enxerga/grava a PRÓPRIA linha pela API direta; a escrita
-- normalizada passa pela RPC abaixo (SECURITY DEFINER), que é a autoridade.
DROP POLICY IF EXISTS "ranking_jogos_dono_insere" ON public.cidadela_ranking_jogos;
CREATE POLICY "ranking_jogos_dono_insere"
  ON public.cidadela_ranking_jogos FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "ranking_jogos_dono_atualiza" ON public.cidadela_ranking_jogos;
CREATE POLICY "ranking_jogos_dono_atualiza"
  ON public.cidadela_ranking_jogos FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON public.cidadela_ranking_jogos FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.cidadela_ranking_jogos TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. RPC: registrar resultado de jogo (atômica e idempotente por chamada)
--
-- O contador é atualizado no servidor (o cliente não manda o total, só o
-- delta), então duas abas abertas não corrompem o placar.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cidadela_registrar_resultado_jogo(
  p_jogo_id TEXT,
  p_resultado TEXT,
  p_nome_exibicao TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.cidadela_ranking_jogos;
  v_seq INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'usuario nao autenticado';
  END IF;
  IF p_jogo_id IS NULL OR length(trim(p_jogo_id)) = 0 THEN
    RAISE EXCEPTION 'jogo invalido';
  END IF;
  IF p_resultado NOT IN ('vitoria', 'derrota', 'empate') THEN
    RAISE EXCEPTION 'resultado invalido: %', p_resultado;
  END IF;

  INSERT INTO public.cidadela_ranking_jogos (user_id, jogo_id, nome_exibicao)
  VALUES (v_uid, p_jogo_id, p_nome_exibicao)
  ON CONFLICT (user_id, jogo_id) DO NOTHING;

  -- Sequência: vitória soma, derrota zera, empate mantém.
  SELECT sequencia_atual INTO v_seq
  FROM public.cidadela_ranking_jogos
  WHERE user_id = v_uid AND jogo_id = p_jogo_id
  FOR UPDATE;

  v_seq := CASE
    WHEN p_resultado = 'vitoria' THEN COALESCE(v_seq, 0) + 1
    WHEN p_resultado = 'derrota' THEN 0
    ELSE COALESCE(v_seq, 0)
  END;

  UPDATE public.cidadela_ranking_jogos
  SET vitorias = vitorias + CASE WHEN p_resultado = 'vitoria' THEN 1 ELSE 0 END,
      derrotas = derrotas + CASE WHEN p_resultado = 'derrota' THEN 1 ELSE 0 END,
      empates = empates + CASE WHEN p_resultado = 'empate' THEN 1 ELSE 0 END,
      partidas = partidas + 1,
      sequencia_atual = v_seq,
      melhor_sequencia = GREATEST(melhor_sequencia, v_seq),
      nome_exibicao = COALESCE(p_nome_exibicao, nome_exibicao),
      atualizado_em = now()
  WHERE user_id = v_uid AND jogo_id = p_jogo_id
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'jogo_id', v_row.jogo_id,
    'vitorias', v_row.vitorias,
    'derrotas', v_row.derrotas,
    'empates', v_row.empates,
    'partidas', v_row.partidas,
    'sequencia_atual', v_row.sequencia_atual,
    'melhor_sequencia', v_row.melhor_sequencia
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.cidadela_registrar_resultado_jogo(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cidadela_registrar_resultado_jogo(TEXT, TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. RPC: ranking público de um jogo
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cidadela_ranking_do_jogo(
  p_jogo_id TEXT,
  p_limite INTEGER DEFAULT 20
)
RETURNS TABLE(
  posicao BIGINT,
  nome_exibicao TEXT,
  vitorias INTEGER,
  partidas INTEGER,
  melhor_sequencia INTEGER,
  sou_eu BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT
    ROW_NUMBER() OVER (ORDER BY r.vitorias DESC, r.melhor_sequencia DESC, r.atualizado_em ASC) AS posicao,
    COALESCE(NULLIF(trim(r.nome_exibicao), ''), 'Competidor') AS nome_exibicao,
    r.vitorias,
    r.partidas,
    r.melhor_sequencia,
    (r.user_id = auth.uid()) AS sou_eu
  FROM public.cidadela_ranking_jogos r
  WHERE r.jogo_id = p_jogo_id AND r.partidas > 0
  ORDER BY r.vitorias DESC, r.melhor_sequencia DESC, r.atualizado_em ASC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limite, 20), 100));
$function$;

REVOKE ALL ON FUNCTION public.cidadela_ranking_do_jogo(TEXT, INTEGER) FROM PUBLIC;
-- Ranking e dado PUBLICO (so o nome de exibicao de quem jogou - nenhum dado
-- pessoal). Quem joga como visitante tambem precisa ver o placar; `sou_eu`
-- resolve para FALSE sem sessao. Mesma convencao de brio_catalogo.
GRANT EXECUTE ON FUNCTION public.cidadela_ranking_do_jogo(TEXT, INTEGER) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. RPC: meu recorde em um jogo (tela de fim de partida)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cidadela_meu_recorde_jogo(p_jogo_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.cidadela_ranking_jogos;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'usuario nao autenticado';
  END IF;

  SELECT * INTO v_row
  FROM public.cidadela_ranking_jogos
  WHERE user_id = v_uid AND jogo_id = p_jogo_id;

  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object(
      'vitorias', 0, 'derrotas', 0, 'empates', 0,
      'partidas', 0, 'sequencia_atual', 0, 'melhor_sequencia', 0
    );
  END IF;

  RETURN jsonb_build_object(
    'vitorias', v_row.vitorias,
    'derrotas', v_row.derrotas,
    'empates', v_row.empates,
    'partidas', v_row.partidas,
    'sequencia_atual', v_row.sequencia_atual,
    'melhor_sequencia', v_row.melhor_sequencia
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.cidadela_meu_recorde_jogo(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cidadela_meu_recorde_jogo(TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- VERIFICAÇÃO
--   SELECT public.cidadela_gerar_missoes_diarias();        -- 12 missões
--   SELECT public.cidadela_registrar_resultado_jogo('xadrez','vitoria');
--   SELECT * FROM public.cidadela_ranking_do_jogo('xadrez');
--   SELECT public.cidadela_meu_recorde_jogo('xadrez');
-- ---------------------------------------------------------------------------
