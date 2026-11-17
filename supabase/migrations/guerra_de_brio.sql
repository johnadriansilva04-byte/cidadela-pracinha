-- ============================================================
-- GUERRA DE BRIO — duelo intelectual 1×1 (Cidadela dos Clássicos)
-- Gerado por testes/gerador-brio-seed.mts. Idempotente.
--
-- Estruturas: brio_categorias, brio_questions, brio_partidas,
-- brio_rodadas, brio_respostas, brio_habilidade, brio_calibracao.
-- RPCs de servidor-autoridade: o relógio de 7s, a revelação e a
-- pontuação vivem no SERVIDOR (o cliente é apenas espelho).
--
-- NÃO altera nenhuma tabela dos outros jogos.
-- ============================================================

-- ---------- 1. Categorias (área → subcategoria) ----------
CREATE TABLE IF NOT EXISTS public.brio_categorias (
  slug TEXT PRIMARY KEY,
  area_slug TEXT REFERENCES public.brio_categorias(slug),
  nome TEXT NOT NULL,
  icone TEXT,
  ativa BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.brio_categorias IS
  'Árvore de conhecimento do Guerra de Brio: linha com area_slug NULL é uma '
  'ÁREA; linha com area_slug preenchido é uma SUBCATEGORIA daquela área.';

ALTER TABLE public.brio_categorias ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.brio_categorias TO anon, authenticated;
GRANT ALL ON public.brio_categorias TO service_role;

DROP POLICY IF EXISTS brio_categorias_leitura ON public.brio_categorias;
CREATE POLICY brio_categorias_leitura ON public.brio_categorias
  FOR SELECT TO anon, authenticated USING (ativa = TRUE);

CREATE INDEX IF NOT EXISTS brio_categorias_area_idx
  ON public.brio_categorias (area_slug) WHERE area_slug IS NOT NULL;

-- ---------- 2. Banco de perguntas ----------
-- Preparado para MILHÕES de linhas: chave textual estável, índices parciais
-- para a seleção por (área/subcategoria + dificuldade + ativa), contador de
-- usos e assinatura canônica para detecção de duplicatas.
CREATE TABLE IF NOT EXISTS public.brio_questions (
  id TEXT PRIMARY KEY,
  area_slug TEXT NOT NULL REFERENCES public.brio_categorias(slug),
  subcategoria_slug TEXT NOT NULL REFERENCES public.brio_categorias(slug),
  dificuldade TEXT NOT NULL
    CHECK (dificuldade IN ('facil','intermediaria','dificil','avancada','especialista')),
  ordem INTEGER NOT NULL CHECK (ordem BETWEEN 1 AND 5),
  enunciado TEXT NOT NULL,
  -- 6 alternativas: [{"letra":"A","texto":"..."}, ...]
  alternativas JSONB NOT NULL,
  letra_correta TEXT NOT NULL CHECK (letra_correta IN ('A','B','C','D','E','F')),
  explicacao TEXT NOT NULL,
  referencia TEXT,
  -- Assinatura normalizada (enunciado + alternativas ordenadas) p/ duplicatas.
  assinatura TEXT NOT NULL,
  -- Fluxo editorial: rascunho → revisao → aprovada → retirada
  status TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','revisao','aprovada','retirada')),
  ativa BOOLEAN NOT NULL DEFAULT TRUE,
  versao INTEGER NOT NULL DEFAULT 1,
  -- Parâmetros TRI (provisórios até a calibração acumular amostra)
  tri_a NUMERIC NOT NULL DEFAULT 1.0,
  tri_b NUMERIC NOT NULL DEFAULT 0.0,
  tri_c NUMERIC NOT NULL DEFAULT 0.1667,
  tri_provisorio BOOLEAN NOT NULL DEFAULT TRUE,
  -- Controle de uso (frequência) e histórico
  usos INTEGER NOT NULL DEFAULT 0,
  ultimo_uso_em TIMESTAMPTZ,
  origem TEXT NOT NULL DEFAULT 'curado',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Uma pergunta tem SEMPRE seis alternativas A–F distintas.
  CONSTRAINT brio_questions_seis_alternativas
    CHECK (jsonb_array_length(alternativas) = 6),
  CONSTRAINT brio_questions_enunciado_nao_vazio
    CHECK (length(btrim(enunciado)) >= 10)
);

COMMENT ON TABLE public.brio_questions IS
  'Acervo do Guerra de Brio. letra_correta NUNCA é exposta ao cliente antes da '
  'revelação: as RPCs de partida projetam apenas id/enunciado/alternativas.';

CREATE UNIQUE INDEX IF NOT EXISTS brio_questions_assinatura_idx
  ON public.brio_questions (assinatura);
CREATE INDEX IF NOT EXISTS brio_questions_selecao_idx
  ON public.brio_questions (area_slug, subcategoria_slug, dificuldade, ordem)
  WHERE ativa = TRUE AND status = 'aprovada';
CREATE INDEX IF NOT EXISTS brio_questions_uso_idx
  ON public.brio_questions (usos, ultimo_uso_em) WHERE ativa = TRUE;

ALTER TABLE public.brio_questions ENABLE ROW LEVEL SECURITY;
-- Sem policies: o acervo é acessível APENAS por RPC (a correta não vaza).
REVOKE ALL ON public.brio_questions FROM anon, authenticated;
GRANT ALL ON public.brio_questions TO service_role;

-- ---------- 3. Partidas ----------
CREATE TABLE IF NOT EXISTS public.brio_partidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jogador_1_id UUID NOT NULL,
  jogador_2_id UUID,
  -- Sala aberta: o assento 2 pode ser preenchido por um humano (link direto)
  -- ou por um adversário virtual (bot_nivel preenchido).
  bot_nivel INTEGER CHECK (bot_nivel BETWEEN 1 AND 4),
  modalidade TEXT NOT NULL
    CHECK (modalidade IN ('categoria','subcategoria','geral','multidisciplinar','aleatorio')),
  area_slug TEXT,
  subcategoria_slug TEXT,
  total_perguntas INTEGER NOT NULL DEFAULT 10 CHECK (total_perguntas BETWEEN 1 AND 50),
  segundos_por_pergunta INTEGER NOT NULL DEFAULT 15 CHECK (segundos_por_pergunta BETWEEN 5 AND 60),
  status TEXT NOT NULL DEFAULT 'aguardando'
    CHECK (status IN ('aguardando','em_andamento','finalizado','abandonada')),
  rodada_atual INTEGER NOT NULL DEFAULT 0,
  placar_1 INTEGER NOT NULL DEFAULT 0,
  placar_2 INTEGER NOT NULL DEFAULT 0,
  acertos_1 INTEGER NOT NULL DEFAULT 0,
  acertos_2 INTEGER NOT NULL DEFAULT 0,
  desempate BOOLEAN NOT NULL DEFAULT FALSE,
  vencedor_id UUID,
  empate BOOLEAN NOT NULL DEFAULT FALSE,
  -- Autoridade do relógio: quando o servidor liberou a rodada atual.
  rodada_liberada_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  iniciado_em TIMESTAMPTZ,
  finalizado_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS brio_partidas_jogador_idx
  ON public.brio_partidas (jogador_1_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS brio_partidas_jogador2_idx
  ON public.brio_partidas (jogador_2_id, criado_em DESC)
  WHERE jogador_2_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS brio_partidas_abertas_idx
  ON public.brio_partidas (status, criado_em DESC) WHERE status = 'aguardando';

ALTER TABLE public.brio_partidas ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.brio_partidas TO authenticated;
GRANT ALL ON public.brio_partidas TO service_role;

-- RLS: só os dois jogadores da partida enxergam a partida.
DROP POLICY IF EXISTS brio_partidas_participantes ON public.brio_partidas;
CREATE POLICY brio_partidas_participantes ON public.brio_partidas
  FOR SELECT TO authenticated
  USING (auth.uid() = jogador_1_id OR auth.uid() = jogador_2_id);

DROP POLICY IF EXISTS brio_partidas_criar ON public.brio_partidas;
CREATE POLICY brio_partidas_criar ON public.brio_partidas
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = jogador_1_id);

-- A escrita direta do cliente é restrita: o avanço da partida passa por RPC
-- SECURITY DEFINER (senão o cliente poderia reescrever o placar).
DROP POLICY IF EXISTS brio_partidas_atualizar ON public.brio_partidas;
CREATE POLICY brio_partidas_atualizar ON public.brio_partidas
  FOR UPDATE TO authenticated
  USING (auth.uid() = jogador_1_id OR auth.uid() = jogador_2_id)
  WITH CHECK (auth.uid() = jogador_1_id OR auth.uid() = jogador_2_id);

-- ---------- 4. Rodadas (pergunta sorteada + revelação) ----------
CREATE TABLE IF NOT EXISTS public.brio_rodadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partida_id UUID NOT NULL REFERENCES public.brio_partidas(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  pergunta_id TEXT NOT NULL REFERENCES public.brio_questions(id),
  -- Ordem das alternativas NESTA partida (a correta é gravada como letra).
  alternativas JSONB NOT NULL,
  letra_correta TEXT NOT NULL CHECK (letra_correta IN ('A','B','C','D','E','F')),
  revelada BOOLEAN NOT NULL DEFAULT FALSE,
  revelada_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (partida_id, numero)
);

CREATE INDEX IF NOT EXISTS brio_rodadas_partida_idx
  ON public.brio_rodadas (partida_id, numero);

ALTER TABLE public.brio_rodadas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.brio_rodadas FROM anon, authenticated;
GRANT ALL ON public.brio_rodadas TO service_role;

-- ---------- 5. Respostas ----------
CREATE TABLE IF NOT EXISTS public.brio_respostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partida_id UUID NOT NULL REFERENCES public.brio_partidas(id) ON DELETE CASCADE,
  rodada_numero INTEGER NOT NULL,
  jogador_id UUID NOT NULL,
  letra TEXT NOT NULL CHECK (letra IN ('A','B','C','D','E','F')),
  -- ms desde a liberação da rodada (carimbado pelo SERVIDOR).
  tempo_ms INTEGER NOT NULL CHECK (tempo_ms >= 0),
  acertou BOOLEAN,
  pontos INTEGER NOT NULL DEFAULT 0,
  respondido_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Uma resposta por jogador por rodada: o registro é imutável.
  UNIQUE (partida_id, rodada_numero, jogador_id)
);

CREATE INDEX IF NOT EXISTS brio_respostas_jogador_idx
  ON public.brio_respostas (jogador_id, respondido_em DESC);
CREATE INDEX IF NOT EXISTS brio_respostas_partida_idx
  ON public.brio_respostas (partida_id, rodada_numero);

ALTER TABLE public.brio_respostas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.brio_respostas FROM anon, authenticated;
GRANT ALL ON public.brio_respostas TO service_role;

-- ---------- 6. Habilidade (Índice de Conhecimento) ----------
-- Uma linha por (jogador, disciplina); area_slug NULL = habilidade GERAL.
-- Não usamos PRIMARY KEY (user_id, area_slug) porque, em Postgres, as colunas
-- de uma chave primária são implicitamente NOT NULL — o que impediria a linha
-- geral. Um índice único por expressão resolve e é portável.
CREATE TABLE IF NOT EXISTS public.brio_habilidade (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  -- NULL = habilidade GERAL (multidisciplinar); preenchido = por disciplina.
  area_slug TEXT,
  theta NUMERIC NOT NULL DEFAULT 0,
  erro_padrao NUMERIC NOT NULL DEFAULT 1,
  indice INTEGER NOT NULL DEFAULT 50 CHECK (indice BETWEEN 0 AND 100),
  respostas INTEGER NOT NULL DEFAULT 0,
  confiabilidade NUMERIC NOT NULL DEFAULT 0,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS brio_habilidade_unico_idx
  ON public.brio_habilidade (user_id, COALESCE(area_slug, ''));

ALTER TABLE public.brio_habilidade ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.brio_habilidade TO authenticated;
GRANT ALL ON public.brio_habilidade TO service_role;

DROP POLICY IF EXISTS brio_habilidade_propria ON public.brio_habilidade;
CREATE POLICY brio_habilidade_propria ON public.brio_habilidade
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ---------- 7. Calibração acumulada por item ----------
-- Guarda o suficiente para recalibrar SEM reprocessar todo o histórico.
CREATE TABLE IF NOT EXISTS public.brio_calibracao (
  pergunta_id TEXT PRIMARY KEY REFERENCES public.brio_questions(id) ON DELETE CASCADE,
  n_respostas INTEGER NOT NULL DEFAULT 0,
  n_acertos INTEGER NOT NULL DEFAULT 0,
  -- Soma de theta e de theta² dos respondentes, para a ponto-bisserial.
  soma_theta NUMERIC NOT NULL DEFAULT 0,
  soma_theta2 NUMERIC NOT NULL DEFAULT 0,
  soma_theta_acerto NUMERIC NOT NULL DEFAULT 0,
  tri_a NUMERIC NOT NULL DEFAULT 1.0,
  tri_b NUMERIC NOT NULL DEFAULT 0.0,
  tri_c NUMERIC NOT NULL DEFAULT 0.1667,
  provisorio BOOLEAN NOT NULL DEFAULT TRUE,
  suspeita TEXT,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.brio_calibracao ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.brio_calibracao FROM anon, authenticated;
GRANT ALL ON public.brio_calibracao TO service_role;

-- ---------- 8. RPC: catálogo de categorias ----------
CREATE OR REPLACE FUNCTION public.brio_catalogo()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'slug', a.slug, 'nome', a.nome, 'icone', a.icone,
      'subcategorias', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('slug', s.slug, 'nome', s.nome) ORDER BY s.nome)
        FROM public.brio_categorias s
        WHERE s.area_slug = a.slug AND s.ativa = TRUE
      ), '[]'::jsonb),
      -- Quantas perguntas aprovadas existem em cada área (vitrine do lobby).
      'perguntas', (
        SELECT COUNT(*) FROM public.brio_questions q
        WHERE q.area_slug = a.slug AND q.ativa = TRUE AND q.status = 'aprovada'
      )
    ) ORDER BY a.nome
  ), '[]'::jsonb)
  FROM public.brio_categorias a
  WHERE a.area_slug IS NULL AND a.ativa = TRUE;
$$;

REVOKE ALL ON FUNCTION public.brio_catalogo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.brio_catalogo() TO anon, authenticated;

-- ---------- 9. RPC: criar partida (sorteia as perguntas) ----------
-- O sorteio acontece NO SERVIDOR, com antirrepetição contra o histórico do
-- jogador. As letras corretas ficam em brio_rodadas (invisível ao cliente).
CREATE OR REPLACE FUNCTION public.brio_criar_partida(
  p_modalidade TEXT,
  p_area_slug TEXT DEFAULT NULL,
  p_subcategoria_slug TEXT DEFAULT NULL,
  p_bot_nivel INTEGER DEFAULT NULL,
  p_total INTEGER DEFAULT 10,
  p_segundos INTEGER DEFAULT 15,
  p_aberta BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_partida UUID;
  v_total INT := GREATEST(1, LEAST(COALESCE(p_total, 10), 50));
  v_seg INT := GREATEST(5, LEAST(COALESCE(p_segundos, 15), 60));
  v_ordem INT;
  v_linha RECORD;
  v_alt JSONB;
  v_correta TEXT;
  v_sorteada TEXT;
  v_usados TEXT[] := '{}';
  v_recentes TEXT[];
  v_rodada INT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'não autenticado';
  END IF;
  IF p_modalidade NOT IN ('categoria','subcategoria','geral','multidisciplinar','aleatorio') THEN
    RAISE EXCEPTION 'modalidade inválida: %', p_modalidade;
  END IF;
  IF p_modalidade = 'categoria' AND p_area_slug IS NULL THEN
    RAISE EXCEPTION 'modalidade categoria exige p_area_slug';
  END IF;
  IF p_modalidade = 'subcategoria' AND p_subcategoria_slug IS NULL THEN
    RAISE EXCEPTION 'modalidade subcategoria exige p_subcategoria_slug';
  END IF;

  -- Histórico recente do jogador (antirrepetição): últimas 60 respostas.
  SELECT COALESCE(array_agg(DISTINCT r.pergunta_id), '{}')
  INTO v_recentes
  FROM (
    SELECT rod.pergunta_id
    FROM public.brio_respostas resp
    JOIN public.brio_rodadas rod
      ON rod.partida_id = resp.partida_id AND rod.numero = resp.rodada_numero
    WHERE resp.jogador_id = v_uid
    ORDER BY resp.respondido_em DESC
    LIMIT 60
  ) r;

  -- Sala de convite (p_aberta): espera o assento 2 e só começa quando o
  -- convidado entra em brio_entrar_partida. Contra o adversário virtual a
  -- partida já nasce em andamento.
  IF p_aberta AND p_bot_nivel IS NOT NULL THEN
    RAISE EXCEPTION 'uma sala de convite não tem adversário virtual';
  END IF;

  INSERT INTO public.brio_partidas
    (jogador_1_id, bot_nivel, modalidade, area_slug, subcategoria_slug,
     total_perguntas, segundos_por_pergunta, status, rodada_atual, rodada_liberada_em)
  VALUES
    (v_uid, p_bot_nivel, p_modalidade, p_area_slug, p_subcategoria_slug,
     v_total, v_seg,
     CASE WHEN p_aberta THEN 'aguardando' ELSE 'em_andamento' END,
     CASE WHEN p_aberta THEN 0 ELSE 1 END,
     CASE WHEN p_aberta THEN NULL ELSE now() END)
  RETURNING id INTO v_partida;

  -- Uma pergunta por rodada, com dificuldade progressiva 1..5.
  FOR v_rodada IN 1 .. v_total LOOP
    v_ordem := GREATEST(1, LEAST(5, ROUND(1 + ((v_rodada - 1)::numeric / GREATEST(v_total - 1, 1)) * 4)::INT));

    SELECT q.id, q.alternativas, q.letra_correta
    INTO v_linha
    FROM public.brio_questions q
    WHERE q.ativa = TRUE AND q.status = 'aprovada'
      AND NOT (q.id = ANY(v_usados))
      AND (
        (p_modalidade = 'subcategoria' AND q.subcategoria_slug = p_subcategoria_slug)
        OR (p_modalidade = 'categoria' AND q.area_slug = p_area_slug)
        OR (p_modalidade = 'geral' AND (q.subcategoria_slug = 'conhecimentos-gerais' OR q.dificuldade = 'facil'))
        OR (p_modalidade IN ('multidisciplinar','aleatorio'))
      )
    -- Antirrepetição recente primeiro; depois dificuldade alvo; depois raridade.
    ORDER BY
      (q.id = ANY(v_recentes)) ASC,
      ABS(q.ordem - v_ordem) ASC,
      q.usos ASC,
      md5(q.id || v_partida::TEXT)
    LIMIT 1;

    IF v_linha.id IS NULL THEN
      -- Relaxa o filtro de modalidade se o acervo da categoria acabou.
      SELECT q.id, q.alternativas, q.letra_correta
      INTO v_linha
      FROM public.brio_questions q
      WHERE q.ativa = TRUE AND q.status = 'aprovada'
        AND NOT (q.id = ANY(v_usados))
      ORDER BY (q.id = ANY(v_recentes)) ASC, ABS(q.ordem - v_ordem) ASC, q.usos ASC, md5(q.id || v_partida::TEXT)
      LIMIT 1;
    END IF;

    EXIT WHEN v_linha.id IS NULL;

    v_usados := array_append(v_usados, v_linha.id);
    v_correta := v_linha.letra_correta;
    -- Permutação determinística das alternativas nesta partida.
    -- chr() exige INT: ROW_NUMBER() devolve BIGINT, daí o cast explícito.
    SELECT jsonb_agg(jsonb_build_object('letra', chr((64 + t.pos)::INT), 'texto', t.texto) ORDER BY t.pos)
    INTO v_alt
    FROM (
      SELECT ROW_NUMBER() OVER (ORDER BY md5(a.ord::TEXT || v_partida::TEXT || v_rodada::TEXT)) AS pos,
             a.val->>'texto' AS texto,
             a.val->>'letra' AS letra_orig
      FROM jsonb_array_elements(v_linha.alternativas) WITH ORDINALITY AS a(val, ord)
    ) t;

    -- Recalcula a letra correta depois da permutação.
    SELECT alt->>'letra' INTO v_sorteada
    FROM jsonb_array_elements(v_alt) alt
    WHERE alt->>'texto' = (
      SELECT o->>'texto' FROM jsonb_array_elements(v_linha.alternativas) o
      WHERE o->>'letra' = v_correta
    )
    LIMIT 1;

    INSERT INTO public.brio_rodadas (partida_id, numero, pergunta_id, alternativas, letra_correta)
    VALUES (v_partida, v_rodada, v_linha.id, v_alt, COALESCE(v_sorteada, v_correta));

    UPDATE public.brio_questions SET usos = usos + 1, ultimo_uso_em = now()
    WHERE id = v_linha.id;
  END LOOP;

  IF v_rodada <= v_total AND v_usados = '{}' THEN
    RAISE EXCEPTION 'acervo vazio — aplique o seed de guerra_de_brio.sql';
  END IF;

  UPDATE public.brio_partidas
  SET total_perguntas = GREATEST(1, array_length(v_usados, 1))
  WHERE id = v_partida;

  -- Sala de convite NÃO inicia aqui: o relógio da rodada 1 começa quando o
  -- convidado ocupa o assento 2 (brio_entrar_partida). Iniciar agora faria o
  -- dono jogar sozinho e o convidado entrar numa partida já em andamento.
  IF NOT p_aberta THEN
    UPDATE public.brio_partidas
    SET status = 'em_andamento',
        iniciado_em = now(),
        rodada_atual = 1,
        -- JANELA DE LEITURA: o carimbo fica no FUTURO, então o relógio só
        -- começa a correr depois que a pergunta já está na tela do jogador.
        rodada_liberada_em = now() + interval '6 seconds'
    WHERE id = v_partida;
  END IF;

  RETURN public.brio_estado_partida(v_partida);
END
$$;

REVOKE ALL ON FUNCTION public.brio_criar_partida(TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.brio_criar_partida(TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, BOOLEAN) TO authenticated;

-- ---------- 10. RPC: estado da partida (SEM gabarito até a revelação) ----------
CREATE OR REPLACE FUNCTION public.brio_estado_partida(p_partida_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_p public.brio_partidas%ROWTYPE;
  v_rodada public.brio_rodadas%ROWTYPE;
  v_rodadas JSONB;
  v_respostas JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'não autenticado';
  END IF;

  SELECT * INTO v_p FROM public.brio_partidas WHERE id = p_partida_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'partida não encontrada';
  END IF;
  IF v_uid <> v_p.jogador_1_id AND v_uid IS DISTINCT FROM v_p.jogador_2_id THEN
    RAISE EXCEPTION 'você não participa desta partida';
  END IF;

  -- Rodadas: o gabarito SÓ aparece se a rodada já foi revelada.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'numero', r.numero,
    'pergunta_id', r.pergunta_id,
    'enunciado', q.enunciado,
    'area_slug', q.area_slug,
    'subcategoria_slug', q.subcategoria_slug,
    'dificuldade', q.dificuldade,
    'alternativas', r.alternativas,
    'revelada', r.revelada,
    'letra_correta', CASE WHEN r.revelada THEN r.letra_correta ELSE NULL END,
    'explicacao', CASE WHEN r.revelada THEN q.explicacao ELSE NULL END,
    'referencia', CASE WHEN r.revelada THEN q.referencia ELSE NULL END
  ) ORDER BY r.numero), '[]'::jsonb)
  INTO v_rodadas
  FROM public.brio_rodadas r
  JOIN public.brio_questions q ON q.id = r.pergunta_id
  WHERE r.partida_id = p_partida_id;

  -- Respostas: a do ADVERSÁRIO fica oculta até a revelação da rodada.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'rodada', resp.rodada_numero,
    'jogador_id', resp.jogador_id,
    'letra', CASE
      WHEN resp.jogador_id = v_uid THEN resp.letra
      WHEN (SELECT r2.revelada FROM public.brio_rodadas r2
            WHERE r2.partida_id = resp.partida_id AND r2.numero = resp.rodada_numero)
      THEN resp.letra
      ELSE NULL END,
    'tempo_ms', resp.tempo_ms,
    'acertou', resp.acertou,
    'pontos', resp.pontos
  ) ORDER BY resp.rodada_numero), '[]'::jsonb)
  INTO v_respostas
  FROM public.brio_respostas resp
  WHERE resp.partida_id = p_partida_id;

  RETURN jsonb_build_object(
    'partida_id', v_p.id,
    'jogador_1_id', v_p.jogador_1_id,
    'jogador_2_id', v_p.jogador_2_id,
    'bot_nivel', v_p.bot_nivel,
    'modalidade', v_p.modalidade,
    'area_slug', v_p.area_slug,
    'subcategoria_slug', v_p.subcategoria_slug,
    'status', v_p.status,
    'rodada_atual', v_p.rodada_atual,
    'total_perguntas', v_p.total_perguntas,
    'segundos_por_pergunta', v_p.segundos_por_pergunta,
    'placar_1', v_p.placar_1,
    'placar_2', v_p.placar_2,
    'acertos_1', v_p.acertos_1,
    'acertos_2', v_p.acertos_2,
    'desempate', v_p.desempate,
    'vencedor_id', v_p.vencedor_id,
    'empate', v_p.empate,
    'rodada_liberada_em', v_p.rodada_liberada_em,
    'iniciado_em', v_p.iniciado_em,
    'finalizado_em', v_p.finalizado_em,
    'rodadas', v_rodadas,
    'respostas', v_respostas
  );
END
$$;

REVOKE ALL ON FUNCTION public.brio_estado_partida(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.brio_estado_partida(UUID) TO authenticated;

-- ---------- 11. RPC: responder (registro imutável, relógio do SERVIDOR) ----------
CREATE OR REPLACE FUNCTION public.brio_responder(
  p_partida_id UUID,
  p_rodada INTEGER,
  p_letra TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_p public.brio_partidas%ROWTYPE;
  v_r public.brio_rodadas%ROWTYPE;
  v_decorrido INT;
  v_limite_ms INT;
  v_existe BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'não autenticado';
  END IF;
  IF p_letra NOT IN ('A','B','C','D','E','F') THEN
    RAISE EXCEPTION 'letra inválida';
  END IF;

  SELECT * INTO v_p FROM public.brio_partidas WHERE id = p_partida_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'partida não encontrada';
  END IF;
  IF v_uid <> v_p.jogador_1_id AND v_uid IS DISTINCT FROM v_p.jogador_2_id THEN
    RAISE EXCEPTION 'você não participa desta partida';
  END IF;
  IF v_p.status <> 'em_andamento' THEN
    RAISE EXCEPTION 'partida não está em andamento';
  END IF;
  IF p_rodada <> v_p.rodada_atual THEN
    RAISE EXCEPTION 'rodada % não é a rodada atual (%)', p_rodada, v_p.rodada_atual;
  END IF;

  -- A resposta é IMUTÁVEL: uma por jogador por rodada.
  SELECT EXISTS (
    SELECT 1 FROM public.brio_respostas
    WHERE partida_id = p_partida_id AND rodada_numero = p_rodada AND jogador_id = v_uid
  ) INTO v_existe;
  IF v_existe THEN
    RAISE EXCEPTION 'você já respondeu esta rodada — a resposta não pode ser alterada';
  END IF;

  SELECT * INTO v_r FROM public.brio_rodadas
  WHERE partida_id = p_partida_id AND numero = p_rodada;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'rodada não encontrada';
  END IF;
  IF v_r.revelada THEN
    RAISE EXCEPTION 'rodada já revelada';
  END IF;

  -- RELÓGIO DO SERVIDOR: o tempo é calculado aqui, nunca informado pelo cliente.
  v_decorrido := GREATEST(0, EXTRACT(EPOCH FROM (now() - v_p.rodada_liberada_em))::INT);
  v_limite_ms := v_p.segundos_por_pergunta * 1000;
  IF v_decorrido * 1000 > v_limite_ms + 1500 THEN
    -- Tolerância de 1,5s para latência de rede; além disso, a rodada expirou.
    RAISE EXCEPTION 'tempo esgotado para esta rodada';
  END IF;

  INSERT INTO public.brio_respostas (partida_id, rodada_numero, jogador_id, letra, tempo_ms, acertou, pontos)
  VALUES (p_partida_id, p_rodada, v_uid, p_letra, LEAST(v_decorrido * 1000, v_limite_ms),
          p_letra = v_r.letra_correta, 0);

  RETURN public.brio_estado_partida(p_partida_id);
END
$$;

REVOKE ALL ON FUNCTION public.brio_responder(UUID, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.brio_responder(UUID, INTEGER, TEXT) TO authenticated;

-- ---------- 12. RPC: fechar a rodada (revela, pontua e avança) ----------
-- Quem chama: qualquer participante, quando ambos responderam OU o tempo
-- acabou. É IDEMPOTENTE — chamar duas vezes não pontua duas vezes.
CREATE OR REPLACE FUNCTION public.brio_fechar_rodada(p_partida_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_p public.brio_partidas%ROWTYPE;
  v_r public.brio_rodadas%ROWTYPE;
  v_decorrido NUMERIC;
  v_limite NUMERIC;
  v_total_respostas INT;
  v_jogadores UUID[];
  v_primeiro UUID;
  v_letra TEXT;
  v_acertou BOOLEAN;
  v_pontos INT;
  v_novo_p1 INT;
  v_novo_p2 INT;
  v_novo_a1 INT;
  v_novo_a2 INT;
  v_venc RECORD;
  -- Adversário virtual: UUID sintético estável por (partida, rodada).
  v_bot_id UUID;
  v_bot_existe BOOLEAN;
  v_bot_acerta BOOLEAN;
  v_bot_letra TEXT;
  v_bot_aleat NUMERIC;
  v_chance NUMERIC;
  v_letras TEXT[] := ARRAY['A','B','C','D','E','F'];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'não autenticado';
  END IF;

  SELECT * INTO v_p FROM public.brio_partidas WHERE id = p_partida_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'partida não encontrada';
  END IF;
  IF v_uid <> v_p.jogador_1_id AND v_uid IS DISTINCT FROM v_p.jogador_2_id THEN
    RAISE EXCEPTION 'você não participa desta partida';
  END IF;
  IF v_p.status = 'finalizado' THEN
    RETURN public.brio_estado_partida(p_partida_id);
  END IF;

  SELECT * INTO v_r FROM public.brio_rodadas
  WHERE partida_id = p_partida_id AND numero = v_p.rodada_atual;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'rodada atual não encontrada';
  END IF;

  -- Idempotência: rodada já revelada ⇒ devolve o estado sem repontuar.
  IF v_r.revelada THEN
    RETURN public.brio_estado_partida(p_partida_id);
  END IF;

  v_decorrido := EXTRACT(EPOCH FROM (now() - v_p.rodada_liberada_em));
  v_limite := v_p.segundos_por_pergunta;

  -- ADVERSÁRIO VIRTUAL: ele responde NO SERVIDOR, com a mesma dificuldade e o
  -- mesmo relógio do humano — o cliente nunca decide se o bot acertou.
  IF v_p.bot_nivel IS NOT NULL THEN
    -- Identidade ESTÁVEL do adversário virtual: derivada só da partida. Se o
    -- UUID variasse por rodada, o placar do assento 2 só veria a rodada atual.
    v_bot_id := md5(v_p.id::TEXT || ':bot')::UUID;
    SELECT EXISTS (
      SELECT 1 FROM public.brio_respostas
      WHERE partida_id = p_partida_id AND rodada_numero = v_p.rodada_atual
        AND jogador_id = v_bot_id
    ) INTO v_bot_existe;

    IF NOT v_bot_existe THEN
      -- Sorteio determinístico em [0,1) a partir do md5 (reprodutível).
      v_bot_aleat := (('x' || substr(md5(v_p.id::TEXT || ':' || v_p.rodada_atual::TEXT || ':bot'), 1, 8))::BIT(32)::BIGINT);
      v_bot_aleat := abs(v_bot_aleat) / 4294967296.0;

      -- Chance por nível (1..4), ajustada pela dificuldade da questão.
      v_chance := CASE v_p.bot_nivel
        WHEN 1 THEN 0.34 WHEN 2 THEN 0.50 WHEN 3 THEN 0.66 ELSE 0.80 END;
      SELECT v_chance + CASE q.dificuldade
        WHEN 'facil' THEN 0.12 WHEN 'intermediaria' THEN 0.06 WHEN 'dificil' THEN 0.0
        WHEN 'avancada' THEN -0.07 ELSE -0.14 END
      INTO v_chance
      FROM public.brio_questions q WHERE q.id = v_r.pergunta_id;
      v_chance := GREATEST(0.05, LEAST(0.95, COALESCE(v_chance, 0.5)));

      v_bot_acerta := v_bot_aleat < v_chance;
      IF v_bot_acerta THEN
        v_bot_letra := v_r.letra_correta;
      ELSE
        -- Escolhe uma letra ERRADA (o bot nunca "cola").
        SELECT l INTO v_bot_letra
        FROM unnest(v_letras) l
        WHERE l <> v_r.letra_correta
        ORDER BY md5(l || v_p.id::TEXT || v_p.rodada_atual::TEXT)
        LIMIT 1;
      END IF;

      INSERT INTO public.brio_respostas
        (partida_id, rodada_numero, jogador_id, letra, tempo_ms, acertou, pontos)
      VALUES
        (p_partida_id, v_p.rodada_atual, v_bot_id, v_bot_letra,
         -- O bot "pensa" entre 1,2s e 5,5s: nunca responde instantaneamente.
         (1200 + (v_bot_aleat * 4300)::INT), v_bot_acerta, 0);
    END IF;
  END IF;

  v_jogadores := ARRAY[v_p.jogador_1_id];
  IF v_p.jogador_2_id IS NOT NULL THEN
    v_jogadores := array_append(v_jogadores, v_p.jogador_2_id);
  ELSIF v_bot_id IS NOT NULL THEN
    v_jogadores := array_append(v_jogadores, v_bot_id);
  END IF;

  SELECT COUNT(*) INTO v_total_respostas
  FROM public.brio_respostas
  WHERE partida_id = p_partida_id AND rodada_numero = v_p.rodada_atual;

  -- Só revela quando ambos responderam ou o tempo terminou.
  IF v_total_respostas < COALESCE(array_length(v_jogadores, 1), 1) AND v_decorrido <= v_limite THEN
    RETURN public.brio_estado_partida(p_partida_id);
  END IF;

  -- Quem respondeu primeiro leva o bônus de rapidez.
  SELECT jogador_id INTO v_primeiro
  FROM public.brio_respostas
  WHERE partida_id = p_partida_id AND rodada_numero = v_p.rodada_atual
  ORDER BY tempo_ms ASC, respondido_em ASC
  LIMIT 1;

  v_novo_p1 := v_p.placar_1;
  v_novo_p2 := v_p.placar_2;
  v_novo_a1 := v_p.acertos_1;
  v_novo_a2 := v_p.acertos_2;

  -- Pontuação por jogador (10 por acerto + 3 de rapidez para o primeiro).
  UPDATE public.brio_respostas r
  SET acertou = (r.letra = v_r.letra_correta),
      pontos = CASE WHEN r.letra = v_r.letra_correta THEN 10 ELSE 0 END
        + CASE WHEN r.letra = v_r.letra_correta AND r.jogador_id = v_primeiro THEN 3 ELSE 0 END
  WHERE r.partida_id = p_partida_id AND r.rodada_numero = v_p.rodada_atual;

  -- O assento 2 é o jogador humano convidado OU o adversário virtual.
  SELECT
    COALESCE(SUM(CASE WHEN jogador_id = v_p.jogador_1_id THEN pontos ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN jogador_id = COALESCE(v_p.jogador_2_id, v_bot_id) THEN pontos ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN jogador_id = v_p.jogador_1_id AND acertou THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN jogador_id = COALESCE(v_p.jogador_2_id, v_bot_id) AND acertou THEN 1 ELSE 0 END), 0)
  INTO v_novo_p1, v_novo_p2, v_novo_a1, v_novo_a2
  FROM public.brio_respostas
  WHERE partida_id = p_partida_id;

  UPDATE public.brio_rodadas
  SET revelada = TRUE, revelada_em = now()
  WHERE partida_id = p_partida_id AND numero = v_p.rodada_atual;

  -- Fim do tempo regulamentar: decide ou abre desempate.
  IF v_p.rodada_atual >= v_p.total_perguntas AND NOT v_p.desempate THEN
    IF v_novo_p1 = v_novo_p2 THEN
      -- Morte súbita: sorteia UMA pergunta extra de desempate.
      INSERT INTO public.brio_rodadas (partida_id, numero, pergunta_id, alternativas, letra_correta)
      SELECT v_p.id, v_p.total_perguntas + 1, q.id, q.alternativas, q.letra_correta
      FROM public.brio_questions q
      WHERE q.ativa = TRUE AND q.status = 'aprovada'
        AND NOT EXISTS (
          SELECT 1 FROM public.brio_rodadas rr
          WHERE rr.partida_id = v_p.id AND rr.pergunta_id = q.id
        )
      ORDER BY md5(q.id || v_p.id::TEXT || 'desempate')
      LIMIT 1;

      UPDATE public.brio_partidas
      SET placar_1 = v_novo_p1, placar_2 = v_novo_p2,
          acertos_1 = v_novo_a1, acertos_2 = v_novo_a2,
          desempate = TRUE,
          rodada_atual = v_p.total_perguntas + 1,
          total_perguntas = v_p.total_perguntas + 1,
          rodada_liberada_em = now() + interval '6 seconds'
      WHERE id = p_partida_id;
      RETURN public.brio_estado_partida(p_partida_id);
    END IF;

    UPDATE public.brio_partidas
    SET placar_1 = v_novo_p1, placar_2 = v_novo_p2,
        acertos_1 = v_novo_a1, acertos_2 = v_novo_a2,
        status = 'finalizado', finalizado_em = now(),
        vencedor_id = CASE WHEN v_novo_p1 > v_novo_p2 THEN v_p.jogador_1_id
                           WHEN v_novo_p2 > v_novo_p1 THEN COALESCE(v_p.jogador_2_id, v_bot_id)
                           ELSE NULL END,
        empate = (v_novo_p1 = v_novo_p2)
    WHERE id = p_partida_id;
    RETURN public.brio_estado_partida(p_partida_id);
  END IF;

  -- Rodada de DESEMPATE: quem acerta decide; se ambos acertam/erram, segue.
  IF v_p.desempate THEN
    IF (v_novo_a1 > v_p.acertos_1 OR v_novo_a2 > v_p.acertos_2)
       AND (v_novo_a1 <> v_p.acertos_1 OR v_novo_a2 <> v_p.acertos_2) THEN
      UPDATE public.brio_partidas
      SET placar_1 = v_novo_p1, placar_2 = v_novo_p2,
          acertos_1 = v_novo_a1, acertos_2 = v_novo_a2,
          status = 'finalizado', finalizado_em = now(),
          vencedor_id = CASE WHEN v_novo_p1 > v_novo_p2 THEN v_p.jogador_1_id
                             WHEN v_novo_p2 > v_novo_p1 THEN COALESCE(v_p.jogador_2_id, v_bot_id)
                             ELSE NULL END,
          empate = (v_novo_p1 = v_novo_p2)
      WHERE id = p_partida_id;
      RETURN public.brio_estado_partida(p_partida_id);
    END IF;

    IF v_p.rodada_atual - v_p.total_perguntas >= 3 THEN
      -- Limite de desempate atingido: mantém o resultado (empate é válido).
      UPDATE public.brio_partidas
      SET placar_1 = v_novo_p1, placar_2 = v_novo_p2,
          acertos_1 = v_novo_a1, acertos_2 = v_novo_a2,
          status = 'finalizado', finalizado_em = now(), empate = TRUE
      WHERE id = p_partida_id;
      RETURN public.brio_estado_partida(p_partida_id);
    END IF;

    INSERT INTO public.brio_rodadas (partida_id, numero, pergunta_id, alternativas, letra_correta)
    SELECT v_p.id, v_p.rodada_atual + 1, q.id, q.alternativas, q.letra_correta
    FROM public.brio_questions q
    WHERE q.ativa = TRUE AND q.status = 'aprovada'
      AND NOT EXISTS (
        SELECT 1 FROM public.brio_rodadas rr
        WHERE rr.partida_id = v_p.id AND rr.pergunta_id = q.id
      )
    ORDER BY md5(q.id || v_p.id::TEXT || (v_p.rodada_atual + 1)::TEXT)
    LIMIT 1;

    UPDATE public.brio_partidas
    SET placar_1 = v_novo_p1, placar_2 = v_novo_p2,
        acertos_1 = v_novo_a1, acertos_2 = v_novo_a2,
        rodada_atual = v_p.rodada_atual + 1,
        total_perguntas = v_p.total_perguntas + 1,
        rodada_liberada_em = now() + interval '6 seconds'
    WHERE id = p_partida_id;
    RETURN public.brio_estado_partida(p_partida_id);
  END IF;

  -- Rodada normal: avança.
  UPDATE public.brio_partidas
  SET placar_1 = v_novo_p1, placar_2 = v_novo_p2,
      acertos_1 = v_novo_a1, acertos_2 = v_novo_a2,
      rodada_atual = v_p.rodada_atual + 1,
      rodada_liberada_em = now() + interval '6 seconds'
  WHERE id = p_partida_id;

  RETURN public.brio_estado_partida(p_partida_id);
END
$$;

REVOKE ALL ON FUNCTION public.brio_fechar_rodada(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.brio_fechar_rodada(UUID) TO authenticated;

-- ---------- 12b. RPC: entrar numa partida aberta (link direto) ----------
-- O convidado ocupa o assento 2 de uma sala ainda 'aguardando'. Só um humano
-- por assento, e o dono da sala nunca entra como adversário de si mesmo.
CREATE OR REPLACE FUNCTION public.brio_entrar_partida(p_partida_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_p public.brio_partidas%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'não autenticado';
  END IF;

  SELECT * INTO v_p FROM public.brio_partidas WHERE id = p_partida_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'partida não encontrada';
  END IF;
  IF v_p.jogador_1_id = v_uid THEN
    RETURN public.brio_estado_partida(p_partida_id); -- já é o dono
  END IF;
  IF v_p.jogador_2_id IS NOT NULL AND v_p.jogador_2_id <> v_uid THEN
    RAISE EXCEPTION 'esta sala já tem dois jogadores';
  END IF;
  IF v_p.bot_nivel IS NOT NULL THEN
    RAISE EXCEPTION 'esta sala é contra o adversário virtual';
  END IF;
  IF v_p.status <> 'aguardando' THEN
    RAISE EXCEPTION 'esta partida já começou';
  END IF;

  UPDATE public.brio_partidas
  SET jogador_2_id = v_uid,
      status = 'em_andamento',
      iniciado_em = now(),
      rodada_atual = 1,
      rodada_liberada_em = now() + interval '6 seconds'
  WHERE id = p_partida_id;

  RETURN public.brio_estado_partida(p_partida_id);
END
$$;

REVOKE ALL ON FUNCTION public.brio_entrar_partida(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.brio_entrar_partida(UUID) TO authenticated;

-- ---------- 13. RPC: histórico do jogador ----------
CREATE OR REPLACE FUNCTION public.brio_listar_partidas(p_limite INTEGER DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_rows JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'não autenticado';
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'partida_id', p.id,
    'modalidade', p.modalidade,
    'area_slug', p.area_slug,
    'subcategoria_slug', p.subcategoria_slug,
    'meu_placar', CASE WHEN p.jogador_1_id = v_uid THEN p.placar_1 ELSE p.placar_2 END,
    'placar_oponente', CASE WHEN p.jogador_1_id = v_uid THEN p.placar_2 ELSE p.placar_1 END,
    'meus_acertos', CASE WHEN p.jogador_1_id = v_uid THEN p.acertos_1 ELSE p.acertos_2 END,
    'total_perguntas', p.total_perguntas,
    'vencedor', (p.vencedor_id = v_uid),
    'empate', p.empate,
    'contra_bot', (p.bot_nivel IS NOT NULL),
    'status', p.status,
    'criado_em', p.criado_em,
    'finalizado_em', p.finalizado_em
  ) ORDER BY p.criado_em DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT * FROM public.brio_partidas
    WHERE (jogador_1_id = v_uid OR jogador_2_id = v_uid)
    ORDER BY criado_em DESC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limite, 30), 200))
  ) p;
  RETURN v_rows;
END
$$;

REVOKE ALL ON FUNCTION public.brio_listar_partidas(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.brio_listar_partidas(INTEGER) TO authenticated;

-- ---------- 14. RPC: Índice de Conhecimento do jogador ----------
CREATE OR REPLACE FUNCTION public.brio_meu_indice()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_rows JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'não autenticado';
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'area_slug', h.area_slug,
    'theta', h.theta,
    'erro_padrao', h.erro_padrao,
    'indice', h.indice,
    'respostas', h.respostas,
    'confiabilidade', h.confiabilidade,
    'atualizado_em', h.atualizado_em
  ) ORDER BY h.area_slug NULLS FIRST), '[]'::jsonb)
  INTO v_rows
  FROM public.brio_habilidade h
  WHERE h.user_id = v_uid;
  RETURN v_rows;
END
$$;

REVOKE ALL ON FUNCTION public.brio_meu_indice() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.brio_meu_indice() TO authenticated;

-- ---------- 15. RPC: recalcular habilidade (TRI) do jogador ----------
-- Recalcula a partir do HISTÓRICO REAL de respostas. O cliente nunca informa
-- o próprio θ: ele é derivado das respostas gravadas pelo servidor.
CREATE OR REPLACE FUNCTION public.brio_recalcular_habilidade(p_janela INTEGER DEFAULT 200)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_rec RECORD;

BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'não autenticado';
  END IF;

  -- Habilidade GERAL: estimativa por EAP numa grade de quadratura com prior
  -- N(0,1) — a MESMA fórmula do motor do cliente (tri.ts). O cálculo é feito
  -- em duas etapas (grade + posterior) para ficar legível em SQL.
  DROP TABLE IF EXISTS _brio_tmp_theta;
  CREATE TEMP TABLE _brio_tmp_theta (theta NUMERIC PRIMARY KEY) ON COMMIT DROP;
  INSERT INTO _brio_tmp_theta SELECT generate_series(-4, 4, 0.1);

  DROP TABLE IF EXISTS _brio_tmp_resp;
  CREATE TEMP TABLE _brio_tmp_resp ON COMMIT DROP AS
  SELECT resp.acertou, q.tri_a, q.tri_b, q.tri_c, q.area_slug
  FROM (
    SELECT resp.* FROM public.brio_respostas resp
    WHERE resp.jogador_id = v_uid AND resp.acertou IS NOT NULL
    ORDER BY resp.respondido_em DESC
    LIMIT GREATEST(1, LEAST(COALESCE(p_janela, 200), 1000))
  ) resp
  JOIN public.brio_rodadas rod
    ON rod.partida_id = resp.partida_id AND rod.numero = resp.rodada_numero
  JOIN public.brio_questions q ON q.id = rod.pergunta_id;

  DROP TABLE IF EXISTS _brio_tmp_post;
  CREATE TEMP TABLE _brio_tmp_post ON COMMIT DROP AS
  SELECT t.theta,
         exp(-0.5 * t.theta * t.theta) *
         exp(COALESCE(SUM(CASE WHEN r.acertou
               THEN ln(GREATEST(1e-9, LEAST(1 - 1e-9, r.tri_c + (1 - r.tri_c) / (1 + exp(-r.tri_a * (t.theta - r.tri_b))))))
               ELSE ln(GREATEST(1e-9, 1 - LEAST(1 - 1e-9, r.tri_c + (1 - r.tri_c) / (1 + exp(-r.tri_a * (t.theta - r.tri_b))))))
             END), 0)) AS peso
  FROM _brio_tmp_theta t
  LEFT JOIN _brio_tmp_resp r ON TRUE
  GROUP BY t.theta;

  -- Estimativa geral (EAP).
  INSERT INTO public.brio_habilidade (user_id, area_slug, theta, erro_padrao, indice, respostas, confiabilidade)
  SELECT v_uid, NULL,
         ROUND(SUM(theta * peso) / NULLIF(SUM(peso), 0), 4),
         ROUND(SQRT(GREATEST(0, SUM(peso * theta * theta) / NULLIF(SUM(peso), 0)
                - (SUM(peso * theta) / NULLIF(SUM(peso), 0))^2)), 4),
         GREATEST(0, LEAST(100, ROUND(50 + 15 * (SUM(peso * theta) / NULLIF(SUM(peso), 0))))),
         (SELECT COUNT(*) FROM _brio_tmp_resp),
         LEAST(0.99, GREATEST(0, 1 - SQRT(GREATEST(0, SUM(peso * theta * theta) / NULLIF(SUM(peso), 0)
                - (SUM(peso * theta) / NULLIF(SUM(peso), 0))^2))))
  FROM _brio_tmp_post
  HAVING (SELECT COUNT(*) FROM _brio_tmp_resp) > 0
  ON CONFLICT (user_id, COALESCE(area_slug, '')) DO UPDATE SET
    theta = EXCLUDED.theta, erro_padrao = EXCLUDED.erro_padrao,
    indice = EXCLUDED.indice, respostas = EXCLUDED.respostas,
    confiabilidade = EXCLUDED.confiabilidade, atualizado_em = now();

  -- Habilidade POR DISCIPLINA (§5.3): uma estimativa por área.
  FOR v_rec IN SELECT DISTINCT area_slug FROM _brio_tmp_resp LOOP
    INSERT INTO public.brio_habilidade (user_id, area_slug, theta, erro_padrao, indice, respostas, confiabilidade)
    SELECT v_uid, v_rec.area_slug,
           ROUND(SUM(p.theta * p.peso) / NULLIF(SUM(p.peso), 0), 4),
           ROUND(SQRT(GREATEST(0, SUM(p.peso * p.theta * p.theta) / NULLIF(SUM(p.peso), 0)
                  - (SUM(p.peso * p.theta) / NULLIF(SUM(p.peso), 0))^2)), 4),
           GREATEST(0, LEAST(100, ROUND(50 + 15 * (SUM(p.peso * p.theta) / NULLIF(SUM(p.peso), 0))))),
           MAX(p.n_respostas),
           LEAST(0.99, GREATEST(0, 1 - SQRT(GREATEST(0, SUM(p.peso * p.theta * p.theta) / NULLIF(SUM(p.peso), 0)
                  - (SUM(p.peso * p.theta) / NULLIF(SUM(p.peso), 0))^2))))
    FROM (
      SELECT t.theta,
             exp(-0.5 * t.theta * t.theta) *
             exp(COALESCE(SUM(CASE WHEN r.acertou
                   THEN ln(GREATEST(1e-9, LEAST(1 - 1e-9, r.tri_c + (1 - r.tri_c) / (1 + exp(-r.tri_a * (t.theta - r.tri_b))))))
                   ELSE ln(GREATEST(1e-9, 1 - LEAST(1 - 1e-9, r.tri_c + (1 - r.tri_c) / (1 + exp(-r.tri_a * (t.theta - r.tri_b))))))
                 END), 0)) AS peso,
             -- COUNT da COLUNA: a grade multiplica as linhas; COUNT(*) inflaria
             -- o total de respostas (contava 81 em vez de 2).
             COUNT(r.acertou) AS n_respostas
      FROM _brio_tmp_theta t
      LEFT JOIN _brio_tmp_resp r ON r.area_slug = v_rec.area_slug
      GROUP BY t.theta
    ) p
    HAVING SUM(p.peso) > 0 AND MAX(p.n_respostas) > 0
    ON CONFLICT (user_id, COALESCE(area_slug, '')) DO UPDATE SET
      theta = EXCLUDED.theta, erro_padrao = EXCLUDED.erro_padrao,
      indice = EXCLUDED.indice, respostas = EXCLUDED.respostas,
      confiabilidade = EXCLUDED.confiabilidade, atualizado_em = now();
  END LOOP;

  RETURN public.brio_meu_indice();
END
$$;

REVOKE ALL ON FUNCTION public.brio_recalcular_habilidade(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.brio_recalcular_habilidade(INTEGER) TO authenticated;

-- ---------- 16. RPC: alimentação em LOTE (infra para milhões) ----------
-- Recebe um JSONB array de perguntas e insere/atualiza de uma vez.
-- Ignora duplicatas por assinatura (antirrepetição editorial) e devolve
-- um relatório do que entrou, do que era duplicado e do que era inválido.
CREATE OR REPLACE FUNCTION public.brio_importar_lote(p_perguntas JSONB, p_origem TEXT DEFAULT 'lote')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_inseridas INT := 0;
  v_duplicadas INT := 0;
  v_invalidas INT := 0;
  v_assimetria TEXT;
  v_id TEXT;
  v_existe BOOLEAN;
BEGIN
  IF p_perguntas IS NULL OR jsonb_typeof(p_perguntas) <> 'array' THEN
    RAISE EXCEPTION 'p_perguntas deve ser um array JSONB';
  END IF;

  FOR v_item IN SELECT jsonb_array_elements(p_perguntas) LOOP
    -- Validação mínima: 6 alternativas, gabarito válido, texto presente.
    IF jsonb_array_length(COALESCE(v_item->'alternativas', '[]'::jsonb)) <> 6
       OR COALESCE(v_item->>'letra_correta', '') NOT IN ('A','B','C','D','E','F')
       OR length(btrim(COALESCE(v_item->>'enunciado', ''))) < 10
       OR COALESCE(v_item->>'explicacao', '') = ''
       OR COALESCE(v_item->>'area_slug', '') = ''
       OR COALESCE(v_item->>'subcategoria_slug', '') = ''
    THEN
      v_invalidas := v_invalidas + 1;
      CONTINUE;
    END IF;

    -- A assinatura pode vir pronta; se não vier, é derivada do enunciado.
    v_assimetria := COALESCE(v_item->>'assinatura',
      lower(regexp_replace(v_item->>'enunciado', '[^a-zA-Z0-9]+', ' ', 'g')));

    SELECT EXISTS (SELECT 1 FROM public.brio_questions q WHERE q.assinatura = v_assimetria)
    INTO v_existe;
    IF v_existe THEN
      v_duplicadas := v_duplicadas + 1;
      CONTINUE;
    END IF;

    v_id := COALESCE(v_item->>'id', 'br-lote-' || substr(md5(v_assimetria), 1, 16));

    INSERT INTO public.brio_questions
      (id, area_slug, subcategoria_slug, dificuldade, ordem, enunciado, alternativas,
       letra_correta, explicacao, referencia, assinatura, status, ativa, versao,
       tri_a, tri_b, tri_c, tri_provisorio, origem)
    VALUES (
      v_id,
      v_item->>'area_slug',
      v_item->>'subcategoria_slug',
      COALESCE(v_item->>'dificuldade', 'dificil'),
      COALESCE((v_item->>'ordem')::INT, 3),
      v_item->>'enunciado',
      v_item->'alternativas',
      v_item->>'letra_correta',
      v_item->>'explicacao',
      v_item->>'referencia',
      v_assimetria,
      -- Lote entra como RASCUNHO: nada é publicado sem revisão (§3.1).
      'revisao',
      FALSE,
      1,
      COALESCE((v_item->>'tri_a')::NUMERIC, 1.0),
      COALESCE((v_item->>'tri_b')::NUMERIC, 0.0),
      COALESCE((v_item->>'tri_c')::NUMERIC, 0.1667),
      TRUE,
      p_origem
    )
    ON CONFLICT (id) DO NOTHING;

    IF FOUND THEN
      v_inseridas := v_inseridas + 1;
    ELSE
      v_duplicadas := v_duplicadas + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'inseridas', v_inseridas,
    'duplicadas', v_duplicadas,
    'invalidas', v_invalidas,
    'total', jsonb_array_length(p_perguntas)
  );
END
$$;

REVOKE ALL ON FUNCTION public.brio_importar_lote(JSONB, TEXT) FROM PUBLIC;
-- Importação é operação administrativa: só service_role (não o cliente).
GRANT EXECUTE ON FUNCTION public.brio_importar_lote(JSONB, TEXT) TO service_role;

-- ---------- 17. RPC: aprovar lote revisado (publicação editorial) ----------
CREATE OR REPLACE FUNCTION public.brio_aprovar_perguntas(p_ids TEXT[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n INT;
BEGIN
  UPDATE public.brio_questions
  SET status = 'aprovada', ativa = TRUE, atualizado_em = now()
  WHERE id = ANY(p_ids) AND status IN ('rascunho','revisao');
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('aprovadas', v_n);
END
$$;

REVOKE ALL ON FUNCTION public.brio_aprovar_perguntas(TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.brio_aprovar_perguntas(TEXT[]) TO service_role;

-- ---------- 18. RPC: estatísticas do acervo (diagnóstico) ----------
CREATE OR REPLACE FUNCTION public.brio_estatisticas()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_perguntas', COUNT(*),
    'aprovadas', COUNT(*) FILTER (WHERE status = 'aprovada'),
    'em_revisao', COUNT(*) FILTER (WHERE status = 'revisao'),
    'retiradas', COUNT(*) FILTER (WHERE status = 'retirada'),
    'por_area', COALESCE((
      SELECT jsonb_object_agg(area_slug, c) FROM (
        SELECT area_slug, COUNT(*) AS c FROM public.brio_questions
        WHERE status = 'aprovada' GROUP BY area_slug
      ) x
    ), '{}'::jsonb),
    'por_dificuldade', COALESCE((
      SELECT jsonb_object_agg(dificuldade, c) FROM (
        SELECT dificuldade, COUNT(*) AS c FROM public.brio_questions
        WHERE status = 'aprovada' GROUP BY dificuldade
      ) y
    ), '{}'::jsonb),
    'calibradas', COUNT(*) FILTER (WHERE tri_provisorio = FALSE),
    'total_partidas', (SELECT COUNT(*) FROM public.brio_partidas),
    'total_respostas', (SELECT COUNT(*) FROM public.brio_respostas)
  )
  FROM public.brio_questions;
$$;

REVOKE ALL ON FUNCTION public.brio_estatisticas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.brio_estatisticas() TO anon, authenticated, service_role;

-- ---------- 19. Seed: categorias ----------
INSERT INTO public.brio_categorias (slug, area_slug, nome, icone)
VALUES
  ('ciencias', NULL, 'Ciências', '🧪'),
  ('fisica', 'ciencias', 'Física', NULL),
  ('quimica', 'ciencias', 'Química', NULL),
  ('biologia', 'ciencias', 'Biologia', NULL),
  ('astronomia', 'ciencias', 'Astronomia', NULL),
  ('geologia', 'ciencias', 'Geologia', NULL),
  ('ecologia', 'ciencias', 'Ecologia', NULL),
  ('neurociencia', 'ciencias', 'Neurociência', NULL),
  ('genetica', 'ciencias', 'Genética', NULL),
  ('biotecnologia', 'ciencias', 'Biotecnologia', NULL),
  ('ciencias-ambientais', 'ciencias', 'Ciências ambientais', NULL),
  ('exatas', NULL, 'Matemática e Ciências Exatas', '📐'),
  ('matematica-basica', 'exatas', 'Matemática básica', NULL),
  ('algebra', 'exatas', 'Álgebra', NULL),
  ('geometria', 'exatas', 'Geometria', NULL),
  ('trigonometria', 'exatas', 'Trigonometria', NULL),
  ('calculo', 'exatas', 'Cálculo', NULL),
  ('estatistica', 'exatas', 'Estatística', NULL),
  ('probabilidade', 'exatas', 'Probabilidade', NULL),
  ('logica-matematica', 'exatas', 'Lógica matemática', NULL),
  ('matematica-financeira', 'exatas', 'Matemática financeira', NULL),
  ('tecnologia', NULL, 'Tecnologia e Computação', '💻'),
  ('ciencia-da-computacao', 'tecnologia', 'Ciência da computação', NULL),
  ('programacao', 'tecnologia', 'Programação', NULL),
  ('inteligencia-artificial', 'tecnologia', 'Inteligência artificial', NULL),
  ('engenharia-de-software', 'tecnologia', 'Engenharia de software', NULL),
  ('redes', 'tecnologia', 'Redes de computadores', NULL),
  ('seguranca-da-informacao', 'tecnologia', 'Segurança da informação', NULL),
  ('banco-de-dados', 'tecnologia', 'Banco de dados', NULL),
  ('algoritmos', 'tecnologia', 'Algoritmos', NULL),
  ('eletronica', 'tecnologia', 'Eletrônica', NULL),
  ('robotica', 'tecnologia', 'Robótica', NULL),
  ('filosofia', NULL, 'Filosofia e Pensamento', '🏛️'),
  ('filosofia-antiga', 'filosofia', 'Filosofia antiga', NULL),
  ('filosofia-moderna', 'filosofia', 'Filosofia moderna', NULL),
  ('filosofia-contemporanea', 'filosofia', 'Filosofia contemporânea', NULL),
  ('etica', 'filosofia', 'Ética', NULL),
  ('metafisica', 'filosofia', 'Metafísica', NULL),
  ('epistemologia', 'filosofia', 'Epistemologia', NULL),
  ('logica', 'filosofia', 'Lógica', NULL),
  ('filosofia-politica', 'filosofia', 'Filosofia política', NULL),
  ('filosofia-da-ciencia', 'filosofia', 'Filosofia da ciência', NULL),
  ('humanas', NULL, 'Ciências Humanas e Sociais', '🌍'),
  ('sociologia', 'humanas', 'Sociologia', NULL),
  ('antropologia', 'humanas', 'Antropologia', NULL),
  ('ciencia-politica', 'humanas', 'Ciência política', NULL),
  ('economia', 'humanas', 'Economia', NULL),
  ('historia-das-civilizacoes', 'humanas', 'História das civilizações', NULL),
  ('geopolitica', 'humanas', 'Geopolítica', NULL),
  ('relacoes-internacionais', 'humanas', 'Relações internacionais', NULL),
  ('direito', 'humanas', 'Direito', NULL),
  ('arqueologia', 'humanas', 'Arqueologia', NULL),
  ('demografia', 'humanas', 'Demografia', NULL),
  ('psicologia', NULL, 'Psicologia e Comportamento', '🧠'),
  ('psicologia-cognitiva', 'psicologia', 'Psicologia cognitiva', NULL),
  ('psicologia-social', 'psicologia', 'Psicologia social', NULL),
  ('psicologia-comportamental', 'psicologia', 'Psicologia comportamental', NULL),
  ('neuropsicologia', 'psicologia', 'Neuropsicologia', NULL),
  ('desenvolvimento-humano', 'psicologia', 'Desenvolvimento humano', NULL),
  ('psicanalise', 'psicologia', 'Psicanálise', NULL),
  ('teorias-da-personalidade', 'psicologia', 'Teorias da personalidade', NULL),
  ('comportamento-coletivo', 'psicologia', 'Comportamento coletivo', NULL),
  ('historia', NULL, 'História', '📜'),
  ('historia-antiga', 'historia', 'História antiga', NULL),
  ('historia-medieval', 'historia', 'História medieval', NULL),
  ('historia-moderna', 'historia', 'História moderna', NULL),
  ('historia-contemporanea', 'historia', 'História contemporânea', NULL),
  ('historia-do-brasil', 'historia', 'História do Brasil', NULL),
  ('historia-da-america', 'historia', 'História da América', NULL),
  ('historia-da-africa', 'historia', 'História da África', NULL),
  ('historia-da-asia', 'historia', 'História da Ásia', NULL),
  ('guerras-e-revolucoes', 'historia', 'Guerras e revoluções', NULL),
  ('personalidades-historicas', 'historia', 'Grandes personalidades históricas', NULL),
  ('geografia', NULL, 'Geografia', '🗺️'),
  ('geografia-fisica', 'geografia', 'Geografia física', NULL),
  ('geografia-humana', 'geografia', 'Geografia humana', NULL),
  ('cartografia', 'geografia', 'Cartografia', NULL),
  ('climatologia', 'geografia', 'Climatologia', NULL),
  ('paises-e-capitais', 'geografia', 'Países e capitais', NULL),
  ('oceanografia', 'geografia', 'Oceanografia', NULL),
  ('geografia-economica', 'geografia', 'Geografia econômica', NULL),
  ('artes', NULL, 'Artes e Cultura', '🎭'),
  ('literatura', 'artes', 'Literatura', NULL),
  ('musica', 'artes', 'Música', NULL),
  ('cinema', 'artes', 'Cinema', NULL),
  ('teatro', 'artes', 'Teatro', NULL),
  ('artes-visuais', 'artes', 'Artes visuais', NULL),
  ('arquitetura', 'artes', 'Arquitetura', NULL),
  ('mitologia', 'artes', 'Mitologia', NULL),
  ('historia-da-arte', 'artes', 'História da arte', NULL),
  ('outras', NULL, 'Outras Áreas', '🎯'),
  ('medicina-e-saude', 'outras', 'Medicina e saúde', NULL),
  ('engenharia', 'outras', 'Engenharia', NULL),
  ('administracao', 'outras', 'Administração', NULL),
  ('contabilidade', 'outras', 'Contabilidade', NULL),
  ('astronautica', 'outras', 'Astronáutica', NULL),
  ('agricultura', 'outras', 'Agricultura', NULL),
  ('linguistica', 'outras', 'Linguística', NULL),
  ('religioes', 'outras', 'Religiões e mitologias', NULL),
  ('esportes', 'outras', 'Esportes', NULL),
  ('conhecimentos-gerais', 'outras', 'Conhecimentos gerais', NULL)
ON CONFLICT (slug) DO UPDATE SET
  area_slug = EXCLUDED.area_slug,
  nome = EXCLUDED.nome,
  icone = EXCLUDED.icone,
  ativa = TRUE;

-- ---------- 20. Seed: perguntas curadas (49) ----------
INSERT INTO public.brio_questions
  (id, area_slug, subcategoria_slug, dificuldade, ordem, enunciado, alternativas,
   letra_correta, explicacao, referencia, assinatura, status, ativa, versao)
VALUES
  ('br-astronomia-01', 'ciencias', 'astronomia', 'facil', 1, 'Qual planeta do Sistema Solar tem o dia mais longo em relação ao seu próprio ano — ou seja, gira tão devagar que um dia dura mais que um ano?', '[{"letra":"A","texto":"Saturno"},{"letra":"B","texto":"Netuno"},{"letra":"C","texto":"Vênus"},{"letra":"D","texto":"Mercúrio"},{"letra":"E","texto":"Marte"},{"letra":"F","texto":"Júpiter"}]'::jsonb, 'C', 'Vênus gira em torno do próprio eixo em cerca de 243 dias terrestres, enquanto completa uma volta ao redor do Sol em cerca de 225 dias. O dia venusiano é, portanto, mais longo que o ano venusiano. Além disso, gira em sentido retrógrado.', 'NASA Science — Venus Facts (science.nasa.gov/venus)', 'qual planeta do sistema solar tem o dia mais longo em relacao ao seu proprio ano ou seja gira tao devagar que um dia dura mais que um ano##jupiter|marte|mercurio|netuno|saturno|venus', 'aprovada', TRUE, 1),
  ('br-astronomia-02', 'ciencias', 'astronomia', 'intermediaria', 2, 'A luz do Sol leva aproximadamente quanto tempo para chegar à Terra?', '[{"letra":"A","texto":"Cerca de 8 segundos"},{"letra":"B","texto":"Cerca de 24 horas"},{"letra":"C","texto":"Cerca de 8 minutos"},{"letra":"D","texto":"Cerca de 1,3 segundo"},{"letra":"E","texto":"Cerca de 3 minutos"},{"letra":"F","texto":"Cerca de 8 horas"}]'::jsonb, 'C', 'A distância média Terra–Sol é de cerca de 149,6 milhões de km (1 unidade astronômica). Dividida pela velocidade da luz (≈300.000 km/s), resulta em aproximadamente 500 segundos, isto é, cerca de 8 minutos e 20 segundos.', 'NASA — Sun Fact Sheet (nssdc.gsfc.nasa.gov)', 'a luz do sol leva aproximadamente quanto tempo para chegar a terra##cerca de 1 3 segundo|cerca de 24 horas|cerca de 3 minutos|cerca de 8 horas|cerca de 8 minutos|cerca de 8 segundos', 'aprovada', TRUE, 1),
  ('br-fisica-01', 'ciencias', 'fisica', 'intermediaria', 2, 'No vácuo, uma pena e um martelo soltos da mesma altura caem simultaneamente. Qual princípio explica esse resultado?', '[{"letra":"A","texto":"A gravidade atua igual sobre todos os corpos, independentemente da massa"},{"letra":"B","texto":"A força gravitacional é maior sobre a pena"},{"letra":"C","texto":"O vácuo anula a massa dos corpos"},{"letra":"D","texto":"A inércia da pena é maior que a do martelo"},{"letra":"E","texto":"O martelo cria uma esteira de ar que empurra a pena"},{"letra":"F","texto":"A pena tem massa desprezível e por isso flutua"}]'::jsonb, 'A', 'A aceleração da gravidade é independente da massa do corpo: em queda livre, a = g. A diferença observada na atmosfera vem da resistência do ar, que depende da forma e da velocidade, não da massa. O experimento foi demonstrado na Lua pela Apollo 15 (1971).', 'NASA — Apollo 15 feather and hammer drop (1971)', 'no vacuo uma pena e um martelo soltos da mesma altura caem simultaneamente qual principio explica esse resultado##a forca gravitacional e maior sobre a pena|a gravidade atua igual sobre todos os corpos independentemente da massa|a inercia da pena e maior que a do martelo|a pena tem massa desprezivel e por isso flutua|o martelo cria uma esteira de ar que empurra a pena|o vacuo anula a massa dos corpos', 'aprovada', TRUE, 1),
  ('br-fisica-02', 'ciencias', 'fisica', 'avancada', 4, 'Qual grandeza física NÃO se conserva em um processo com atrito, sendo justamente convertida em energia térmica?', '[{"letra":"A","texto":"Momento angular"},{"letra":"B","texto":"Energia total"},{"letra":"C","texto":"Massa-energia"},{"letra":"D","texto":"Momento linear total"},{"letra":"E","texto":"Energia mecânica"},{"letra":"F","texto":"Carga elétrica"}]'::jsonb, 'E', 'A energia TOTAL sempre se conserva, mas a energia MECÂNICA (cinética + potencial) não: o atrito a dissipa como calor. O momento linear e a carga elétrica também se conservam no processo; a energia mecânica é a que ''some'' como movimento organizado.', 'Halliday, Resnick & Walker — Fundamentos de Física, vol. 1', 'qual grandeza fisica nao se conserva em um processo com atrito sendo justamente convertida em energia termica##carga eletrica|energia mecanica|energia total|massa energia|momento angular|momento linear total', 'aprovada', TRUE, 1),
  ('br-biologia-01', 'ciencias', 'biologia', 'facil', 1, 'Qual organela é responsável pela respiração celular e pela produção de ATP?', '[{"letra":"A","texto":"Complexo de Golgi"},{"letra":"B","texto":"Peroxissomo"},{"letra":"C","texto":"Retículo endoplasmático liso"},{"letra":"D","texto":"Lisossomo"},{"letra":"E","texto":"Ribossomo"},{"letra":"F","texto":"Mitocôndria"}]'::jsonb, 'F', 'A mitocôndria realiza a respiração celular aeróbica, produzindo ATP por fosforilação oxidativa na cadeia transportadora de elétrons da membrana interna. Os ribossomos sintetizam proteínas; os lisossomos fazem digestão intracelular.', 'Alberts et al. — Biologia Molecular da Célula', 'qual organela e responsavel pela respiracao celular e pela producao de atp##complexo de golgi|lisossomo|mitocondria|peroxissomo|reticulo endoplasmatico liso|ribossomo', 'aprovada', TRUE, 1),
  ('br-genetica-01', 'ciencias', 'genetica', 'intermediaria', 2, 'No cruzamento entre dois indivíduos heterozigotos (Aa × Aa), qual é a proporção fenotípica esperada, com dominância completa?', '[{"letra":"A","texto":"2:1"},{"letra":"B","texto":"1:1:1:1"},{"letra":"C","texto":"9:3:3:1"},{"letra":"D","texto":"1:1"},{"letra":"E","texto":"3:1"},{"letra":"F","texto":"1:2:1"}]'::jsonb, 'E', 'O quadro de Punnett dá genótipos 1 AA : 2 Aa : 1 aa. Com dominância completa, AA e Aa têm o mesmo fenótipo, resultando em 3 dominantes : 1 recessivo. A proporção 1:2:1 é a GENOTÍPICA; 9:3:3:1 é de dois genes independentes.', 'Mendel (1866) — leis da segregação; Griffiths et al., Introdução à Genética', 'no cruzamento entre dois individuos heterozigotos aa aa qual e a proporcao fenotipica esperada com dominancia completa##1 1|1 1 1 1|1 2 1|2 1|3 1|9 3 3 1', 'aprovada', TRUE, 1),
  ('br-neurociencia-01', 'ciencias', 'neurociencia', 'avancada', 4, 'Qual estrutura cerebral é classicamente associada à consolidação de memórias declarativas de longo prazo?', '[{"letra":"A","texto":"Bulbo raquidiano"},{"letra":"B","texto":"Núcleo caudado"},{"letra":"C","texto":"Hipocampo"},{"letra":"D","texto":"Tálamo"},{"letra":"E","texto":"Amígdala"},{"letra":"F","texto":"Cerebelo"}]'::jsonb, 'C', 'O hipocampo e as estruturas do lobo temporal medial são essenciais para consolidar memórias declarativas (episódicas e semânticas). O caso clínico H.M., estudado por Brenda Milner, mostrou que sua remoção bilateral impedia formar novas memórias declarativas, preservando memórias procedurais.', 'Scoville & Milner (1957), Journal of Neurology, Neurosurgery & Psychiatry', 'qual estrutura cerebral e classicamente associada a consolidacao de memorias declarativas de longo prazo##amigdala|bulbo raquidiano|cerebelo|hipocampo|nucleo caudado|talamo', 'aprovada', TRUE, 1),
  ('br-quimica-01', 'ciencias', 'quimica', 'intermediaria', 2, 'Qual é o pH de uma solução aquosa com concentração de H⁺ igual a 1 × 10⁻³ mol/L?', '[{"letra":"A","texto":"pH = 13"},{"letra":"B","texto":"pH = 11"},{"letra":"C","texto":"pH = 7"},{"letra":"D","texto":"pH = 0,3"},{"letra":"E","texto":"pH = 3"},{"letra":"F","texto":"pH = 1"}]'::jsonb, 'E', 'pH = −log₁₀[H⁺]. Com [H⁺] = 10⁻³, pH = 3. A solução é ácida. O valor 11 seria o pH do par básico conjugado (pOH = 11) e 0,3 confundiria a concentração com o logaritmo.', 'Atkins & Jones — Princípios de Química', 'qual e o ph de uma solucao aquosa com concentracao de h igual a 1 10 mol l##ph 0 3|ph 1|ph 11|ph 13|ph 3|ph 7', 'aprovada', TRUE, 1),
  ('br-ecologia-01', 'ciencias', 'ecologia', 'dificil', 3, 'Em uma cadeia alimentar, a quantidade de energia disponível para o nível trófico seguinte é tipicamente:', '[{"letra":"A","texto":"Cerca de 90% da do nível anterior"},{"letra":"B","texto":"Igual à do nível anterior"},{"letra":"C","texto":"Independente do nível trófico"},{"letra":"D","texto":"Metade da do nível anterior"},{"letra":"E","texto":"O dobro da do nível anterior"},{"letra":"F","texto":"Cerca de 10% da do nível anterior"}]'::jsonb, 'F', 'A ''regra dos 10%'' (Lindeman, 1942) estima que apenas cerca de 10% da energia de um nível trófico é transferida ao seguinte; o restante se perde em respiração, calor e matéria não assimilada. É por isso que as cadeias têm poucos níveis.', 'Lindeman (1942), Ecology, 23(4) — trophic-dynamic aspect of ecology', 'em uma cadeia alimentar a quantidade de energia disponivel para o nivel trofico seguinte e tipicamente##cerca de 10 da do nivel anterior|cerca de 90 da do nivel anterior|igual a do nivel anterior|independente do nivel trofico|metade da do nivel anterior|o dobro da do nivel anterior', 'aprovada', TRUE, 1),
  ('br-geometria-01', 'exatas', 'geometria', 'facil', 1, 'Quantas faces tem um dodecaedro regular?', '[{"letra":"A","texto":"6"},{"letra":"B","texto":"10"},{"letra":"C","texto":"20"},{"letra":"D","texto":"12"},{"letra":"E","texto":"8"},{"letra":"F","texto":"24"}]'::jsonb, 'D', 'O dodecaedro regular tem 12 faces pentagonais, 20 vértices e 30 arestas (satisfaz a relação de Euler V − A + F = 2: 20 − 30 + 12 = 2). É um dos cinco sólidos platônicos.', 'Euclides — Elementos, Livro XIII', 'quantas faces tem um dodecaedro regular##10|12|20|24|6|8', 'aprovada', TRUE, 1),
  ('br-probabilidade-01', 'exatas', 'probabilidade', 'intermediaria', 2, 'Ao lançar dois dados honestos de 6 faces, qual é a probabilidade de a soma ser 7?', '[{"letra":"A","texto":"1/6"},{"letra":"B","texto":"1/3"},{"letra":"C","texto":"7/36"},{"letra":"D","texto":"1/12"},{"letra":"E","texto":"5/36"},{"letra":"F","texto":"1/36"}]'::jsonb, 'A', 'São 36 resultados equiprováveis. A soma 7 ocorre em 6 deles: (1,6), (2,5), (3,4), (4,3), (5,2), (6,1). Logo 6/36 = 1/6. A soma 7 é a mais provável por ter o maior número de combinações.', 'Feller — An Introduction to Probability Theory and Its Applications', 'ao lancar dois dados honestos de 6 faces qual e a probabilidade de a soma ser 7##1 12|1 3|1 36|1 6|5 36|7 36', 'aprovada', TRUE, 1),
  ('br-logica-matematica-01', 'exatas', 'logica-matematica', 'dificil', 3, 'Qual das proposições abaixo é a CONTRAPOSITIVA de «Se chove, então a rua fica molhada»?', '[{"letra":"A","texto":"Se não chove, então a rua não fica molhada"},{"letra":"B","texto":"Não chove ou a rua fica molhada"},{"letra":"C","texto":"Se a rua fica molhada, então chove"},{"letra":"D","texto":"Se a rua não fica molhada, então não chove"},{"letra":"E","texto":"A rua fica molhada apenas se chover"},{"letra":"F","texto":"Chove e a rua não fica molhada"}]'::jsonb, 'D', 'A contrapositiva de P → Q é ¬Q → ¬P, e é logicamente EQUIVALENTE ao condicional original. A recíproca (Q → P) e a inversa (¬P → ¬Q) NÃO são equivalentes. A opção «Não chove ou a rua fica molhada» descreve a equivalência material (¬P ∨ Q), que também é válida, mas não é a contrapositiva.', 'Copi & Cohen — Introdução à Lógica', 'qual das proposicoes abaixo e a contrapositiva de se chove entao a rua fica molhada##a rua fica molhada apenas se chover|chove e a rua nao fica molhada|nao chove ou a rua fica molhada|se a rua fica molhada entao chove|se a rua nao fica molhada entao nao chove|se nao chove entao a rua nao fica molhada', 'aprovada', TRUE, 1),
  ('br-calculo-01', 'exatas', 'calculo', 'avancada', 4, 'Qual é a derivada de f(x) = ln(x) para x > 0?', '[{"letra":"A","texto":"1/x"},{"letra":"B","texto":"x·ln(x) − x"},{"letra":"C","texto":"e^x"},{"letra":"D","texto":"ln(x)/x"},{"letra":"E","texto":"x"},{"letra":"F","texto":"−1/x²"}]'::jsonb, 'A', 'd/dx ln(x) = 1/x para x > 0. É a função cuja taxa de variação relativa é constante. A primitiva de ln(x) é x·ln(x) − x + C (a opção x·ln(x) − x), e −1/x² é a derivada de 1/x.', 'Stewart — Cálculo, vol. 1', 'qual e a derivada de f x ln x para x 0##1 x|1 x|e x|ln x x|x|x ln x x', 'aprovada', TRUE, 1),
  ('br-estatistica-01', 'exatas', 'estatistica', 'dificil', 3, 'Em uma distribuição fortemente assimétrica à direita, qual relação entre média, mediana e moda é tipicamente observada?', '[{"letra":"A","texto":"Média = Moda, mediana maior"},{"letra":"B","texto":"Média > Mediana > Moda"},{"letra":"C","texto":"Média < Mediana < Moda"},{"letra":"D","texto":"Moda > Mediana > Média"},{"letra":"E","texto":"Mediana > Média > Moda"},{"letra":"F","texto":"Média = Mediana = Moda"}]'::jsonb, 'B', 'Na assimetria à direita (cauda longa nos valores altos), a média é ''puxada'' pelos valores extremos e fica maior que a mediana, que por sua vez tende a ser maior que a moda. É o oposto da assimetria à esquerda.', 'Moore, McCabe & Craig — Introdução à Prática da Estatística', 'em uma distribuicao fortemente assimetrica a direita qual relacao entre media mediana e moda e tipicamente observada##media mediana moda|media mediana moda|media mediana moda|media moda mediana maior|mediana media moda|moda mediana media', 'aprovada', TRUE, 1),
  ('br-matematica-basica-01', 'exatas', 'matematica-basica', 'facil', 1, 'Qual é o valor de 7! (sete fatorial)?', '[{"letra":"A","texto":"840"},{"letra":"B","texto":"5040"},{"letra":"C","texto":"362880"},{"letra":"D","texto":"720"},{"letra":"E","texto":"40320"},{"letra":"F","texto":"2520"}]'::jsonb, 'B', '7! = 7 × 6 × 5 × 4 × 3 × 2 × 1 = 5040. O valor 720 é 6! e 40320 é 8!. O fatorial cresce muito rápido: 10! já passa de 3,6 milhões.', 'Convenção matemática padrão para o fatorial', 'qual e o valor de 7 sete fatorial##2520|362880|40320|5040|720|840', 'aprovada', TRUE, 1),
  ('br-algoritmos-01', 'tecnologia', 'algoritmos', 'intermediaria', 2, 'Qual é a complexidade de tempo MÉDIA da busca binária em um vetor ordenado de n elementos?', '[{"letra":"A","texto":"O(2ⁿ)"},{"letra":"B","texto":"O(1)"},{"letra":"C","texto":"O(n log n)"},{"letra":"D","texto":"O(log n)"},{"letra":"E","texto":"O(n²)"},{"letra":"F","texto":"O(n)"}]'::jsonb, 'D', 'A busca binária descarta metade do espaço a cada comparação, resultando em O(log n). Ela exige o vetor ORDENADO — em vetor desordenado a busca é O(n). Ordenar antes custa O(n log n), o que só compensa com muitas buscas.', 'Cormen et al. — Algoritmos: Teoria e Prática', 'qual e a complexidade de tempo media da busca binaria em um vetor ordenado de n elementos##o 1|o 2|o log n|o n|o n|o n log n', 'aprovada', TRUE, 1),
  ('br-banco-de-dados-01', 'tecnologia', 'banco-de-dados', 'dificil', 3, 'Em bancos relacionais, qual propriedade ACID garante que uma transação seja aplicada por inteiro ou não seja aplicada de forma alguma?', '[{"letra":"A","texto":"Durabilidade"},{"letra":"B","texto":"Atomicidade"},{"letra":"C","texto":"Consistência"},{"letra":"D","texto":"Isolamento"},{"letra":"E","texto":"Idempotência"},{"letra":"F","texto":"Normalização"}]'::jsonb, 'B', 'A atomicidade (''tudo ou nada'') garante que a transação não deixe efeitos parciais: se uma parte falha, tudo é desfeito. Consistência mantém as regras do banco, isolamento evita interferência entre transações concorrentes e durabilidade garante persistência após o commit.', 'Silberschatz, Korth & Sudarshan — Sistema de Banco de Dados', 'em bancos relacionais qual propriedade acid garante que uma transacao seja aplicada por inteiro ou nao seja aplicada de forma alguma##atomicidade|consistencia|durabilidade|idempotencia|isolamento|normalizacao', 'aprovada', TRUE, 1),
  ('br-seguranca-01', 'tecnologia', 'seguranca-da-informacao', 'avancada', 4, 'Por que senhas NÃO devem ser armazenadas com funções de hash genéricas rápidas como SHA-256, mas sim com algoritmos como bcrypt, scrypt ou Argon2?', '[{"letra":"A","texto":"Porque bcrypt dispensa o uso de salt"},{"letra":"B","texto":"Porque SHA-256 não aceita caracteres especiais"},{"letra":"C","texto":"Porque bcrypt criptografa e permite recuperar a senha original"},{"letra":"D","texto":"Porque algoritmos de derivação de chave são deliberadamente lentos e ajustáveis, encarecendo ataques de força bruta"},{"letra":"E","texto":"Porque SHA-256 produz hashes muito curtos"},{"letra":"F","texto":"Porque SHA-256 é reversível"}]'::jsonb, 'D', 'Funções como SHA-256 são otimizadas para velocidade, o que favorece quem tenta bilhões de palpites por segundo. bcrypt/scrypt/Argon2 são deliberadamente custosos (fator de trabalho, memória) e usam salt, tornando cada tentativa muito mais cara. Nenhuma delas é reversível: hash de senha nunca deve ser descriptografado.', 'OWASP — Password Storage Cheat Sheet', 'por que senhas nao devem ser armazenadas com funcoes de hash genericas rapidas como sha 256 mas sim com algoritmos como bcrypt scrypt ou argon2##porque algoritmos de derivacao de chave sao deliberadamente lentos e ajustaveis encarecendo ataques de forca bruta|porque bcrypt criptografa e permite recuperar a senha original|porque bcrypt dispensa o uso de salt|porque sha 256 e reversivel|porque sha 256 nao aceita caracteres especiais|porque sha 256 produz hashes muito curtos', 'aprovada', TRUE, 1),
  ('br-ia-01', 'tecnologia', 'inteligencia-artificial', 'dificil', 3, 'Em aprendizado de máquina, o que caracteriza o ''sobreajuste'' (overfitting)?', '[{"letra":"A","texto":"O modelo vai bem no treino mas mal em dados novos"},{"letra":"B","texto":"O modelo ignora os dados de treino"},{"letra":"C","texto":"O modelo treina rápido demais"},{"letra":"D","texto":"O modelo só funciona com dados tabulares"},{"letra":"E","texto":"O modelo usa poucos parâmetros"},{"letra":"F","texto":"O modelo erra tanto no treino quanto nos dados novos"}]'::jsonb, 'A', 'No sobreajuste o modelo memoriza ruídos e particularidades do treino, perdendo capacidade de generalizar — daí o desempenho ruim em dados não vistos. O caso oposto (erro alto nos dois) é o subajuste.', 'Bishop — Pattern Recognition and Machine Learning', 'em aprendizado de maquina o que caracteriza o sobreajuste overfitting##o modelo erra tanto no treino quanto nos dados novos|o modelo ignora os dados de treino|o modelo so funciona com dados tabulares|o modelo treina rapido demais|o modelo usa poucos parametros|o modelo vai bem no treino mas mal em dados novos', 'aprovada', TRUE, 1),
  ('br-redes-01', 'tecnologia', 'redes', 'intermediaria', 2, 'Em qual camada do modelo OSI atuam protocolos como TCP e UDP?', '[{"letra":"A","texto":"Camada de rede"},{"letra":"B","texto":"Camada de enlace"},{"letra":"C","texto":"Camada de sessão"},{"letra":"D","texto":"Camada física"},{"letra":"E","texto":"Camada de transporte"},{"letra":"F","texto":"Camada de aplicação"}]'::jsonb, 'E', 'TCP e UDP são protocolos da camada de TRANSPORTE (camada 4), responsáveis por portas, segmentação e controle de fluxo/confiabilidade. IP pertence à camada de rede (3) e Ethernet à de enlace (2).', 'Tanenbaum & Wetherall — Redes de Computadores', 'em qual camada do modelo osi atuam protocolos como tcp e udp##camada de aplicacao|camada de enlace|camada de rede|camada de sessao|camada de transporte|camada fisica', 'aprovada', TRUE, 1),
  ('br-programacao-01', 'tecnologia', 'programacao', 'facil', 1, 'Em programação, o que é uma ''função pura''?', '[{"letra":"A","texto":"Uma função cujo resultado depende apenas dos argumentos e que não produz efeitos colaterais"},{"letra":"B","texto":"Uma função que nunca lança exceções"},{"letra":"C","texto":"Uma função que só usa números inteiros"},{"letra":"D","texto":"Uma função que roda apenas uma vez"},{"letra":"E","texto":"Uma função sem parâmetros"},{"letra":"F","texto":"Uma função que não tem retorno"}]'::jsonb, 'A', 'Função pura: mesmo argumento ⇒ mesmo resultado, e nenhum efeito colateral (não altera estado externo, não escreve em disco, não faz rede). É a base do código testável e do determinismo — exatamente o que usamos nos motores deste jogo.', 'Abelson & Sussman — Structure and Interpretation of Computer Programs', 'em programacao o que e uma funcao pura##uma funcao cujo resultado depende apenas dos argumentos e que nao produz efeitos colaterais|uma funcao que nao tem retorno|uma funcao que nunca lanca excecoes|uma funcao que roda apenas uma vez|uma funcao que so usa numeros inteiros|uma funcao sem parametros', 'aprovada', TRUE, 1),
  ('br-filosofia-antiga-01', 'filosofia', 'filosofia-antiga', 'intermediaria', 2, 'Qual filósofo grego é conhecido pela formulação do ''problema da mudança'' e pela imagem de que ninguém entra duas vezes no mesmo rio?', '[{"letra":"A","texto":"Demócrito"},{"letra":"B","texto":"Anaximandro"},{"letra":"C","texto":"Parmênides"},{"letra":"D","texto":"Pitágoras"},{"letra":"E","texto":"Heráclito"},{"letra":"F","texto":"Zenão de Eleia"}]'::jsonb, 'E', 'Heráclito de Éfeso (c. 535–475 a.C.) defendia o devir — tudo flui. A imagem do rio é atribuída a ele pela tradição (Platão, Crátilo). Parmênides, ao contrário, negava a mudança; Zenão criou paradoxos para defender essa negação.', 'Platão — Crátilo; fragmentos DK 22 B12', 'qual filosofo grego e conhecido pela formulacao do problema da mudanca e pela imagem de que ninguem entra duas vezes no mesmo rio##anaximandro|democrito|heraclito|parmenides|pitagoras|zenao de eleia', 'aprovada', TRUE, 1),
  ('br-epistemologia-01', 'filosofia', 'epistemologia', 'avancada', 4, 'O ''problema da indução'' formulado por David Hume aponta que:', '[{"letra":"A","texto":"A generalização de casos observados para todos os casos não tem justificação puramente racional"},{"letra":"B","texto":"Toda dedução é inválida"},{"letra":"C","texto":"O conhecimento inato é impossível"},{"letra":"D","texto":"A ciência não pode usar matemática"},{"letra":"E","texto":"A experiência é irrelevante para o conhecimento"},{"letra":"F","texto":"Todo enunciado é verificável"}]'::jsonb, 'A', 'Hume mostrou que inferir ''todos os A são B'' a partir de ''alguns A são B'' não é dedutivamente válido, e que justificar a indução pela regularidade da natureza seria circular. É o problema que Kant tentou responder e que Popper tratou com a falseabilidade.', 'Hume — Investigação sobre o Entendimento Humano, seção IV', 'o problema da inducao formulado por david hume aponta que##a ciencia nao pode usar matematica|a experiencia e irrelevante para o conhecimento|a generalizacao de casos observados para todos os casos nao tem justificacao puramente racional|o conhecimento inato e impossivel|toda deducao e invalida|todo enunciado e verificavel', 'aprovada', TRUE, 1),
  ('br-etica-01', 'filosofia', 'etica', 'dificil', 3, 'O imperativo categórico de Kant afirma que devemos agir:', '[{"letra":"A","texto":"Conforme as consequências previsíveis da ação"},{"letra":"B","texto":"Segundo o costume da nossa comunidade"},{"letra":"C","texto":"Somente segundo uma máxima que possamos querer que se torne lei universal"},{"letra":"D","texto":"Buscando a maior felicidade para o maior número de pessoas"},{"letra":"E","texto":"Para maximizar o lucro racional"},{"letra":"F","texto":"Movidos exclusivamente pela compaixão"}]'::jsonb, 'C', 'A primeira formulação do imperativo categórico exige universalizabilidade da máxima. Kant rejeita fundamentar a moral nas consequências (essa é a leitura utilitarista) e no costume. Trata a pessoa sempre como fim, nunca apenas como meio.', 'Kant — Fundamentação da Metafísica dos Costumes (1785)', 'o imperativo categorico de kant afirma que devemos agir##buscando a maior felicidade para o maior numero de pessoas|conforme as consequencias previsiveis da acao|movidos exclusivamente pela compaixao|para maximizar o lucro racional|segundo o costume da nossa comunidade|somente segundo uma maxima que possamos querer que se torne lei universal', 'aprovada', TRUE, 1),
  ('br-filosofia-da-ciencia-01', 'filosofia', 'filosofia-da-ciencia', 'especialista', 5, 'Para Karl Popper, o critério que distingue uma teoria científica de uma pseudociência é:', '[{"letra":"A","texto":"A capacidade de explicar tudo"},{"letra":"B","texto":"O uso de matemática avançada"},{"letra":"C","texto":"A quantidade de evidências favoráveis acumuladas"},{"letra":"D","texto":"O consenso da comunidade científica"},{"letra":"E","texto":"A origem experimental dos dados"},{"letra":"F","texto":"A falseabilidade — a teoria deve proibir certos estados de coisas e poder ser refutada"}]'::jsonb, 'F', 'Popper propôs a falseabilidade como critério de demarcação: uma teoria é científica se faz previsões arriscadas, que podem ser refutadas. Uma teoria que se acomoda a qualquer resultado (e ''explica tudo'') é, para ele, justamente a marca da pseudociência.', 'Popper — Conjecturas e Refutações (1963)', 'para karl popper o criterio que distingue uma teoria cientifica de uma pseudociencia e##a capacidade de explicar tudo|a falseabilidade a teoria deve proibir certos estados de coisas e poder ser refutada|a origem experimental dos dados|a quantidade de evidencias favoraveis acumuladas|o consenso da comunidade cientifica|o uso de matematica avancada', 'aprovada', TRUE, 1),
  ('br-economia-01', 'humanas', 'economia', 'dificil', 3, 'Na economia, o que mede o Produto Interno Bruto (PIB) de um país?', '[{"letra":"A","texto":"A soma das exportações menos as dívidas externas"},{"letra":"B","texto":"A quantidade total de dinheiro em circulação"},{"letra":"C","texto":"O total de impostos arrecadados"},{"letra":"D","texto":"A renda média da população"},{"letra":"E","texto":"A soma de todos os ativos financeiros do governo"},{"letra":"F","texto":"O valor de mercado dos bens e serviços finais produzidos dentro do território em um período"}]'::jsonb, 'F', 'O PIB é o valor de mercado dos bens e serviços FINAIS produzidos no território em determinado período — evita contar insumos intermediários duas vezes. Não confundir com Renda Nacional Bruta (que considera a renda de residentes, mesmo no exterior).', 'Sistema de Contas Nacionais — manual do FMI/ONU', 'na economia o que mede o produto interno bruto pib de um pais##a quantidade total de dinheiro em circulacao|a renda media da populacao|a soma das exportacoes menos as dividas externas|a soma de todos os ativos financeiros do governo|o total de impostos arrecadados|o valor de mercado dos bens e servicos finais produzidos dentro do territorio em um periodo', 'aprovada', TRUE, 1),
  ('br-direito-01', 'humanas', 'direito', 'avancada', 4, 'Na Constituição brasileira de 1988, o princípio da ''legalidade'' (art. 5º, II) estabelece que ninguém será obrigado a fazer ou deixar de fazer algo senão:', '[{"letra":"A","texto":"Por decreto do Poder Executivo"},{"letra":"B","texto":"Por determinação de autoridade policial"},{"letra":"C","texto":"Por costume consolidado"},{"letra":"D","texto":"Por decisão judicial fundamentada"},{"letra":"E","texto":"Em virtude de lei"},{"letra":"F","texto":"Por ato administrativo"}]'::jsonb, 'E', 'O art. 5º, II, da CF/88 diz: ''ninguém será obrigado a fazer ou deixar de fazer alguma coisa senão em virtude de lei''. Para o particular, vale a autonomia (pode fazer o que a lei não proíbe); para a Administração, o oposto (só faz o que a lei autoriza).', 'Constituição da República Federativa do Brasil de 1988, art. 5º, II', 'na constituicao brasileira de 1988 o principio da legalidade art 5 ii estabelece que ninguem sera obrigado a fazer ou deixar de fazer algo senao##em virtude de lei|por ato administrativo|por costume consolidado|por decisao judicial fundamentada|por decreto do poder executivo|por determinacao de autoridade policial', 'aprovada', TRUE, 1),
  ('br-sociologia-01', 'humanas', 'sociologia', 'dificil', 3, 'Quem descreveu a burocracia como forma de dominação racional-legal, com regras impessoais e hierarquia definida?', '[{"letra":"A","texto":"Pierre Bourdieu"},{"letra":"B","texto":"Max Weber"},{"letra":"C","texto":"Émile Durkheim"},{"letra":"D","texto":"Karl Marx"},{"letra":"E","texto":"Auguste Comte"},{"letra":"F","texto":"Talcott Parsons"}]'::jsonb, 'B', 'Max Weber (1864–1920) distinguiu tipos ideais de dominação — tradicional, carismática e racional-legal — e analisou a burocracia como expressão da última. Marx focou em classes e mais-valia; Durkheim, em fatos sociais e solidariedade.', 'Weber — Economia e Sociedade (1922)', 'quem descreveu a burocracia como forma de dominacao racional legal com regras impessoais e hierarquia definida##auguste comte|emile durkheim|karl marx|max weber|pierre bourdieu|talcott parsons', 'aprovada', TRUE, 1),
  ('br-relacoes-internacionais-01', 'humanas', 'relacoes-internacionais', 'intermediaria', 2, 'Em que ano entrou em vigor a Carta das Nações Unidas, marco de fundação da ONU?', '[{"letra":"A","texto":"1919"},{"letra":"B","texto":"1948"},{"letra":"C","texto":"1962"},{"letra":"D","texto":"1950"},{"letra":"E","texto":"1945"},{"letra":"F","texto":"1939"}]'::jsonb, 'E', 'A Carta foi assinada em São Francisco em 26 de junho de 1945 e entrou em vigor em 24 de outubro de 1945 — data em que hoje se celebra o Dia das Nações Unidas. A Declaração Universal dos Direitos Humanos é de 1948.', 'Carta das Nações Unidas, art. 110 (entrada em vigor)', 'em que ano entrou em vigor a carta das nacoes unidas marco de fundacao da onu##1919|1939|1945|1948|1950|1962', 'aprovada', TRUE, 1),
  ('br-psicologia-cognitiva-01', 'psicologia', 'psicologia-cognitiva', 'avancada', 4, 'O experimento de Stanley Milgram (1963), em que participantes aplicavam choques aparentes por ordem de uma autoridade, investigou principalmente:', '[{"letra":"A","texto":"O condicionamento clássico"},{"letra":"B","texto":"A aprendizagem por reforço"},{"letra":"C","texto":"A percepção visual de profundidade"},{"letra":"D","texto":"A privação de sono"},{"letra":"E","texto":"A memória de curto prazo"},{"letra":"F","texto":"A obediência à autoridade"}]'::jsonb, 'F', 'Milgram investigou a obediência à autoridade após o julgamento de Eichmann. Uma proporção inesperadamente alta de participantes seguiu até o nível máximo indicado, mostrando o peso do contexto situacional — e não traços de personalidade — sobre o comportamento.', 'Milgram (1963), Journal of Abnormal and Social Psychology, 67(4)', 'o experimento de stanley milgram 1963 em que participantes aplicavam choques aparentes por ordem de uma autoridade investigou principalmente##a aprendizagem por reforco|a memoria de curto prazo|a obediencia a autoridade|a percepcao visual de profundidade|a privacao de sono|o condicionamento classico', 'aprovada', TRUE, 1),
  ('br-psicologia-social-01', 'psicologia', 'psicologia-social', 'dificil', 3, 'A ''dissonância cognitiva'', conceito de Leon Festinger, ocorre quando:', '[{"letra":"A","texto":"Um estímulo é percebido de forma diferente por cada olho"},{"letra":"B","texto":"Uma tarefa é aprendida por repetição"},{"letra":"C","texto":"Uma pessoa tem crenças ou atitudes contraditórias entre si e busca reduzir o desconforto"},{"letra":"D","texto":"Duas pessoas discordam em um debate"},{"letra":"E","texto":"Um grupo toma decisão melhor que o indivíduo"},{"letra":"F","texto":"Uma pessoa esquece informações recentes"}]'::jsonb, 'C', 'Festinger descreveu o desconforto mental ao sustentar cognições contraditórias, que motiva mudança de atitude ou de comportamento para restabelecer a coerência. É o mecanismo por trás da racionalização após decisões difíceis.', 'Festinger — A Theory of Cognitive Dissonance (1957)', 'a dissonancia cognitiva conceito de leon festinger ocorre quando##duas pessoas discordam em um debate|um estimulo e percebido de forma diferente por cada olho|um grupo toma decisao melhor que o individuo|uma pessoa esquece informacoes recentes|uma pessoa tem crencas ou atitudes contraditorias entre si e busca reduzir o desconforto|uma tarefa e aprendida por repeticao', 'aprovada', TRUE, 1),
  ('br-historia-do-brasil-01', 'historia', 'historia-do-brasil', 'facil', 1, 'Em que ano a família real portuguesa chegou ao Brasil, fugindo de Napoleão?', '[{"letra":"A","texto":"1815"},{"letra":"B","texto":"1789"},{"letra":"C","texto":"1808"},{"letra":"D","texto":"1822"},{"letra":"E","texto":"1824"},{"letra":"F","texto":"1801"}]'::jsonb, 'C', 'A corte chegou ao Rio de Janeiro em 1808, escoltada pela Marinha britânica, após a invasão de Portugal pelas tropas napoleônicas. Em 1815 o Brasil foi elevado a Reino Unido a Portugal e Algarves; a Independência veio em 1822.', 'Arquivo Nacional — vinda da Corte ao Brasil (1808)', 'em que ano a familia real portuguesa chegou ao brasil fugindo de napoleao##1789|1801|1808|1815|1822|1824', 'aprovada', TRUE, 1),
  ('br-historia-contemporanea-01', 'historia', 'historia-contemporanea', 'intermediaria', 2, 'Qual evento é considerado o estopim da Primeira Guerra Mundial?', '[{"letra":"A","texto":"A queda da Bastilha"},{"letra":"B","texto":"A Revolução Russa"},{"letra":"C","texto":"A crise dos mísseis de Cuba"},{"letra":"D","texto":"A invasão da Polônia"},{"letra":"E","texto":"O assassinato do arquiduque Francisco Ferdinando em Sarajevo"},{"letra":"F","texto":"O Tratado de Versalhes"}]'::jsonb, 'E', 'Em 28 de junho de 1914, Gavrilo Princip assassinou o arquiduque Francisco Ferdinando e sua esposa em Sarajevo. O episódio acionou o sistema de alianças e ultimatos, levando à guerra em agosto. A invasão da Polônia (1939) abriu a Segunda Guerra; Versalhes a encerrou.', 'Imperial War Museums — causes of the First World War', 'qual evento e considerado o estopim da primeira guerra mundial##a crise dos misseis de cuba|a invasao da polonia|a queda da bastilha|a revolucao russa|o assassinato do arquiduque francisco ferdinando em sarajevo|o tratado de versalhes', 'aprovada', TRUE, 1),
  ('br-historia-medieval-01', 'historia', 'historia-medieval', 'dificil', 3, 'A Peste Negra que devastou a Europa no século XIV é causada por qual agente e transmitida principalmente por qual vetor?', '[{"letra":"A","texto":"Um protozoário, transmitido pela água"},{"letra":"B","texto":"Uma bactéria, transmitida por contato sexual"},{"letra":"C","texto":"A bactéria Yersinia pestis, transmitida por pulgas de roedores"},{"letra":"D","texto":"Um vírus, transmitido por mosquitos"},{"letra":"E","texto":"Um fungo, transmitido pelo ar em ambientes úmidos"},{"letra":"F","texto":"Um príon, transmitido por carne contaminada"}]'::jsonb, 'C', 'A peste é causada pela bactéria Yersinia pestis, transmitida sobretudo por pulgas que parasitam roedores. A pandemia do século XIV (1347–1351) matou uma parcela enorme da população europeia e teve efeitos profundos na economia e nas relações de trabalho.', 'OMS — Plague (who.int); Benedictow, The Black Death 1346–1353', 'a peste negra que devastou a europa no seculo xiv e causada por qual agente e transmitida principalmente por qual vetor##a bacteria yersinia pestis transmitida por pulgas de roedores|um fungo transmitido pelo ar em ambientes umidos|um prion transmitido por carne contaminada|um protozoario transmitido pela agua|um virus transmitido por mosquitos|uma bacteria transmitida por contato sexual', 'aprovada', TRUE, 1),
  ('br-historia-antiga-01', 'historia', 'historia-antiga', 'intermediaria', 2, 'Qual civilização mesopotâmica é creditada pelo desenvolvimento da escrita cuneiforme?', '[{"letra":"A","texto":"Persas"},{"letra":"B","texto":"Sumerianos"},{"letra":"C","texto":"Egípcios"},{"letra":"D","texto":"Hititas"},{"letra":"E","texto":"Fenícios"},{"letra":"F","texto":"Assírios"}]'::jsonb, 'B', 'Os sumérios, no sul da Mesopotâmia, desenvolveram a escrita cuneiforme por volta de 3200 a.C., inicialmente para registro contábil. Os egípcios usavam hieróglifos; os fenícios são lembrados pelo alfabeto consonântico.', 'British Museum — Mesopotamia, writing', 'qual civilizacao mesopotamica e creditada pelo desenvolvimento da escrita cuneiforme##assirios|egipcios|fenicios|hititas|persas|sumerianos', 'aprovada', TRUE, 1),
  ('br-paises-e-capitais-01', 'geografia', 'paises-e-capitais', 'facil', 1, 'Qual é a capital da Austrália?', '[{"letra":"A","texto":"Canberra"},{"letra":"B","texto":"Brisbane"},{"letra":"C","texto":"Perth"},{"letra":"D","texto":"Melbourne"},{"letra":"E","texto":"Adelaide"},{"letra":"F","texto":"Sydney"}]'::jsonb, 'A', 'Canberra é a capital, planejada justamente para encerrar a disputa entre Sydney e Melbourne. Sydney é a maior cidade do país, mas não a capital — um erro clássico.', 'Governo da Austrália — Geoscience Australia', 'qual e a capital da australia##adelaide|brisbane|canberra|melbourne|perth|sydney', 'aprovada', TRUE, 1),
  ('br-geografia-fisica-01', 'geografia', 'geografia-fisica', 'intermediaria', 2, 'Qual é o rio mais extenso do mundo em volume de água (vazão)?', '[{"letra":"A","texto":"Mississippi"},{"letra":"B","texto":"Nilo"},{"letra":"C","texto":"Congo"},{"letra":"D","texto":"Yangtzé"},{"letra":"E","texto":"Amazonas"},{"letra":"F","texto":"Ganges"}]'::jsonb, 'E', 'O Amazonas tem a maior vazão do planeta — cerca de 209.000 m³/s, mais de 15% de toda a água doce que chega aos oceanos. A disputa sobre qual é o MAIS LONGO (Nilo ou Amazonas) segue em aberto por causa dos critérios de medição da nascente.', 'ANA / USGS — Amazon River discharge', 'qual e o rio mais extenso do mundo em volume de agua vazao##amazonas|congo|ganges|mississippi|nilo|yangtze', 'aprovada', TRUE, 1),
  ('br-climatologia-01', 'geografia', 'climatologia', 'dificil', 3, 'O efeito estufa é um fenômeno natural. O que o diferencia do aquecimento global observado desde a era industrial?', '[{"letra":"A","texto":"O efeito estufa ocorre apenas nas cidades"},{"letra":"B","texto":"O efeito estufa só afeta a camada de ozônio"},{"letra":"C","texto":"O aquecimento global é causado por variações da órbita terrestre"},{"letra":"D","texto":"O aquecimento global é um fenômeno exclusivamente solar"},{"letra":"E","texto":"A intensificação do efeito estufa pela emissão de gases como CO₂ e CH₄ pela atividade humana"},{"letra":"F","texto":"O efeito estufa natural não existe"}]'::jsonb, 'E', 'O efeito estufa natural mantém a Terra habitável (sem ele, a média seria cerca de −18 °C em vez de ~15 °C). O problema é sua INTENSIFICAÇÃO: a queima de combustíveis fósseis e o desmatamento elevam a concentração de gases, aumentando a retenção de calor. A camada de ozônio é outro fenômeno (filtro de UV).', 'IPCC — AR6 Synthesis Report, WG I', 'o efeito estufa e um fenomeno natural o que o diferencia do aquecimento global observado desde a era industrial##a intensificacao do efeito estufa pela emissao de gases como co e ch pela atividade humana|o aquecimento global e causado por variacoes da orbita terrestre|o aquecimento global e um fenomeno exclusivamente solar|o efeito estufa natural nao existe|o efeito estufa ocorre apenas nas cidades|o efeito estufa so afeta a camada de ozonio', 'aprovada', TRUE, 1),
  ('br-cartografia-01', 'geografia', 'cartografia', 'avancada', 4, 'Por que a projeção de Mercator distorce as áreas próximas aos polos?', '[{"letra":"A","texto":"Porque usa cores inadequadas"},{"letra":"B","texto":"Porque foi feita apenas para mapas políticos"},{"letra":"C","texto":"Porque preserva ângulos (conformidade) ao custo de exagerar as áreas em altas latitudes"},{"letra":"D","texto":"Porque ignora a linha do Equador"},{"letra":"E","texto":"Porque não representa oceanos"},{"letra":"F","texto":"Porque usa coordenadas polares"}]'::jsonb, 'C', 'Mercator é uma projeção CONFORME: preserva ângulos e, por isso, é ótima para navegação (rumos constantes são linhas retas). O preço é a distorção de área, que cresce com a latitude — na Groenlândia o exagero é enorme em relação à América do Sul.', 'Snyder — Map Projections: A Working Manual (USGS)', 'por que a projecao de mercator distorce as areas proximas aos polos##porque foi feita apenas para mapas politicos|porque ignora a linha do equador|porque nao representa oceanos|porque preserva angulos conformidade ao custo de exagerar as areas em altas latitudes|porque usa coordenadas polares|porque usa cores inadequadas', 'aprovada', TRUE, 1),
  ('br-literatura-01', 'artes', 'literatura', 'intermediaria', 2, 'Quem escreveu «Dom Casmurro», narrado por Bentinho e centrado na dúvida sobre a fidelidade de Capitu?', '[{"letra":"A","texto":"Raul Pompeia"},{"letra":"B","texto":"Lima Barreto"},{"letra":"C","texto":"Aluísio Azevedo"},{"letra":"D","texto":"Graciliano Ramos"},{"letra":"E","texto":"José de Alencar"},{"letra":"F","texto":"Machado de Assis"}]'::jsonb, 'F', '«Dom Casmurro» (1899) é de Machado de Assis. O romance é narrado em primeira pessoa por Bentinho, e a ambiguidade sobre Capitu é construída pelo próprio narrador — a famosa ''cega dúvida'' do leitor.', 'Machado de Assis — Dom Casmurro (1899), primeira edição', 'quem escreveu dom casmurro narrado por bentinho e centrado na duvida sobre a fidelidade de capitu##aluisio azevedo|graciliano ramos|jose de alencar|lima barreto|machado de assis|raul pompeia', 'aprovada', TRUE, 1),
  ('br-musica-01', 'artes', 'musica', 'dificil', 3, 'Na música ocidental, quantos semitons há em uma oitava?', '[{"letra":"A","texto":"12"},{"letra":"B","texto":"8"},{"letra":"C","texto":"24"},{"letra":"D","texto":"13"},{"letra":"E","texto":"6"},{"letra":"F","texto":"7"}]'::jsonb, 'A', 'Uma oitava é dividida em 12 semitons na afinação temperada. São 7 notas naturais (dó, ré, mi, fá, sol, lá, si) mais 5 acidentes, totalizando 12 passos. Essa divisão é o que permite transpor entre tonalidades de forma consistente.', 'Teoria musical padrão — temperamento igual', 'na musica ocidental quantos semitons ha em uma oitava##12|13|24|6|7|8', 'aprovada', TRUE, 1),
  ('br-cinema-01', 'artes', 'cinema', 'intermediaria', 2, 'O filme «Cidadão Kane» (1941), frequentemente citado entre os mais influentes da história, foi dirigido por:', '[{"letra":"A","texto":"Alfred Hitchcock"},{"letra":"B","texto":"John Ford"},{"letra":"C","texto":"Orson Welles"},{"letra":"D","texto":"Stanley Kubrick"},{"letra":"E","texto":"Billy Wilder"},{"letra":"F","texto":"Fritz Lang"}]'::jsonb, 'C', 'Orson Welles dirigiu, coescreveu e protagonizou «Cidadão Kane» aos 25 anos, revolucionando o uso de profundidade de campo, iluminação e narrativa não linear. A estrutura investigativa da vida de Kane é inspirada em William Randolph Hearst.', 'American Film Institute — AFI''s 100 Years...100 Movies', 'o filme cidadao kane 1941 frequentemente citado entre os mais influentes da historia foi dirigido por##alfred hitchcock|billy wilder|fritz lang|john ford|orson welles|stanley kubrick', 'aprovada', TRUE, 1),
  ('br-mitologia-01', 'artes', 'mitologia', 'facil', 1, 'Na mitologia grega, quem é o deus associado ao mar, irmão de Zeus e Hades?', '[{"letra":"A","texto":"Ares"},{"letra":"B","texto":"Apolo"},{"letra":"C","texto":"Hermes"},{"letra":"D","texto":"Hefesto"},{"letra":"E","texto":"Posêidon"},{"letra":"F","texto":"Dioniso"}]'::jsonb, 'E', 'Posêidon governa os mares e recebeu esse domínio no sorteio entre os três irmãos: Zeus ficou com o céu, Hades com o mundo dos mortos e Posêidon com o mar. Seu equivalente romano é Netuno.', 'Hesíodo — Teogonia', 'na mitologia grega quem e o deus associado ao mar irmao de zeus e hades##apolo|ares|dioniso|hefesto|hermes|poseidon', 'aprovada', TRUE, 1),
  ('br-medicina-01', 'outras', 'medicina-e-saude', 'dificil', 3, 'Qual vitamina é sintetizada na pele humana a partir da exposição à radiação ultravioleta B?', '[{"letra":"A","texto":"Vitamina D"},{"letra":"B","texto":"Vitamina A"},{"letra":"C","texto":"Vitamina K"},{"letra":"D","texto":"Vitamina C"},{"letra":"E","texto":"Vitamina E"},{"letra":"F","texto":"Vitamina B12"}]'::jsonb, 'A', 'A vitamina D é sintetizada na pele a partir do 7-desidrocolesterol sob radiação UVB. A B12 é obtida de fontes animais, a C de frutas cítricas e a K tem papel na coagulação. Excesso de sol, porém, traz outros riscos.', 'OMS / NIH Office of Dietary Supplements — Vitamin D', 'qual vitamina e sintetizada na pele humana a partir da exposicao a radiacao ultravioleta b##vitamina a|vitamina b12|vitamina c|vitamina d|vitamina e|vitamina k', 'aprovada', TRUE, 1),
  ('br-engenharia-01', 'outras', 'engenharia', 'avancada', 4, 'Na engenharia estrutural, por que arcos e cúpulas são eficientes em vãos grandes?', '[{"letra":"A","texto":"Porque dispensam fundações"},{"letra":"B","texto":"Porque convertem compressão em tração pura"},{"letra":"C","texto":"Porque anulam a gravidade"},{"letra":"D","texto":"Porque trabalham predominantemente em compressão, aproveitando bem materiais como pedra e concreto"},{"letra":"E","texto":"Porque usam menos material colorido"},{"letra":"F","texto":"Porque só funcionam em madeira"}]'::jsonb, 'D', 'Arcos e cúpulas direcionam as cargas para os apoios principalmente como COMPRESSÃO. Pedra e concreto resistem muito bem à compressão e mal à tração — daí o sucesso histórico dessas formas (Panteão, catedrais). O arco cria empuxo horizontal, que exige contrafortes ou tirantes.', 'Salvadori — Why Buildings Stand Up', 'na engenharia estrutural por que arcos e cupulas sao eficientes em vaos grandes##porque anulam a gravidade|porque convertem compressao em tracao pura|porque dispensam fundacoes|porque so funcionam em madeira|porque trabalham predominantemente em compressao aproveitando bem materiais como pedra e concreto|porque usam menos material colorido', 'aprovada', TRUE, 1),
  ('br-linguistica-01', 'outras', 'linguistica', 'especialista', 5, 'A hipótese de Sapir-Whorf, em sua versão FORTE, afirma que:', '[{"letra":"A","texto":"O pensamento determina a língua, e não o contrário"},{"letra":"B","texto":"A língua determina o pensamento, limitando o que é possível pensar"},{"letra":"C","texto":"Crianças aprendem gramática por imitação"},{"letra":"D","texto":"Línguas isoladas não possuem gramática"},{"letra":"E","texto":"A escrita precedeu a fala na história humana"},{"letra":"F","texto":"Todas as línguas têm a mesma estrutura profunda"}]'::jsonb, 'B', 'A versão forte (determinismo linguístico) sustenta que a língua molda e limita o pensamento; a versão fraca (relativismo) apenas diz que a língua INFLUENCIA a cognição. A versão forte é hoje amplamente contestada — o caso dos termos de cor e de espaço mostra influência, não aprisionamento.', 'Whorf — Language, Thought, and Reality (1956)', 'a hipotese de sapir whorf em sua versao forte afirma que##a escrita precedeu a fala na historia humana|a lingua determina o pensamento limitando o que e possivel pensar|criancas aprendem gramatica por imitacao|linguas isoladas nao possuem gramatica|o pensamento determina a lingua e nao o contrario|todas as linguas tem a mesma estrutura profunda', 'aprovada', TRUE, 1),
  ('br-conhecimentos-gerais-01', 'outras', 'conhecimentos-gerais', 'facil', 1, 'Quantos jogadores de cada equipe ficam em campo em uma partida oficial de futebol?', '[{"letra":"A","texto":"11"},{"letra":"B","texto":"7"},{"letra":"C","texto":"10"},{"letra":"D","texto":"12"},{"letra":"E","texto":"9"},{"letra":"F","texto":"13"}]'::jsonb, 'A', 'Cada equipe entra com 11 jogadores, incluindo o goleiro. Uma equipe com menos de 7 jogadores em campo tem a partida encerrada. As Regras do Jogo são mantidas pelo IFAB, com aval da FIFA.', 'IFAB — Laws of the Game, Law 3', 'quantos jogadores de cada equipe ficam em campo em uma partida oficial de futebol##10|11|12|13|7|9', 'aprovada', TRUE, 1),
  ('br-esportes-01', 'outras', 'esportes', 'intermediaria', 2, 'Em quantos anos os Jogos Olímpicos de Verão e de Inverno passaram a ser realizados, a partir de 1994?', '[{"letra":"A","texto":"No mesmo ano, sempre juntos"},{"letra":"B","texto":"Apenas quando há sede disponível"},{"letra":"C","texto":"A cada 3 anos"},{"letra":"D","texto":"A cada 5 anos"},{"letra":"E","texto":"Alternadamente, a cada 2 anos"},{"letra":"F","texto":"A cada 4 anos, no mesmo ano"}]'::jsonb, 'E', 'Até 1992, Verão e Inverno ocorriam no mesmo ano. A partir de Lillehammer-1994, o Comitê Olímpico Internacional passou a alterná-los a cada 2 anos, de modo que sempre há uma Olimpíada a cada dois anos, mas cada ciclo (Verão ou Inverno) é de 4 anos.', 'Comitê Olímpico Internacional — Olympic Games history', 'em quantos anos os jogos olimpicos de verao e de inverno passaram a ser realizados a partir de 1994##a cada 3 anos|a cada 4 anos no mesmo ano|a cada 5 anos|alternadamente a cada 2 anos|apenas quando ha sede disponivel|no mesmo ano sempre juntos', 'aprovada', TRUE, 1),
  ('br-agricultura-01', 'outras', 'agricultura', 'dificil', 3, 'Por que a rotação de culturas ajuda a controlar pragas e doenças na lavoura?', '[{"letra":"A","texto":"Porque torna o solo mais compactado"},{"letra":"B","texto":"Porque aumenta o preço do produto"},{"letra":"C","texto":"Porque quebra o ciclo de vida de pragas e patógenos específicos da cultura anterior"},{"letra":"D","texto":"Porque impede a fotossíntese das plantas daninhas"},{"letra":"E","texto":"Porque dispensa o uso de sementes"},{"letra":"F","texto":"Porque elimina toda a necessidade de água"}]'::jsonb, 'C', 'Pragas e patógenos costumam ser específicos de uma cultura e sobrevivem no solo ou em restos culturais. Alternar espécies com ciclos e exigências diferentes interrompe esse ciclo, reduz a pressão de doença e ainda melhora a fertilidade. É manejo integrado, não uma solução isolada.', 'Embrapa — Rotação de culturas e manejo integrado de pragas', 'por que a rotacao de culturas ajuda a controlar pragas e doencas na lavoura##porque aumenta o preco do produto|porque dispensa o uso de sementes|porque elimina toda a necessidade de agua|porque impede a fotossintese das plantas daninhas|porque quebra o ciclo de vida de pragas e patogenos especificos da cultura anterior|porque torna o solo mais compactado', 'aprovada', TRUE, 1)
ON CONFLICT (id) DO UPDATE SET
  area_slug = EXCLUDED.area_slug,
  subcategoria_slug = EXCLUDED.subcategoria_slug,
  dificuldade = EXCLUDED.dificuldade,
  ordem = EXCLUDED.ordem,
  enunciado = EXCLUDED.enunciado,
  alternativas = EXCLUDED.alternativas,
  letra_correta = EXCLUDED.letra_correta,
  explicacao = EXCLUDED.explicacao,
  referencia = EXCLUDED.referencia,
  assinatura = EXCLUDED.assinatura,
  status = EXCLUDED.status,
  ativa = EXCLUDED.ativa,
  atualizado_em = now();

-- ---------- 21. Realtime (opcional, seguro se a publicação não existir) ----------
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.brio_partidas;
EXCEPTION WHEN OTHERS THEN
  NULL; -- publicação inexistente (ambiente local) ou tabela já incluída
END $$;
