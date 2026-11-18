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
-- Normalizador da assinatura: MESMA regra do seed (selecao.ts
-- assinaturaPergunta) e do importador. Sem acento, minúsculo, pontuação vira
-- espaço, espaços colapsados.
--
-- NÃO simplificar isto para regexp_replace(enunciado, '[^a-zA-Z0-9]+', ' '):
-- essa versão não tira acento ("proprio" != "proprio") e ignora as
-- alternativas, então NUNCA casa com a assinatura gravada pelo seed - e toda
-- pergunta já existente entraria de novo como duplicata.
CREATE OR REPLACE FUNCTION public.brio_normalizar_texto(p_texto TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT btrim(
    regexp_replace(
      translate(
        lower(COALESCE(p_texto, '')),
        'áàâãäåéèêëíìîïóòôõöúùûüçñ',
        'aaaaaaeeeeiiiiooooouuuucn'
      ),
      '[^a-z0-9]+', ' ', 'g'
    )
  )
$$;

REVOKE ALL ON FUNCTION public.brio_normalizar_texto(TEXT) FROM PUBLIC;

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

    -- A assinatura pode vir pronta; se não vier, é derivada do enunciado E das
    -- alternativas (mesma composição do seed: "<enunciado>##<alts ordenadas>").
    v_assimetria := COALESCE(NULLIF(btrim(v_item->>'assinatura'), ''),
      public.brio_normalizar_texto(v_item->>'enunciado') || '##' ||
      COALESCE((
        SELECT string_agg(public.brio_normalizar_texto(alt->>'texto'), '|' ORDER BY public.brio_normalizar_texto(alt->>'texto'))
        FROM jsonb_array_elements(v_item->'alternativas') AS alt
      ), ''));

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

-- ---------- 20. Seed: perguntas curadas (137) ----------
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
  ('br-agricultura-01', 'outras', 'agricultura', 'dificil', 3, 'Por que a rotação de culturas ajuda a controlar pragas e doenças na lavoura?', '[{"letra":"A","texto":"Porque torna o solo mais compactado"},{"letra":"B","texto":"Porque aumenta o preço do produto"},{"letra":"C","texto":"Porque quebra o ciclo de vida de pragas e patógenos específicos da cultura anterior"},{"letra":"D","texto":"Porque impede a fotossíntese das plantas daninhas"},{"letra":"E","texto":"Porque dispensa o uso de sementes"},{"letra":"F","texto":"Porque elimina toda a necessidade de água"}]'::jsonb, 'C', 'Pragas e patógenos costumam ser específicos de uma cultura e sobrevivem no solo ou em restos culturais. Alternar espécies com ciclos e exigências diferentes interrompe esse ciclo, reduz a pressão de doença e ainda melhora a fertilidade. É manejo integrado, não uma solução isolada.', 'Embrapa — Rotação de culturas e manejo integrado de pragas', 'por que a rotacao de culturas ajuda a controlar pragas e doencas na lavoura##porque aumenta o preco do produto|porque dispensa o uso de sementes|porque elimina toda a necessidade de agua|porque impede a fotossintese das plantas daninhas|porque quebra o ciclo de vida de pragas e patogenos especificos da cultura anterior|porque torna o solo mais compactado', 'aprovada', TRUE, 1),
  ('br-geologia-01', 'ciencias', 'geologia', 'facil', 1, 'A escala de dureza de Mohs ordena minerais de 1 a 10. Qual mineral ocupa o topo da escala, sendo o mais duro entre os de referência?', '[{"letra":"A","texto":"Gipsita"},{"letra":"B","texto":"Coríndon"},{"letra":"C","texto":"Talco"},{"letra":"D","texto":"Diamante"},{"letra":"E","texto":"Topázio"},{"letra":"F","texto":"Quartzo"}]'::jsonb, 'D', 'A escala vai do talco (1) ao diamante (10). Quartzo é 7, topázio 8 e coríndon 9. O diamante é o mais duro dos minerais de referência — por isso a ideia de que nada o risca, exceto outro diamante.', 'USGS — Mineral hardness and the Mohs scale', 'a escala de dureza de mohs ordena minerais de 1 a 10 qual mineral ocupa o topo da escala sendo o mais duro entre os de referencia##corindon|diamante|gipsita|quartzo|talco|topazio', 'aprovada', TRUE, 1),
  ('br-geologia-02', 'ciencias', 'geologia', 'intermediaria', 2, 'Quando duas placas tectônicas se afastam uma da outra e o magma ascende formando nova crosta, esse limite é classificado como:', '[{"letra":"A","texto":"Transformante"},{"letra":"B","texto":"Convergente"},{"letra":"C","texto":"Zona de subducção"},{"letra":"D","texto":"Limite de obducção"},{"letra":"E","texto":"Divergente"},{"letra":"F","texto":"Falha inversa"}]'::jsonb, 'E', 'Em limites divergentes as placas se separam e o magma ascende, gerando nova crosta — é o caso da Dorsal Meso-Atlântica. Limites convergentes aproximam placas (com subducção ou colisão) e os transformantes deslizam lateralmente, sem criar nem destruir crosta.', 'USGS — Understanding plate motions', 'quando duas placas tectonicas se afastam uma da outra e o magma ascende formando nova crosta esse limite e classificado como##convergente|divergente|falha inversa|limite de obduccao|transformante|zona de subduccao', 'aprovada', TRUE, 1),
  ('br-biotecnologia-01', 'ciencias', 'biotecnologia', 'intermediaria', 2, 'A técnica de PCR (reação em cadeia da polimerase) serve principalmente para:', '[{"letra":"A","texto":"Amplificar exponencialmente um trecho específico de DNA"},{"letra":"B","texto":"Sintetizar lipídios de membrana"},{"letra":"C","texto":"Separar proteínas por tamanho"},{"letra":"D","texto":"Editar genes de embriões humanos"},{"letra":"E","texto":"Corar cromossomos ao microscópio"},{"letra":"F","texto":"Medir a taxa metabólica das células"}]'::jsonb, 'A', 'A PCR usa ciclos repetidos de desnaturação, anelamento de primers e extensão por uma polimerase termoestável, copiando milhões de vezes um trecho delimitado pelos primers. Separar proteínas por tamanho é eletroforese; edição genética é outra família de técnicas.', 'NIH — Polymerase chain reaction (PCR) fact sheet', 'a tecnica de pcr reacao em cadeia da polimerase serve principalmente para##amplificar exponencialmente um trecho especifico de dna|corar cromossomos ao microscopio|editar genes de embrioes humanos|medir a taxa metabolica das celulas|separar proteinas por tamanho|sintetizar lipidios de membrana', 'aprovada', TRUE, 1),
  ('br-biotecnologia-02', 'ciencias', 'biotecnologia', 'avancada', 4, 'No sistema CRISPR-Cas9, qual é o papel da proteína Cas9?', '[{"letra":"A","texto":"Traduzir a sequência alvo em proteína"},{"letra":"B","texto":"Cortar as duas fitas de DNA, guiada pelo RNA"},{"letra":"C","texto":"Reparar o corte por recombinação homóloga"},{"letra":"D","texto":"Reconhecer a sequência alvo por pareamento de bases"},{"letra":"E","texto":"Sintetizar o RNA guia"},{"letra":"F","texto":"Transportar o DNA até o núcleo"}]'::jsonb, 'B', 'O RNA guia reconhece o alvo por complementaridade e leva a Cas9 até lá; Cas9 é a nuclease que corta as duas fitas. O reparo do corte é feito pela maquinaria da própria célula (junção de extremidades não homólogas ou recombinação homóloga).', 'Doudna & Charpentier, Science 2014 — The new frontier of genome engineering with CRISPR-Cas9 (Nobel de Química 2020)', 'no sistema crispr cas9 qual e o papel da proteina cas9##cortar as duas fitas de dna guiada pelo rna|reconhecer a sequencia alvo por pareamento de bases|reparar o corte por recombinacao homologa|sintetizar o rna guia|traduzir a sequencia alvo em proteina|transportar o dna ate o nucleo', 'aprovada', TRUE, 1),
  ('br-ciencias-ambientais-01', 'ciencias', 'ciencias-ambientais', 'facil', 1, 'Qual gás responde pela maior parte do aumento do efeito estufa de origem antrópica desde a Revolução Industrial?', '[{"letra":"A","texto":"Oxigênio"},{"letra":"B","texto":"Argônio"},{"letra":"C","texto":"Neônio"},{"letra":"D","texto":"Dióxido de carbono"},{"letra":"E","texto":"Nitrogênio"},{"letra":"F","texto":"Hélio"}]'::jsonb, 'D', 'A queima de combustíveis fósseis e o desmatamento liberam CO2, responsável pela maior parcela do forçamento radiativo adicional. Metano e óxido nitroso também contribuem, com participação menor no total. Oxigênio, nitrogênio e gases nobres não são gases de efeito estufa relevantes.', 'IPCC AR6, WG1 — The Physical Science Basis, cap. 6', 'qual gas responde pela maior parte do aumento do efeito estufa de origem antropica desde a revolucao industrial##argonio|dioxido de carbono|helio|neonio|nitrogenio|oxigenio', 'aprovada', TRUE, 1),
  ('br-ciencias-ambientais-02', 'ciencias', 'ciencias-ambientais', 'intermediaria', 2, 'Qual família de substâncias foi apontada como principal responsável pela destruição da camada de ozônio, motivando o Protocolo de Montreal?', '[{"letra":"A","texto":"Clorofluorcarbonos"},{"letra":"B","texto":"Compostos de enxofre"},{"letra":"C","texto":"Hidrocarbonetos aromáticos"},{"letra":"D","texto":"Metais pesados"},{"letra":"E","texto":"Óxidos de nitrogênio vulcânicos"},{"letra":"F","texto":"Gases nobres"}]'::jsonb, 'A', 'Os CFCs liberam átomos de cloro na estratosfera, e cada átomo pode destruir milhares de moléculas de ozônio em ciclos catalíticos. O Protocolo de Montreal (1987) baniu essas substâncias e é considerado um dos tratados ambientais mais bem-sucedidos.', 'UNEP — Montreal Protocol; NASA Ozone Watch', 'qual familia de substancias foi apontada como principal responsavel pela destruicao da camada de ozonio motivando o protocolo de montreal##clorofluorcarbonos|compostos de enxofre|gases nobres|hidrocarbonetos aromaticos|metais pesados|oxidos de nitrogenio vulcanicos', 'aprovada', TRUE, 1),
  ('br-algebra-01', 'exatas', 'algebra', 'intermediaria', 2, 'O Teorema Fundamental da Álgebra garante que um polinômio não constante de grau n, com coeficientes complexos, possui:', '[{"letra":"A","texto":"n + 1 raízes distintas"},{"letra":"B","texto":"Exatamente n raízes complexas, contadas com multiplicidade"},{"letra":"C","texto":"Uma única raiz, sempre real"},{"letra":"D","texto":"Nenhuma raiz quando o grau é par"},{"letra":"E","texto":"No máximo duas raízes reais"},{"letra":"F","texto":"n raízes, todas obrigatoriamente reais"}]'::jsonb, 'B', 'Todo polinômio de grau n ≥ 1 sobre os complexos se decompõe em n fatores lineares, logo tem n raízes complexas contadas com multiplicidade. Elas podem ser reais ou não — o teorema não garante raízes reais.', 'Wolfram MathWorld — Fundamental theorem of algebra', 'o teorema fundamental da algebra garante que um polinomio nao constante de grau n com coeficientes complexos possui##exatamente n raizes complexas contadas com multiplicidade|n 1 raizes distintas|n raizes todas obrigatoriamente reais|nenhuma raiz quando o grau e par|no maximo duas raizes reais|uma unica raiz sempre real', 'aprovada', TRUE, 1),
  ('br-algebra-02', 'exatas', 'algebra', 'facil', 1, 'Qual é o determinante da matriz [[1, 2], [3, 4]]?', '[{"letra":"A","texto":"-2"},{"letra":"B","texto":"4"},{"letra":"C","texto":"10"},{"letra":"D","texto":"0"},{"letra":"E","texto":"-10"},{"letra":"F","texto":"2"}]'::jsonb, 'A', 'Para a matriz [[a, b], [c, d]] o determinante é ad − bc. Assim, 1×4 − 2×3 = 4 − 6 = −2. Determinante nulo indicaria matriz singular, sem inversa — o que não é o caso.', 'Wolfram MathWorld — Determinant', 'qual e o determinante da matriz 1 2 3 4##0|10|10|2|2|4', 'aprovada', TRUE, 1),
  ('br-trigonometria-01', 'exatas', 'trigonometria', 'facil', 1, 'Qual identidade trigonométrica é verdadeira para todo ângulo θ?', '[{"letra":"A","texto":"sen²θ + cos²θ = 0"},{"letra":"B","texto":"tgθ = senθ · cosθ"},{"letra":"C","texto":"sen²θ + cos²θ = 1"},{"letra":"D","texto":"sen²θ = 1 + cos²θ"},{"letra":"E","texto":"senθ + cosθ = 1"},{"letra":"F","texto":"sen²θ − cos²θ = 1"}]'::jsonb, 'C', 'É a identidade pitagórica, consequência direta do teorema de Pitágoras no círculo trigonométrico de raio 1. Dela derivam, por exemplo, 1 + tg²θ = sec²θ e 1 + cotg²θ = cossec²θ.', 'NIST Digital Library of Mathematical Functions, §4.21', 'qual identidade trigonometrica e verdadeira para todo angulo##sen 1 cos|sen cos 0|sen cos 1|sen cos 1|sen cos 1|tg sen cos', 'aprovada', TRUE, 1),
  ('br-trigonometria-02', 'exatas', 'trigonometria', 'facil', 1, 'Quanto vale sen 30°?', '[{"letra":"A","texto":"0"},{"letra":"B","texto":"1"},{"letra":"C","texto":"√3"},{"letra":"D","texto":"1/2"},{"letra":"E","texto":"√3/2"},{"letra":"F","texto":"√2/2"}]'::jsonb, 'D', 'No triângulo retângulo de ângulos 30°-60°-90°, o cateto oposto ao ângulo de 30° mede metade da hipotenusa. Daí sen 30° = 1/2, enquanto sen 45° = √2/2 e sen 60° = √3/2.', 'NIST DLMF §4.14 — trigonometric values at special angles', 'quanto vale sen 30##0|1|1 2|2 2|3|3 2', 'aprovada', TRUE, 1),
  ('br-matematica-financeira-01', 'exatas', 'matematica-financeira', 'intermediaria', 2, 'Um capital de R$ 1.000 é aplicado a juros compostos de 10% ao ano, sem novos aportes. Qual o montante após 2 anos?', '[{"letra":"A","texto":"R$ 1.210,00"},{"letra":"B","texto":"R$ 1.221,00"},{"letra":"C","texto":"R$ 1.300,00"},{"letra":"D","texto":"R$ 1.100,00"},{"letra":"E","texto":"R$ 1.200,00"},{"letra":"F","texto":"R$ 1.020,00"}]'::jsonb, 'A', 'M = C(1 + i)^n = 1000 × 1,10² = 1000 × 1,21 = R$ 1.210,00. A juros simples o montante seria R$ 1.200,00 — a diferença de R$ 10 é o juro incidente sobre o juro do primeiro ano.', 'Banco Central do Brasil — Matemática financeira (juros compostos)', 'um capital de r 1 000 e aplicado a juros compostos de 10 ao ano sem novos aportes qual o montante apos 2 anos##r 1 020 00|r 1 100 00|r 1 200 00|r 1 210 00|r 1 221 00|r 1 300 00', 'aprovada', TRUE, 1),
  ('br-matematica-financeira-02', 'exatas', 'matematica-financeira', 'avancada', 4, 'Um investimento rendeu 10% em um ano, enquanto a inflação do período foi de 4%. Qual o ganho real aproximado?', '[{"letra":"A","texto":"6,0%"},{"letra":"B","texto":"14,0%"},{"letra":"C","texto":"10,0%"},{"letra":"D","texto":"2,5%"},{"letra":"E","texto":"5,8%"},{"letra":"F","texto":"4,0%"}]'::jsonb, 'E', 'A taxa real não é a subtração simples (10% − 4% = 6%). Pela relação de Fisher, (1 + r) = (1 + i)/(1 + π) → 1,10/1,04 ≈ 1,0577, ou seja, cerca de 5,8% de ganho real. Subtrair é apenas uma aproximação, aceitável para taxas muito pequenas.', 'Banco Central do Brasil — Relatório de Estabilidade Financeira (taxa real e equação de Fisher)', 'um investimento rendeu 10 em um ano enquanto a inflacao do periodo foi de 4 qual o ganho real aproximado##10 0|14 0|2 5|4 0|5 8|6 0', 'aprovada', TRUE, 1),
  ('br-ciencia-da-computacao-01', 'tecnologia', 'ciencia-da-computacao', 'intermediaria', 2, 'Em um vetor ordenado de n elementos, qual é a complexidade de tempo da busca binária no pior caso?', '[{"letra":"A","texto":"O(n log n)"},{"letra":"B","texto":"O(n²)"},{"letra":"C","texto":"O(log n)"},{"letra":"D","texto":"O(2ⁿ)"},{"letra":"E","texto":"O(1)"},{"letra":"F","texto":"O(n)"}]'::jsonb, 'C', 'A cada comparação o intervalo de busca é reduzido à metade, então o número de passos cresce com o logaritmo de n. Para n = 1.000.000 são cerca de 20 comparações, contra até 1.000.000 na busca linear.', 'Cormen et al., Introduction to Algorithms, cap. 2 (binary search)', 'em um vetor ordenado de n elementos qual e a complexidade de tempo da busca binaria no pior caso##o 1|o 2|o log n|o n|o n|o n log n', 'aprovada', TRUE, 1),
  ('br-ciencia-da-computacao-02', 'tecnologia', 'ciencia-da-computacao', 'avancada', 4, 'O que a Máquina de Turing representa na teoria da computação?', '[{"letra":"A","texto":"Uma linguagem de programação de alto nível"},{"letra":"B","texto":"Um banco de dados relacional"},{"letra":"C","texto":"Um computador quântico de laboratório"},{"letra":"D","texto":"Um modelo abstrato de computação capaz de simular qualquer algoritmo efetivo"},{"letra":"E","texto":"Um tipo de memória não volátil"},{"letra":"F","texto":"Um protocolo de rede"}]'::jsonb, 'D', 'É o modelo formal proposto por Alan Turing em 1936, que define o que é computável; a tese de Church-Turing afirma que tudo efetivamente computável pode ser calculado por ela. Foi nesse modelo que se demonstrou a indecidibilidade do problema da parada.', 'Turing, On Computable Numbers (1936); Stanford Encyclopedia of Philosophy — Turing machines', 'o que a maquina de turing representa na teoria da computacao##um banco de dados relacional|um computador quantico de laboratorio|um modelo abstrato de computacao capaz de simular qualquer algoritmo efetivo|um protocolo de rede|um tipo de memoria nao volatil|uma linguagem de programacao de alto nivel', 'aprovada', TRUE, 1),
  ('br-engenharia-de-software-01', 'tecnologia', 'engenharia-de-software', 'intermediaria', 2, 'O ''S'' dos princípios SOLID refere-se a qual princípio?', '[{"letra":"A","texto":"Princípio da Inversão de Dependência"},{"letra":"B","texto":"Princípio da Responsabilidade Única"},{"letra":"C","texto":"Princípio da Menor Surpresa"},{"letra":"D","texto":"Princípio da Segregação de Interfaces"},{"letra":"E","texto":"Princípio da Substituição de Liskov"},{"letra":"F","texto":"Princípio do Aberto-Fechado"}]'::jsonb, 'B', 'S é o Single Responsibility Principle: um módulo deve ter um único motivo para mudar. O é aberto-fechado, L é Liskov, I é segregação de interfaces e D é inversão de dependência.', 'Robert C. Martin — Design Principles and Design Patterns (2000)', 'o s dos principios solid refere se a qual principio##principio da inversao de dependencia|principio da menor surpresa|principio da responsabilidade unica|principio da segregacao de interfaces|principio da substituicao de liskov|principio do aberto fechado', 'aprovada', TRUE, 1),
  ('br-engenharia-de-software-02', 'tecnologia', 'engenharia-de-software', 'facil', 1, 'Em engenharia de software, o que é refatoração?', '[{"letra":"A","texto":"Reescrever o sistema em outra linguagem"},{"letra":"B","texto":"Adicionar novas funcionalidades ao produto"},{"letra":"C","texto":"Migrar o banco de dados"},{"letra":"D","texto":"Aumentar a cobertura de testes sem tocar no código"},{"letra":"E","texto":"Corrigir bugs de produção com urgência"},{"letra":"F","texto":"Alterar a estrutura interna do código sem mudar seu comportamento observável"}]'::jsonb, 'F', 'Refatorar é melhorar o desenho interno — nomes, duplicação, acoplamento — preservando o comportamento externo, com os testes como rede de segurança. Reescrever em outra linguagem é reescrita, e adicionar funcionalidade não é refatoração.', 'Martin Fowler, Refactoring (2ª ed.), cap. 1', 'em engenharia de software o que e refatoracao##adicionar novas funcionalidades ao produto|alterar a estrutura interna do codigo sem mudar seu comportamento observavel|aumentar a cobertura de testes sem tocar no codigo|corrigir bugs de producao com urgencia|migrar o banco de dados|reescrever o sistema em outra linguagem', 'aprovada', TRUE, 1),
  ('br-eletronica-01', 'tecnologia', 'eletronica', 'facil', 1, 'Um resistor de 10 Ω é percorrido por uma corrente de 2 A. Qual é a tensão sobre ele, pela Lei de Ohm?', '[{"letra":"A","texto":"40 V"},{"letra":"B","texto":"8 V"},{"letra":"C","texto":"0,2 V"},{"letra":"D","texto":"5 V"},{"letra":"E","texto":"12 V"},{"letra":"F","texto":"20 V"}]'::jsonb, 'F', 'V = R × I = 10 × 2 = 20 V. A Lei de Ohm relaciona tensão, corrente e resistência; a potência dissipada nesse caso seria P = V × I = 40 W.', 'Halliday & Resnick, Fundamentos de Física, vol. 3 (corrente e resistência)', 'um resistor de 10 e percorrido por uma corrente de 2 a qual e a tensao sobre ele pela lei de ohm##0 2 v|12 v|20 v|40 v|5 v|8 v', 'aprovada', TRUE, 1),
  ('br-eletronica-02', 'tecnologia', 'eletronica', 'intermediaria', 2, 'Qual é a função principal de um transistor em um circuito eletrônico?', '[{"letra":"A","texto":"Armazenar carga de forma permanente"},{"letra":"B","texto":"Isolar galvanicamente dois circuitos"},{"letra":"C","texto":"Amplificar sinais e funcionar como chave"},{"letra":"D","texto":"Converter corrente alternada em contínua"},{"letra":"E","texto":"Emitir luz continuamente"},{"letra":"F","texto":"Medir a temperatura do ambiente"}]'::jsonb, 'C', 'O transistor tem três terminais e controla a corrente entre dois deles por meio do terceiro, o que permite amplificação (analógica) e chaveamento (digital) — é a base dos processadores modernos. Retificação é papel do diodo.', 'Sedra & Smith, Microelectronic Circuits, cap. 1', 'qual e a funcao principal de um transistor em um circuito eletronico##amplificar sinais e funcionar como chave|armazenar carga de forma permanente|converter corrente alternada em continua|emitir luz continuamente|isolar galvanicamente dois circuitos|medir a temperatura do ambiente', 'aprovada', TRUE, 1),
  ('br-robotica-01', 'tecnologia', 'robotica', 'facil', 1, 'Qual sensor é comumente usado em robôs móveis para medir a distância até um obstáculo a curto alcance?', '[{"letra":"A","texto":"Magnetômetro"},{"letra":"B","texto":"Célula de carga"},{"letra":"C","texto":"Termopar"},{"letra":"D","texto":"Acelerômetro"},{"letra":"E","texto":"Ultrassônico"},{"letra":"F","texto":"Giroscópio"}]'::jsonb, 'E', 'O sensor ultrassônico emite um pulso sonoro e mede o tempo de eco para calcular a distância. Acelerômetro mede aceleração, giroscópio mede velocidade angular, magnetômetro mede campo magnético e a célula de carga mede força.', 'Siegwart, Nourbakhsh & Scaramuzza — Introduction to Autonomous Mobile Robots, cap. 4', 'qual sensor e comumente usado em robos moveis para medir a distancia ate um obstaculo a curto alcance##acelerometro|celula de carga|giroscopio|magnetometro|termopar|ultrassonico', 'aprovada', TRUE, 1),
  ('br-robotica-02', 'tecnologia', 'robotica', 'intermediaria', 2, 'Em robótica, os ''graus de liberdade'' de um manipulador correspondem a:', '[{"letra":"A","texto":"A carga máxima que ele levanta"},{"letra":"B","texto":"O número de motores ligados ao mesmo tempo"},{"letra":"C","texto":"A precisão de repetição do movimento"},{"letra":"D","texto":"A quantidade de peças que compõem o braço"},{"letra":"E","texto":"A velocidade máxima da ferramenta"},{"letra":"F","texto":"O número de juntas independentes que definem sua configuração no espaço"}]'::jsonb, 'F', 'Cada grau de liberdade é uma variável independente de movimento, de rotação ou translação. Um braço com 6 graus de liberdade consegue posicionar e orientar a ferramenta livremente no espaço tridimensional. Carga e precisão são especificações distintas.', 'John J. Craig, Introduction to Robotics, cap. 1', 'em robotica os graus de liberdade de um manipulador correspondem a##a carga maxima que ele levanta|a precisao de repeticao do movimento|a quantidade de pecas que compoem o braco|a velocidade maxima da ferramenta|o numero de juntas independentes que definem sua configuracao no espaco|o numero de motores ligados ao mesmo tempo', 'aprovada', TRUE, 1),
  ('br-filosofia-moderna-01', 'filosofia', 'filosofia-moderna', 'facil', 1, 'Qual filósofo moderno chegou à conclusão ''Penso, logo existo'' (Cogito, ergo sum) como primeira certeza indubitável?', '[{"letra":"A","texto":"Francis Bacon"},{"letra":"B","texto":"Immanuel Kant"},{"letra":"C","texto":"Baruch de Espinosa"},{"letra":"D","texto":"René Descartes"},{"letra":"E","texto":"David Hume"},{"letra":"F","texto":"John Locke"}]'::jsonb, 'D', 'Descartes, no Discurso do Método (1637) e nas Meditações (1641), aplicou a dúvida metódica a tudo e encontrou no próprio ato de pensar uma certeza que resistia à dúvida. Kant e Hume vêm depois; Espinosa foi contemporâneo e interlocutor crítico de Descartes.', 'Stanford Encyclopedia of Philosophy — René Descartes', 'qual filosofo moderno chegou a conclusao penso logo existo cogito ergo sum como primeira certeza indubitavel##baruch de espinosa|david hume|francis bacon|immanuel kant|john locke|rene descartes', 'aprovada', TRUE, 1),
  ('br-filosofia-moderna-02', 'filosofia', 'filosofia-moderna', 'avancada', 4, 'Kant chamou de ''revolução copernicana'' na filosofia a tese de que:', '[{"letra":"A","texto":"A Terra gira em torno do Sol"},{"letra":"B","texto":"A mente é uma tábula rasa"},{"letra":"C","texto":"O conhecimento se dá quando o objeto se conforma às estruturas do sujeito, e não o contrário"},{"letra":"D","texto":"Deus é a causa primeira de todas as coisas"},{"letra":"E","texto":"A verdade depende de cada cultura"},{"letra":"F","texto":"Todo conhecimento vem da experiência sensível"}]'::jsonb, 'C', 'Assim como Copérnico pôs o observador em movimento, Kant (Crítica da Razão Pura, 1781) propôs que as condições do conhecimento estão no sujeito: espaço, tempo e categorias organizam o que é dado à sensibilidade. Isso encerra o impasse entre racionalismo e empirismo, pois há conhecimento sintético a priori.', 'Stanford Encyclopedia of Philosophy — Kant''s Critique of Pure Reason', 'kant chamou de revolucao copernicana na filosofia a tese de que##a mente e uma tabula rasa|a terra gira em torno do sol|a verdade depende de cada cultura|deus e a causa primeira de todas as coisas|o conhecimento se da quando o objeto se conforma as estruturas do sujeito e nao o contrario|todo conhecimento vem da experiencia sensivel', 'aprovada', TRUE, 1),
  ('br-filosofia-contemporanea-01', 'filosofia', 'filosofia-contemporanea', 'intermediaria', 2, 'Na obra ''A Condição Humana'' (1958), Hannah Arendt distingue três atividades fundamentais da vida ativa. Quais são?', '[{"letra":"A","texto":"Desejo, vontade e dever"},{"letra":"B","texto":"Dúvida, crença e certeza"},{"letra":"C","texto":"Labor, trabalho e ação"},{"letra":"D","texto":"Sensação, percepção e razão"},{"letra":"E","texto":"Instinto, hábito e reflexão"},{"letra":"F","texto":"Produção, consumo e acumulação"}]'::jsonb, 'C', 'Arendt separa o labor (a atividade cíclica que mantém a vida biológica), o trabalho (que produz objetos duráveis, o mundo artificial) e a ação (a atividade política, em que as pessoas aparecem umas às outras pela fala e pelo ato). A modernidade teria subordinado a ação ao labor.', 'Hannah Arendt — The Human Condition (1958); Stanford Encyclopedia of Philosophy', 'na obra a condicao humana 1958 hannah arendt distingue tres atividades fundamentais da vida ativa quais sao##desejo vontade e dever|duvida crenca e certeza|instinto habito e reflexao|labor trabalho e acao|producao consumo e acumulacao|sensacao percepcao e razao', 'aprovada', TRUE, 1),
  ('br-filosofia-contemporanea-02', 'filosofia', 'filosofia-contemporanea', 'avancada', 4, 'No experimento mental do ''véu da ignorância'', John Rawls pede que se escolham os princípios de justiça:', '[{"letra":"A","texto":"Sem saber qual posição social, talento ou concepção de bem se terá na sociedade"},{"letra":"B","texto":"Com base na tradição herdada"},{"letra":"C","texto":"Considerando apenas a utilidade total agregada"},{"letra":"D","texto":"Ignorando qualquer noção de cooperação social"},{"letra":"E","texto":"Segundo a vontade geral de um soberano"},{"letra":"F","texto":"A partir do que cada um já possui"}]'::jsonb, 'A', 'Em ''Uma Teoria da Justiça'' (1971), Rawls imagina uma posição original em que as partes escolhem princípios sem conhecer seus atributos particulares. Isso garante imparcialidade e leva a dois princípios: igualdade de liberdades básicas e o princípio da diferença, que admite desigualdades apenas se beneficiarem os menos favorecidos.', 'John Rawls — A Theory of Justice (1971); Stanford Encyclopedia of Philosophy', 'no experimento mental do veu da ignorancia john rawls pede que se escolham os principios de justica##a partir do que cada um ja possui|com base na tradicao herdada|considerando apenas a utilidade total agregada|ignorando qualquer nocao de cooperacao social|segundo a vontade geral de um soberano|sem saber qual posicao social talento ou concepcao de bem se tera na sociedade', 'aprovada', TRUE, 1),
  ('br-metafisica-01', 'filosofia', 'metafisica', 'intermediaria', 2, 'Para Aristóteles, a metafísica é a ciência que estuda:', '[{"letra":"A","texto":"O ser enquanto ser"},{"letra":"B","texto":"A beleza das obras de arte"},{"letra":"C","texto":"A linguagem e seus usos"},{"letra":"D","texto":"A alma humana exclusivamente"},{"letra":"E","texto":"Os astros e seu movimento"},{"letra":"F","texto":"As leis positivas das cidades"}]'::jsonb, 'A', 'Aristóteles define a ''filosofia primeira'' como o estudo do ser enquanto ser — suas causas e princípios mais gerais —, distinta das ciências particulares que recortam um tipo de ente. Os livros que reuniram esses tratados receberam o título ''Metafísica'' por virem depois dos de física.', 'Stanford Encyclopedia of Philosophy — Aristotle''s Metaphysics', 'para aristoteles a metafisica e a ciencia que estuda##a alma humana exclusivamente|a beleza das obras de arte|a linguagem e seus usos|as leis positivas das cidades|o ser enquanto ser|os astros e seu movimento', 'aprovada', TRUE, 1),
  ('br-metafisica-02', 'filosofia', 'metafisica', 'avancada', 4, 'O ''problema dos universais'' na metafísica pergunta, essencialmente:', '[{"letra":"A","texto":"Se a liberdade é compatível com o determinismo"},{"letra":"B","texto":"Se as propriedades compartilhadas por várias coisas (como a vermelhidão) existem em si ou apenas nos nomes e nas mentes"},{"letra":"C","texto":"Se o mundo é feito de uma só substância ou de muitas"},{"letra":"D","texto":"Se a beleza é objetiva ou subjetiva"},{"letra":"E","texto":"Se o tempo tem começo e fim"},{"letra":"F","texto":"Se o conhecimento deriva da razão ou da experiência"}]'::jsonb, 'B', 'O debate opõe realistas (os universais existem independentemente das coisas, como queria Platão) a nominalistas (são apenas nomes ou convenções, como sustentou Ockham), com posições intermediárias como o realismo moderado de Aristóteles, em que a forma existe nas próprias coisas. É uma questão sobre a estrutura da realidade, não sobre a origem do conhecimento.', 'Stanford Encyclopedia of Philosophy — The Problem of Universals', 'o problema dos universais na metafisica pergunta essencialmente##se a beleza e objetiva ou subjetiva|se a liberdade e compativel com o determinismo|se as propriedades compartilhadas por varias coisas como a vermelhidao existem em si ou apenas nos nomes e nas mentes|se o conhecimento deriva da razao ou da experiencia|se o mundo e feito de uma so substancia ou de muitas|se o tempo tem comeco e fim', 'aprovada', TRUE, 1),
  ('br-logica-01', 'filosofia', 'logica', 'facil', 1, 'Na lógica proposicional, se ''Se chove, então a rua fica molhada'' e sabemos que chove, o que se conclui validamente?', '[{"letra":"A","texto":"Nada se conclui"},{"letra":"B","texto":"Não chove"},{"letra":"C","texto":"A rua fica seca"},{"letra":"D","texto":"Choveu ontem"},{"letra":"E","texto":"A rua fica molhada"},{"letra":"F","texto":"A rua não fica molhada"}]'::jsonb, 'E', 'É o modus ponens: de P → Q e P conclui-se Q. Afirmar o consequente (Q, logo P) ou negar o antecedente (não P, logo não Q) são falácias — válido é também o modus tollens: de P → Q e não Q, conclui-se não P.', 'Stanford Encyclopedia of Philosophy — Classical Logic', 'na logica proposicional se se chove entao a rua fica molhada e sabemos que chove o que se conclui validamente##a rua fica molhada|a rua fica seca|a rua nao fica molhada|choveu ontem|nada se conclui|nao chove', 'aprovada', TRUE, 1),
  ('br-logica-02', 'filosofia', 'logica', 'intermediaria', 2, 'Um argumento dedutivamente válido é aquele em que:', '[{"letra":"A","texto":"É impossível que as premissas sejam verdadeiras e a conclusão falsa"},{"letra":"B","texto":"A conclusão é provável, mas não certa"},{"letra":"C","texto":"A conclusão é mais ampla que as premissas"},{"letra":"D","texto":"As premissas são sempre verdadeiras"},{"letra":"E","texto":"Todas as premissas são observações empíricas"},{"letra":"F","texto":"A conclusão repete uma das premissas"}]'::jsonb, 'A', 'Validade é uma propriedade da forma: se as premissas forem verdadeiras, a conclusão não pode ser falsa. Isso não exige que as premissas sejam de fato verdadeiras — um argumento pode ser válido e ter premissa falsa (som). Argumentos indutivos apenas tornam a conclusão provável.', 'Stanford Encyclopedia of Philosophy — Validity and Soundness', 'um argumento dedutivamente valido e aquele em que##a conclusao e mais ampla que as premissas|a conclusao e provavel mas nao certa|a conclusao repete uma das premissas|as premissas sao sempre verdadeiras|e impossivel que as premissas sejam verdadeiras e a conclusao falsa|todas as premissas sao observacoes empiricas', 'aprovada', TRUE, 1),
  ('br-filosofia-politica-01', 'filosofia', 'filosofia-politica', 'facil', 1, 'Qual obra de Thomas Hobbes descreve o estado de natureza como uma ''guerra de todos contra todos'' e defende um soberano forte?', '[{"letra":"A","texto":"A Política"},{"letra":"B","texto":"A República"},{"letra":"C","texto":"O Príncipe"},{"letra":"D","texto":"Do Contrato Social"},{"letra":"E","texto":"A Riqueza das Nações"},{"letra":"F","texto":"Leviatã"}]'::jsonb, 'F', 'Em ''Leviatã'' (1651), Hobbes parte do medo da morte violenta para justificar um pacto em que os indivíduos transferem poder a um soberano capaz de garantir a paz. ''A República'' é de Platão, ''O Príncipe'' de Maquiavel e ''Do Contrato Social'' de Rousseau.', 'Stanford Encyclopedia of Philosophy — Thomas Hobbes', 'qual obra de thomas hobbes descreve o estado de natureza como uma guerra de todos contra todos e defende um soberano forte##a politica|a republica|a riqueza das nacoes|do contrato social|leviata|o principe', 'aprovada', TRUE, 1),
  ('br-filosofia-politica-02', 'filosofia', 'filosofia-politica', 'intermediaria', 2, 'A distinção entre ''liberdade negativa'' e ''liberdade positiva'', popularizada por Isaiah Berlin, corresponde a:', '[{"letra":"A","texto":"Liberdade civil versus liberdade penal"},{"letra":"B","texto":"Liberdade individual versus liberdade coletiva"},{"letra":"C","texto":"Liberdade antiga versus liberdade moderna"},{"letra":"D","texto":"Liberdade econômica versus liberdade religiosa"},{"letra":"E","texto":"Liberdade de expressão versus liberdade de imprensa"},{"letra":"F","texto":"Ausência de interferência externa versus capacidade de ser senhor de si mesmo"}]'::jsonb, 'F', 'No ensaio ''Dois Conceitos de Liberdade'' (1958), Berlin opõe a liberdade negativa (ninguém me impede; um espaço sem obstáculos) à positiva (quero ser autor das minhas próprias escolhas). Ele alerta que a versão positiva, ao dividir o eu em superior e inferior, pode justificar coerção em nome da autonomia real.', 'Isaiah Berlin — Two Concepts of Liberty (1958)', 'a distincao entre liberdade negativa e liberdade positiva popularizada por isaiah berlin corresponde a##ausencia de interferencia externa versus capacidade de ser senhor de si mesmo|liberdade antiga versus liberdade moderna|liberdade civil versus liberdade penal|liberdade de expressao versus liberdade de imprensa|liberdade economica versus liberdade religiosa|liberdade individual versus liberdade coletiva', 'aprovada', TRUE, 1),
  ('br-antropologia-01', 'humanas', 'antropologia', 'intermediaria', 2, 'A ''observação participante'', método que se tornou marca da antropologia social, foi consolidada por qual autor?', '[{"letra":"A","texto":"Auguste Comte"},{"letra":"B","texto":"Max Weber"},{"letra":"C","texto":"Sigmund Freud"},{"letra":"D","texto":"Émile Durkheim"},{"letra":"E","texto":"Bronisław Malinowski"},{"letra":"F","texto":"Karl Marx"}]'::jsonb, 'E', 'Malinowski, em ''Argonautas do Pacífico Ocidental'' (1922), defendeu viver entre os nativos, aprender a língua e registrar a vida cotidiana — o trabalho de campo prolongado substituiu o relato de viajantes e missionários. Durkheim e Weber são fundadores da sociologia, não da observação participante.', 'Malinowski — Argonauts of the Western Pacific (1922)', 'a observacao participante metodo que se tornou marca da antropologia social foi consolidada por qual autor##auguste comte|bronis aw malinowski|emile durkheim|karl marx|max weber|sigmund freud', 'aprovada', TRUE, 1),
  ('br-antropologia-02', 'humanas', 'antropologia', 'avancada', 4, 'Na antropologia estrutural de Claude Lévi-Strauss, o que se busca identificar por trás dos mitos e parentescos?', '[{"letra":"A","texto":"As leis econômicas universais"},{"letra":"B","texto":"A evolução biológica das espécies"},{"letra":"C","texto":"Estruturas inconscientes de oposições que organizam o pensamento humano"},{"letra":"D","texto":"Os arquétipos judaico-cristãos"},{"letra":"E","texto":"A origem genética dos povos"},{"letra":"F","texto":"A superioridade de uma cultura sobre outra"}]'::jsonb, 'C', 'Lévi-Strauss propõe que os mitos não são narrativas arbitrárias: organizam-se por pares de oposições (cru/cozido, natureza/cultura) que revelam estruturas do espírito humano, inconscientes e comuns. Isso rompe com a leitura evolucionista que hierarquizava culturas.', 'Lévi-Strauss — Anthropologie structurale (1958); Stanford Encyclopedia of Philosophy', 'na antropologia estrutural de claude levi strauss o que se busca identificar por tras dos mitos e parentescos##a evolucao biologica das especies|a origem genetica dos povos|a superioridade de uma cultura sobre outra|as leis economicas universais|estruturas inconscientes de oposicoes que organizam o pensamento humano|os arquetipos judaico cristaos', 'aprovada', TRUE, 1),
  ('br-ciencia-politica-01', 'humanas', 'ciencia-politica', 'facil', 1, 'A separação dos poderes em Executivo, Legislativo e Judiciário foi sistematizada por qual pensador?', '[{"letra":"A","texto":"Nicolau Maquiavel"},{"letra":"B","texto":"Karl Marx"},{"letra":"C","texto":"Thomas More"},{"letra":"D","texto":"Jean-Jacques Rousseau"},{"letra":"E","texto":"Alexis de Tocqueville"},{"letra":"F","texto":"Montesquieu"}]'::jsonb, 'F', 'Montesquieu, em ''O Espírito das Leis'' (1748), sustenta que só o poder freia o poder, propondo a divisão em três funções. A ideia influenciou diretamente a Constituição dos Estados Unidos e a Declaração dos Direitos do Homem. A formulação tripartite também ecoa Locke, mas a sistematização clássica é de Montesquieu.', 'Montesquieu — De l''esprit des lois (1748); Encyclopaedia Britannica', 'a separacao dos poderes em executivo legislativo e judiciario foi sistematizada por qual pensador##alexis de tocqueville|jean jacques rousseau|karl marx|montesquieu|nicolau maquiavel|thomas more', 'aprovada', TRUE, 1),
  ('br-ciencia-politica-02', 'humanas', 'ciencia-politica', 'intermediaria', 2, 'O conceito de ''poliarquia'', formulado por Robert Dahl, descreve:', '[{"letra":"A","texto":"Regimes com disputa eleitoral competitiva, participação ampliada e liberdades civis garantidas"},{"letra":"B","texto":"A ausência total de Estado"},{"letra":"C","texto":"O governo dos especialistas técnicos"},{"letra":"D","texto":"O império mundial de uma potência"},{"letra":"E","texto":"O governo de um só partido"},{"letra":"F","texto":"A ditadura da maioria sobre a minoria"}]'::jsonb, 'A', 'Dahl (Polyarchy, 1971) usa ''poliarquia'' para os regimes realmente existentes que combinam contestação pública e participação inclusiva, evitando chamar de democracia plena o que é aproximação. O conceito deu base a índices contemporâneos de qualidade democrática.', 'Robert A. Dahl — Polyarchy: Participation and Opposition (1971)', 'o conceito de poliarquia formulado por robert dahl descreve##a ausencia total de estado|a ditadura da maioria sobre a minoria|o governo de um so partido|o governo dos especialistas tecnicos|o imperio mundial de uma potencia|regimes com disputa eleitoral competitiva participacao ampliada e liberdades civis garantidas', 'aprovada', TRUE, 1),
  ('br-historia-das-civilizacoes-01', 'humanas', 'historia-das-civilizacoes', 'facil', 1, 'Qual civilização desenvolveu uma das primeiras formas de escrita, a cuneiforme, gravada em tábuas de argila?', '[{"letra":"A","texto":"Suméria, na Mesopotâmia"},{"letra":"B","texto":"Império Inca"},{"letra":"C","texto":"China imperial"},{"letra":"D","texto":"Grécia clássica"},{"letra":"E","texto":"Império Romano"},{"letra":"F","texto":"Egito faraônico"}]'::jsonb, 'A', 'A escrita cuneiforme surge na Suméria por volta de 3200 a.C., inicialmente para registros contábeis, e antecede os hieróglifos egípcios em séculos. Os incas, no outro extremo, não tinham escrita no sentido estrito — usavam quipos.', 'British Museum — Mesopotamia, writing and cuneiform tablets', 'qual civilizacao desenvolveu uma das primeiras formas de escrita a cuneiforme gravada em tabuas de argila##china imperial|egito faraonico|grecia classica|imperio inca|imperio romano|sumeria na mesopotamia', 'aprovada', TRUE, 1),
  ('br-historia-das-civilizacoes-02', 'humanas', 'historia-das-civilizacoes', 'intermediaria', 2, 'A ''Rota da Seda'' foi historicamente importante sobretudo porque:', '[{"letra":"A","texto":"Foi criada no século XX para o comércio de petróleo"},{"letra":"B","texto":"Serviu apenas ao transporte de seda chinesa"},{"letra":"C","texto":"Conectou Ásia, Oriente Médio e Europa em redes de troca de mercadorias, técnicas e ideias"},{"letra":"D","texto":"Era uma rota exclusivamente marítima"},{"letra":"E","texto":"Ligava diretamente Lisboa ao Rio de Janeiro"},{"letra":"F","texto":"Foi uma estrada pavimentada construída por Roma"}]'::jsonb, 'C', 'Mais que um caminho único, a Rota da Seda foi uma malha de rotas terrestres e marítimas que circulou mercadorias, tecnologias (papel, pólvora), religiões e doenças — inclusive a peste negra. Chamá-la só de rota de seda subestima o intercâmbio cultural.', 'UNESCO — Silk Roads Programme', 'a rota da seda foi historicamente importante sobretudo porque##conectou asia oriente medio e europa em redes de troca de mercadorias tecnicas e ideias|era uma rota exclusivamente maritima|foi criada no seculo xx para o comercio de petroleo|foi uma estrada pavimentada construida por roma|ligava diretamente lisboa ao rio de janeiro|serviu apenas ao transporte de seda chinesa', 'aprovada', TRUE, 1),
  ('br-geopolitica-01', 'humanas', 'geopolitica', 'intermediaria', 2, 'A teoria do ''heartland'' (área-pivô da Eurásia), segundo a qual quem domina o centro do continente domina o mundo, foi proposta por:', '[{"letra":"A","texto":"Alfred Mahan"},{"letra":"B","texto":"Halford Mackinder"},{"letra":"C","texto":"Fernand Braudel"},{"letra":"D","texto":"Nicholas Spykman"},{"letra":"E","texto":"Immanuel Wallerstein"},{"letra":"F","texto":"Karl Haushofer"}]'::jsonb, 'B', 'Mackinder apresentou a tese em 1904 (''The Geographical Pivot of History''), reformulada em 1919 com o termo heartland. Spykman depois deslocou o foco para o ''rimland'', a faixa costeira da Eurásia. Mahan é o teórico do poder naval.', 'Halford J. Mackinder — The Geographical Pivot of History (1904)', 'a teoria do heartland area pivo da eurasia segundo a qual quem domina o centro do continente domina o mundo foi proposta por##alfred mahan|fernand braudel|halford mackinder|immanuel wallerstein|karl haushofer|nicholas spykman', 'aprovada', TRUE, 1),
  ('br-geopolitica-02', 'humanas', 'geopolitica', 'avancada', 4, 'Por que os Estreitos de Malaca têm peso estratégico mundial?', '[{"letra":"A","texto":"Por ligarem o Mar Mediterrâneo ao Mar Vermelho"},{"letra":"B","texto":"Por concentrarem parcela decisiva do comércio marítimo entre o Índico e o Pacífico, inclusive petróleo"},{"letra":"C","texto":"Por estarem sob administração da ONU"},{"letra":"D","texto":"Por abrigarem a maior reserva de petróleo do planeta"},{"letra":"E","texto":"Por serem a única ligação entre Atlântico e Pacífico"},{"letra":"F","texto":"Por serem o ponto mais profundo dos oceanos"}]'::jsonb, 'B', 'É uma das passagens mais movimentadas do mundo, gargalo para o comércio entre Ásia e Europa e para o petróleo do Golfo rumo ao Leste Asiático. Ligar Atlântico e Pacífico é o Canal do Panamá; ligar Mediterrâneo e Mar Vermelho é o Canal de Suez.', 'EIA — World Oil Transit Chokepoints (Malacca Strait)', 'por que os estreitos de malaca tem peso estrategico mundial##por abrigarem a maior reserva de petroleo do planeta|por concentrarem parcela decisiva do comercio maritimo entre o indico e o pacifico inclusive petroleo|por estarem sob administracao da onu|por ligarem o mar mediterraneo ao mar vermelho|por serem a unica ligacao entre atlantico e pacifico|por serem o ponto mais profundo dos oceanos', 'aprovada', TRUE, 1),
  ('br-arqueologia-01', 'humanas', 'arqueologia', 'facil', 1, 'Qual método permite datar material orgânico (madeira, osso, carvão) com base na desintegração de um isótopo do carbono?', '[{"letra":"A","texto":"Dendrocronologia"},{"letra":"B","texto":"Potássio-argônio"},{"letra":"C","texto":"Carbono-14"},{"letra":"D","texto":"Uranio-tório"},{"letra":"E","texto":"Termoluminescência"},{"letra":"F","texto":"Estratigrafia"}]'::jsonb, 'C', 'O carbono-14 se forma na atmosfera e é absorvido pelos seres vivos; quando morrem, o isótopo decai com meia-vida de cerca de 5.730 anos, o que permite datar material orgânico até ~50 mil anos. Potássio-argônio serve para rochas vulcânicas e dendrocronologia para madeira com anéis.', 'Libby, Radiocarbon Dating (Nobel de Química 1960); Beta Analytic', 'qual metodo permite datar material organico madeira osso carvao com base na desintegracao de um isotopo do carbono##carbono 14|dendrocronologia|estratigrafia|potassio argonio|termoluminescencia|uranio torio', 'aprovada', TRUE, 1),
  ('br-arqueologia-02', 'humanas', 'arqueologia', 'intermediaria', 2, 'No registro arqueológico, o ''princípio da superposição'' de camadas indica que:', '[{"letra":"A","texto":"A idade depende só do tipo de solo"},{"letra":"B","texto":"A camada superior é sempre a mais antiga"},{"letra":"C","texto":"Camadas profundas são sempre estéreis"},{"letra":"D","texto":"Todas as camadas têm a mesma idade"},{"letra":"E","texto":"Em depósitos não perturbados, a camada inferior é mais antiga que a superior"},{"letra":"F","texto":"Artefatos mais bonitos são mais antigos"}]'::jsonb, 'E', 'É o princípio básico da estratigrafia, formulado na geologia e incorporado à arqueologia: o sedimento se acumula em ordem, então camadas mais fundas são mais antigas — desde que o sítio não tenha sido revirado por animais, raízes ou escavações posteriores.', 'Renfrew & Bahn — Archaeology: Theories, Methods and Practice, cap. 3', 'no registro arqueologico o principio da superposicao de camadas indica que##a camada superior e sempre a mais antiga|a idade depende so do tipo de solo|artefatos mais bonitos sao mais antigos|camadas profundas sao sempre estereis|em depositos nao perturbados a camada inferior e mais antiga que a superior|todas as camadas tem a mesma idade', 'aprovada', TRUE, 1),
  ('br-demografia-01', 'humanas', 'demografia', 'intermediaria', 2, 'A ''transição demográfica'' descreve a passagem de um regime populacional:', '[{"letra":"A","texto":"De população jovem para população idosa sem mudança nas taxas"},{"letra":"B","texto":"De migração interna para migração internacional"},{"letra":"C","texto":"De altas taxas de natalidade e mortalidade para taxas baixas, com crescimento intermediário acelerado"},{"letra":"D","texto":"De mortalidade infantil alta para expectativa de vida decrescente"},{"letra":"E","texto":"De êxodo rural para urbanização completa"},{"letra":"F","texto":"De censos anuais para censos decenais"}]'::jsonb, 'C', 'Na transição clássica, a mortalidade cai primeiro (saneamento, vacinas, medicina) e a natalidade demora mais para cair — por isso o crescimento explode no meio do processo e depois estabiliza. A queda simultânea de ambas gera o envelhecimento populacional que se observa hoje.', 'ONU — World Population Prospects (teoria da transição demográfica)', 'a transicao demografica descreve a passagem de um regime populacional##de altas taxas de natalidade e mortalidade para taxas baixas com crescimento intermediario acelerado|de censos anuais para censos decenais|de exodo rural para urbanizacao completa|de migracao interna para migracao internacional|de mortalidade infantil alta para expectativa de vida decrescente|de populacao jovem para populacao idosa sem mudanca nas taxas', 'aprovada', TRUE, 1),
  ('br-demografia-02', 'humanas', 'demografia', 'facil', 1, 'No Brasil, o censo demográfico é realizado pelo:', '[{"letra":"A","texto":"INSS"},{"letra":"B","texto":"Receita Federal"},{"letra":"C","texto":"Ministério da Saúde"},{"letra":"D","texto":"IBGE"},{"letra":"E","texto":"Banco Central"},{"letra":"F","texto":"IPEA"}]'::jsonb, 'D', 'O Instituto Brasileiro de Geografia e Estatística (IBGE) é o órgão responsável pelo censo decenal, que conta a população e levanta características socioeconômicas. IPEA faz pesquisa econômica aplicada, mas não o censo.', 'IBGE — Censo Demográfico', 'no brasil o censo demografico e realizado pelo##banco central|ibge|inss|ipea|ministerio da saude|receita federal', 'aprovada', TRUE, 1),
  ('br-psicologia-comportamental-01', 'psicologia', 'psicologia-comportamental', 'facil', 1, 'No condicionamento clássico descrito por Ivan Pavlov, o que acontece quando um estímulo neutro é repetidamente associado a um estímulo que já provoca resposta?', '[{"letra":"A","texto":"Surge uma resposta totalmente nova, sem relação com a anterior"},{"letra":"B","texto":"O estímulo neutro passa a provocar a resposta por si só"},{"letra":"C","texto":"A resposta desaparece definitivamente"},{"letra":"D","texto":"O estímulo incondicionado perde efeito imediato"},{"letra":"E","texto":"A resposta se torna voluntária e consciente"},{"letra":"F","texto":"O animal deixa de responder a qualquer estímulo"}]'::jsonb, 'B', 'Pavlov observou que um som (estímulo neutro), associado repetidas vezes à comida (estímulo incondicionado), passava a provocar salivação sozinho — o estímulo condicionado. É aprendizagem por associação, distinta do condicionamento operante de Skinner, que trabalha com consequências.', 'Pavlov — Conditioned Reflexes (1927); APA Dictionary of Psychology', 'no condicionamento classico descrito por ivan pavlov o que acontece quando um estimulo neutro e repetidamente associado a um estimulo que ja provoca resposta##a resposta desaparece definitivamente|a resposta se torna voluntaria e consciente|o animal deixa de responder a qualquer estimulo|o estimulo incondicionado perde efeito imediato|o estimulo neutro passa a provocar a resposta por si so|surge uma resposta totalmente nova sem relacao com a anterior', 'aprovada', TRUE, 1),
  ('br-psicologia-comportamental-02', 'psicologia', 'psicologia-comportamental', 'intermediaria', 2, 'Na análise do comportamento, qual é a diferença central entre reforço negativo e punição?', '[{"letra":"A","texto":"O reforço negativo extingue o comportamento"},{"letra":"B","texto":"O reforço negativo pune; a punição recompensa"},{"letra":"C","texto":"O reforço negativo é sempre um castigo físico"},{"letra":"D","texto":"O reforço negativo aumenta a frequência do comportamento; a punição a diminui"},{"letra":"E","texto":"Ambos aumentam a frequência do comportamento"},{"letra":"F","texto":"A punição só existe em humanos"}]'::jsonb, 'D', 'Reforço (positivo ou negativo) sempre AUMENTA a frequência: o negativo faz isso removendo um estímulo aversivo — como tomar um analgésico que tira a dor. Punição diminui a frequência. O nome ''negativo'' se refere à retirada de estímulo, não a algo ruim.', 'Skinner — Science and Human Behavior (1953); APA Dictionary of Psychology', 'na analise do comportamento qual e a diferenca central entre reforco negativo e punicao##a punicao so existe em humanos|ambos aumentam a frequencia do comportamento|o reforco negativo aumenta a frequencia do comportamento a punicao a diminui|o reforco negativo e sempre um castigo fisico|o reforco negativo extingue o comportamento|o reforco negativo pune a punicao recompensa', 'aprovada', TRUE, 1),
  ('br-neuropsicologia-01', 'psicologia', 'neuropsicologia', 'intermediaria', 2, 'O caso de Phineas Gage, operário que sobreviveu a uma barra atravessando o crânio em 1848, tornou-se clássico na neuropsicologia porque evidenciou o papel de qual região?', '[{"letra":"A","texto":"Córtex pré-frontal, ligado ao controle de impulsos e ao comportamento social"},{"letra":"B","texto":"Hipotálamo, ligado à temperatura"},{"letra":"C","texto":"Bulbo, ligado à respiração"},{"letra":"D","texto":"Nervo óptico, ligado à visão"},{"letra":"E","texto":"Cerebelo, ligado ao equilíbrio"},{"letra":"F","texto":"Medula espinhal, ligada aos reflexos"}]'::jsonb, 'A', 'Gage manteve funções motoras e de linguagem, mas sua personalidade e seu autocontrole mudaram de forma marcante. O caso passou a sustentar a ideia de que o córtex pré-frontal integra planejamento, inibição de impulsos e conduta social — hoje confirmado por lesões e neuroimagem.', 'Damasio et al. — The return of Phineas Gage (Science, 1994)', 'o caso de phineas gage operario que sobreviveu a uma barra atravessando o cranio em 1848 tornou se classico na neuropsicologia porque evidenciou o papel de qual regiao##bulbo ligado a respiracao|cerebelo ligado ao equilibrio|cortex pre frontal ligado ao controle de impulsos e ao comportamento social|hipotalamo ligado a temperatura|medula espinhal ligada aos reflexos|nervo optico ligado a visao', 'aprovada', TRUE, 1),
  ('br-neuropsicologia-02', 'psicologia', 'neuropsicologia', 'avancada', 4, 'Qual é a diferença entre a afasia de Broca e a afasia de Wernicke?', '[{"letra":"A","texto":"Broca afeta a visão; Wernicke afeta a audição"},{"letra":"B","texto":"Broca: fala difícil de produzir, mas compreensão relativamente preservada. Wernicke: fala fluente, mas sem sentido e com compreensão prejudicada"},{"letra":"C","texto":"Broca é sempre reversível; Wernicke é sempre definitiva"},{"letra":"D","texto":"São nomes diferentes para a mesma condição"},{"letra":"E","texto":"Broca atinge apenas crianças; Wernicke apenas adultos"},{"letra":"F","texto":"Broca prejudica a leitura em voz alta; Wernicke, o cálculo"}]'::jsonb, 'B', 'A afasia de Broca (área frontal) é não fluente: o paciente esforça-se para emitir frases curtas, mas costuma entender o que lhe dizem. A de Wernicke (área temporal) é fluente porém vazia: o paciente fala com ritmo e entonação normais, com palavras trocadas ou inventadas, e não compreende bem o que ouve.', 'NIH/NIDCD — Aphasia; Kandel et al., Principles of Neural Science', 'qual e a diferenca entre a afasia de broca e a afasia de wernicke##broca afeta a visao wernicke afeta a audicao|broca atinge apenas criancas wernicke apenas adultos|broca e sempre reversivel wernicke e sempre definitiva|broca fala dificil de produzir mas compreensao relativamente preservada wernicke fala fluente mas sem sentido e com compreensao prejudicada|broca prejudica a leitura em voz alta wernicke o calculo|sao nomes diferentes para a mesma condicao', 'aprovada', TRUE, 1),
  ('br-desenvolvimento-humano-01', 'psicologia', 'desenvolvimento-humano', 'facil', 1, 'Segundo Jean Piaget, em qual estágio a criança passa a operar com conceitos abstratos e hipotéticos, por volta dos 11 anos em diante?', '[{"letra":"A","texto":"Estágio oral"},{"letra":"B","texto":"Operatório formal"},{"letra":"C","texto":"Pré-operatório"},{"letra":"D","texto":"Estágio de latência"},{"letra":"E","texto":"Sensório-motor"},{"letra":"F","texto":"Operatório concreto"}]'::jsonb, 'B', 'Piaget descreve quatro estágios: sensório-motor (0-2), pré-operatório (2-7), operatório concreto (7-11) e operatório formal (11+), quando surge o raciocínio hipotético-dedutivo. ''Estágio oral'' e ''latência'' são termos de Freud, não de Piaget.', 'Piaget — A Epistemologia Genética; APA Dictionary of Psychology', 'segundo jean piaget em qual estagio a crianca passa a operar com conceitos abstratos e hipoteticos por volta dos 11 anos em diante##estagio de latencia|estagio oral|operatorio concreto|operatorio formal|pre operatorio|sensorio motor', 'aprovada', TRUE, 1),
  ('br-desenvolvimento-humano-02', 'psicologia', 'desenvolvimento-humano', 'intermediaria', 2, 'Nos estudos de Mary Ainsworth sobre apego, o procedimento que observa como o bebê reage à separação e ao retorno da mãe chama-se:', '[{"letra":"A","texto":"Teste de Stroop"},{"letra":"B","texto":"Escala de Apgar"},{"letra":"C","texto":"Situação estranha"},{"letra":"D","texto":"Teste de Rorschach"},{"letra":"E","texto":"Quociente de inteligência"},{"letra":"F","texto":"Experimento de Milgram"}]'::jsonb, 'C', 'A ''situação estranha'' (Strange Situation) expõe o bebê a breves separações e reencontros com a figura de apego, classificando o vínculo em seguro, inseguro-evitativo e inseguro-ambivalente (depois acrescido o desorganizado). Rorschach e Stroop são testes psicológicos de outra natureza; Apgar avalia o recém-nascido.', 'Ainsworth et al. — Patterns of Attachment (1978)', 'nos estudos de mary ainsworth sobre apego o procedimento que observa como o bebe reage a separacao e ao retorno da mae chama se##escala de apgar|experimento de milgram|quociente de inteligencia|situacao estranha|teste de rorschach|teste de stroop', 'aprovada', TRUE, 1),
  ('br-psicanalise-01', 'psicologia', 'psicanalise', 'facil', 1, 'Na segunda tópica freudiana, quais são as três instâncias do aparelho psíquico?', '[{"letra":"A","texto":"Pulsão, desejo e fantasia"},{"letra":"B","texto":"Consciente, pré-consciente e inconsciente"},{"letra":"C","texto":"Eros, tânatos e libido"},{"letra":"D","texto":"Eu, outro e espelho"},{"letra":"E","texto":"Oral, anal e fálico"},{"letra":"F","texto":"Id, ego e superego"}]'::jsonb, 'F', 'O id busca a satisfação imediata pelo princípio do prazer; o ego negocia com a realidade; o superego internaliza normas e ideais. ''Consciente, pré-consciente e inconsciente'' é a primeira tópica — outra divisão, não a mesma.', 'Freud — O Ego e o Id (1923); APA Dictionary of Psychology', 'na segunda topica freudiana quais sao as tres instancias do aparelho psiquico##consciente pre consciente e inconsciente|eros tanatos e libido|eu outro e espelho|id ego e superego|oral anal e falico|pulsao desejo e fantasia', 'aprovada', TRUE, 1),
  ('br-psicanalise-02', 'psicologia', 'psicanalise', 'avancada', 4, 'Na clínica psicanalítica, o fenômeno da ''transferência'' consiste em:', '[{"letra":"A","texto":"O analista contar sua própria história ao paciente"},{"letra":"B","texto":"A mudança de consultório durante o tratamento"},{"letra":"C","texto":"A passagem do tratamento individual para o de grupo"},{"letra":"D","texto":"A substituição de um sintoma por outro"},{"letra":"E","texto":"O paciente deslocar para o analista sentimentos e fantasias originalmente ligados a figuras do passado"},{"letra":"F","texto":"A troca de diagnóstico entre dois profissionais"}]'::jsonb, 'E', 'Freud notou que o paciente revive no vínculo com o analista padrões afetivos antigos, sobretudo os parentais. Longe de ser só um obstáculo, a transferência é o material central do trabalho analítico — e exige que o analista reconheça também sua própria contratransferência. A troca de um sintoma por outro é a ''conversão''.', 'Freud — A Dinâmica da Transferência (1912); Laplanche & Pontalis, Vocabulário de Psicanálise', 'na clinica psicanalitica o fenomeno da transferencia consiste em##a mudanca de consultorio durante o tratamento|a passagem do tratamento individual para o de grupo|a substituicao de um sintoma por outro|a troca de diagnostico entre dois profissionais|o analista contar sua propria historia ao paciente|o paciente deslocar para o analista sentimentos e fantasias originalmente ligados a figuras do passado', 'aprovada', TRUE, 1),
  ('br-teorias-da-personalidade-01', 'psicologia', 'teorias-da-personalidade', 'intermediaria', 2, 'O modelo dos ''Cinco Grandes Fatores'' descreve a personalidade por quais dimensões?', '[{"letra":"A","texto":"Id, ego, superego, libido e pulsão"},{"letra":"B","texto":"Racional, emocional, ativo e passivo"},{"letra":"C","texto":"Oral, anal, fálico, latência e genital"},{"letra":"D","texto":"Introvertido, extrovertido, sensorial e intuitivo"},{"letra":"E","texto":"Sangue, fleuma, bile amarela e bile negra"},{"letra":"F","texto":"Abertura, conscienciosidade, extroversão, amabilidade e neuroticismo"}]'::jsonb, 'F', 'O Big Five (OCEAN) emergiu de análises fatoriais de descritores de personalidade e é hoje o modelo mais aceito na pesquisa. Os quatro humores são a teoria hipocrática-galênica; as fases oral a genital são de Freud; sensorial/intuitivo pertencem ao MBTI.', 'Costa & McCrae — Revised NEO Personality Inventory (NEO-PI-R)', 'o modelo dos cinco grandes fatores descreve a personalidade por quais dimensoes##abertura conscienciosidade extroversao amabilidade e neuroticismo|id ego superego libido e pulsao|introvertido extrovertido sensorial e intuitivo|oral anal falico latencia e genital|racional emocional ativo e passivo|sangue fleuma bile amarela e bile negra', 'aprovada', TRUE, 1),
  ('br-teorias-da-personalidade-02', 'psicologia', 'teorias-da-personalidade', 'avancada', 4, 'O conceito de ''inconsciente coletivo'' foi formulado por:', '[{"letra":"A","texto":"Alfred Adler"},{"letra":"B","texto":"Carl Gustav Jung"},{"letra":"C","texto":"Sigmund Freud"},{"letra":"D","texto":"Jean Piaget"},{"letra":"E","texto":"B. F. Skinner"},{"letra":"F","texto":"Abraham Maslow"}]'::jsonb, 'B', 'Jung propôs que, além do inconsciente pessoal, existiria uma camada compartilhada pela espécie, povoada de arquétipos como a Grande Mãe e o Sábio. Adler enfatizou sentimento de inferioridade e busca de poder; Maslow, a hierarquia das necessidades.', 'Jung — Os Arquétipos e o Inconsciente Coletivo (Obras Completas, vol. 9/1)', 'o conceito de inconsciente coletivo foi formulado por##abraham maslow|alfred adler|b f skinner|carl gustav jung|jean piaget|sigmund freud', 'aprovada', TRUE, 1),
  ('br-comportamento-coletivo-01', 'psicologia', 'comportamento-coletivo', 'intermediaria', 2, 'Nos experimentos de Solomon Asch sobre conformidade, o que se observou nos participantes quando cúmplices davam respostas visivelmente erradas sobre o comprimento de linhas?', '[{"letra":"A","texto":"Os participantes acertaram mais do que sozinhos"},{"letra":"B","texto":"Apenas crianças foram afetadas"},{"letra":"C","texto":"Nenhum participante foi influenciado"},{"letra":"D","texto":"Muitos participantes passaram a dar a resposta errada do grupo, mesmo sabendo qual era a correta"},{"letra":"E","texto":"A influência só ocorreu quando havia punição"},{"letra":"F","texto":"Todos denunciaram os cúmplices imediatamente"}]'::jsonb, 'D', 'Asch (1951) mostrou que uma parcela expressiva dos participantes acompanhava a maioria mesmo em tarefa perceptiva trivial, revelando a força da pressão do grupo sobre o julgamento individual. Muitos relatavam desconforto e dúvida sobre a própria percepção.', 'Asch — Effects of group pressure upon the modification and distortion of judgments (1951)', 'nos experimentos de solomon asch sobre conformidade o que se observou nos participantes quando cumplices davam respostas visivelmente erradas sobre o comprimento de linhas##a influencia so ocorreu quando havia punicao|apenas criancas foram afetadas|muitos participantes passaram a dar a resposta errada do grupo mesmo sabendo qual era a correta|nenhum participante foi influenciado|os participantes acertaram mais do que sozinhos|todos denunciaram os cumplices imediatamente', 'aprovada', TRUE, 1),
  ('br-comportamento-coletivo-02', 'psicologia', 'comportamento-coletivo', 'avancada', 4, 'O ''efeito espectador'', estudado por Darley e Latané, descreve a tendência de uma pessoa a:', '[{"letra":"A","texto":"Recordar melhor eventos testemunhados em grupo"},{"letra":"B","texto":"Ajudar mais quando está sozinha do que em grupo"},{"letra":"C","texto":"Agir de forma mais agressiva em multidões"},{"letra":"D","texto":"Imitar automaticamente quem está por perto"},{"letra":"E","texto":"Ajudar menos quando há outras pessoas presentes, por difusão de responsabilidade"},{"letra":"F","texto":"Julgar os outros pelo próprio comportamento"}]'::jsonb, 'E', 'Quanto mais pessoas presentes, menor a chance de alguém intervir, porque a responsabilidade se dilui e cada um busca nos outros sinais de que há emergência. O oposto do senso comum ''quanto mais gente, mais seguro''. O primeiro item descreve o mesmo achado; o segundo o contradiz.', 'Darley & Latané — Bystander intervention in emergencies (JPSP, 1968)', 'o efeito espectador estudado por darley e latane descreve a tendencia de uma pessoa a##agir de forma mais agressiva em multidoes|ajudar mais quando esta sozinha do que em grupo|ajudar menos quando ha outras pessoas presentes por difusao de responsabilidade|imitar automaticamente quem esta por perto|julgar os outros pelo proprio comportamento|recordar melhor eventos testemunhados em grupo', 'aprovada', TRUE, 1),
  ('br-historia-moderna-01', 'historia', 'historia-moderna', 'facil', 1, 'Qual evento de 1789 é considerado o marco inicial da Revolução Francesa, com a queda de uma prisão símbolo do absolutismo?', '[{"letra":"A","texto":"A Queda da Bastilha"},{"letra":"B","texto":"O Congresso de Viena"},{"letra":"C","texto":"A Noite de São Bartolomeu"},{"letra":"D","texto":"A Batalha de Waterloo"},{"letra":"E","texto":"A Comuna de Paris"},{"letra":"F","texto":"A Revolução de 1848"}]'::jsonb, 'A', 'Em 14 de julho de 1789 o povo de Paris tomou a Bastilha, prisão que simbolizava o poder arbitrário do rei. A data é feriado nacional na França. Waterloo (1815) encerra a era napoleônica; o Congresso de Viena (1814-15) reorganiza a Europa depois.', 'Encyclopaedia Britannica — French Revolution; Arquivo Nacional da França', 'qual evento de 1789 e considerado o marco inicial da revolucao francesa com a queda de uma prisao simbolo do absolutismo##a batalha de waterloo|a comuna de paris|a noite de sao bartolomeu|a queda da bastilha|a revolucao de 1848|o congresso de viena', 'aprovada', TRUE, 1),
  ('br-historia-moderna-02', 'historia', 'historia-moderna', 'intermediaria', 2, 'A Paz de Vestfália (1648), que encerrou a Guerra dos Trinta Anos, é apontada como marco porque:', '[{"letra":"A","texto":"Criou a Organização das Nações Unidas"},{"letra":"B","texto":"Consolidou a ideia de soberania dos Estados e a não interferência em assuntos internos alheios"},{"letra":"C","texto":"Unificou a Alemanha em um só império"},{"letra":"D","texto":"Proibiu guerras entre países cristãos para sempre"},{"letra":"E","texto":"Estabeleceu o fim da escravidão na Europa"},{"letra":"F","texto":"Dividiu a África entre potências europeias"}]'::jsonb, 'B', 'Vestfália reconheceu a soberania dos Estados e a igualdade formal entre eles, base do chamado sistema westfaliano das relações internacionais. A ONU é de 1945 e a partilha da África, da Conferência de Berlim (1884-85).', 'Encyclopaedia Britannica — Peace of Westphalia; ONU, coleção de tratados', 'a paz de vestfalia 1648 que encerrou a guerra dos trinta anos e apontada como marco porque##consolidou a ideia de soberania dos estados e a nao interferencia em assuntos internos alheios|criou a organizacao das nacoes unidas|dividiu a africa entre potencias europeias|estabeleceu o fim da escravidao na europa|proibiu guerras entre paises cristaos para sempre|unificou a alemanha em um so imperio', 'aprovada', TRUE, 1),
  ('br-historia-da-america-01', 'historia', 'historia-da-america', 'facil', 1, 'Qual foi o primeiro país da América Latina a conquistar a independência, em 1804, após uma revolução liderada por pessoas escravizadas?', '[{"letra":"A","texto":"Brasil"},{"letra":"B","texto":"México"},{"letra":"C","texto":"Haiti"},{"letra":"D","texto":"Chile"},{"letra":"E","texto":"Cuba"},{"letra":"F","texto":"Argentina"}]'::jsonb, 'C', 'A Revolução Haitiana (1791-1804) derrotou as forças coloniais francesas e criou a primeira república negra do mundo, com Toussaint Louverture e Jean-Jacques Dessalines entre os líderes. O Brasil declara independência em 1822 e o México em 1821.', 'Encyclopaedia Britannica — Haitian Revolution; UNESCO — Slave Route Project', 'qual foi o primeiro pais da america latina a conquistar a independencia em 1804 apos uma revolucao liderada por pessoas escravizadas##argentina|brasil|chile|cuba|haiti|mexico', 'aprovada', TRUE, 1),
  ('br-historia-da-america-02', 'historia', 'historia-da-america', 'intermediaria', 2, 'A Doutrina Monroe (1823), dos Estados Unidos, declarava que:', '[{"letra":"A","texto":"Os Estados Unidos colonizariam a África"},{"letra":"B","texto":"O Brasil seria anexado aos Estados Unidos"},{"letra":"C","texto":"As potências europeias não deveriam criar novas colônias nem intervir nas Américas"},{"letra":"D","texto":"O canal do Panamá seria construído pela França"},{"letra":"E","texto":"A América Latina deveria formar um bloco único"},{"letra":"F","texto":"A escravidão seria abolida em todo o continente"}]'::jsonb, 'C', 'O presidente James Monroe afirmou que o continente não seria mais objeto de colonização europeia, sintetizado na frase ''a América para os americanos''. Na prática, serviu de base para a influência norte-americana na região — e para o posterior corolário de Roosevelt, que reivindicava poder de polícia internacional.', 'US National Archives — Monroe Doctrine (1823); Office of the Historian, US State Dept.', 'a doutrina monroe 1823 dos estados unidos declarava que##a america latina deveria formar um bloco unico|a escravidao seria abolida em todo o continente|as potencias europeias nao deveriam criar novas colonias nem intervir nas americas|o brasil seria anexado aos estados unidos|o canal do panama seria construido pela franca|os estados unidos colonizariam a africa', 'aprovada', TRUE, 1),
  ('br-historia-da-africa-01', 'historia', 'historia-da-africa', 'intermediaria', 2, 'A Conferência de Berlim (1884-1885) é historicamente associada à:', '[{"letra":"A","texto":"Unificação do Egito com a Etiópia"},{"letra":"B","texto":"Independência das colônias africanas"},{"letra":"C","texto":"Fundação da Liga das Nações"},{"letra":"D","texto":"Partilha da África entre potências europeias, com regras para ocupação do território"},{"letra":"E","texto":"Abolição do tráfico atlântico"},{"letra":"F","texto":"Criação da União Africana"}]'::jsonb, 'D', 'Convocada por Bismarck, a conferência definiu critérios para o reconhecimento de ocupações europeias na África e acelerou a partilha do continente, sem nenhum representante africano à mesa. As fronteiras traçadas então ainda explicam muitos conflitos atuais. A União Africana é de 2002.', 'Encyclopaedia Britannica — Berlin West Africa Conference; UNESCO — General History of Africa', 'a conferencia de berlim 1884 1885 e historicamente associada a##abolicao do trafico atlantico|criacao da uniao africana|fundacao da liga das nacoes|independencia das colonias africanas|partilha da africa entre potencias europeias com regras para ocupacao do territorio|unificacao do egito com a etiopia', 'aprovada', TRUE, 1),
  ('br-historia-da-africa-02', 'historia', 'historia-da-africa', 'avancada', 4, 'Qual império africano, com centro em Timbuktu e Djenné, foi célebre na Idade Média por sua riqueza em ouro e por centros de estudo islâmicos como a mesquita de Sankoré?', '[{"letra":"A","texto":"Império Romano"},{"letra":"B","texto":"Império Otomano"},{"letra":"C","texto":"Império Gupta"},{"letra":"D","texto":"Império do Japão"},{"letra":"E","texto":"Império Asteca"},{"letra":"F","texto":"Império do Mali"}]'::jsonb, 'F', 'O Mali (séculos XIII-XVI) controlava rotas transaarianas de ouro e sal; Mansa Musa, em peregrinação a Meca em 1324, distribuiu tanto ouro que perturbou os preços no Cairo. Timbuktu tornou-se polo de saber com a Universidade de Sankoré. A UNESCO registra esses sítios como patrimônio mundial.', 'UNESCO World Heritage — Timbuktu; Encyclopaedia Britannica — Mali empire', 'qual imperio africano com centro em timbuktu e djenne foi celebre na idade media por sua riqueza em ouro e por centros de estudo islamicos como a mesquita de sankore##imperio asteca|imperio do japao|imperio do mali|imperio gupta|imperio otomano|imperio romano', 'aprovada', TRUE, 1),
  ('br-historia-da-asia-01', 'historia', 'historia-da-asia', 'intermediaria', 2, 'A dinastia Qin, no século III a.C., é lembrada na história da China sobretudo por:', '[{"letra":"A","texto":"Fundar Xangai como capital"},{"letra":"B","texto":"Unificar o território, padronizar pesos, medidas e escrita e iniciar a Grande Muralha em sua forma integrada"},{"letra":"C","texto":"Criar a primeira marinha a vapor"},{"letra":"D","texto":"Introduzir o budismo no país"},{"letra":"E","texto":"Abolir a escrita ideográfica"},{"letra":"F","texto":"Encerrar o comércio com a Europa"}]'::jsonb, 'B', 'Qin Shi Huang unificou os reinos em 221 a.C., padronizou moeda, pesos, medidas e caracteres, e conectou muralhas defensivas existentes na base do que se chamaria Grande Muralha. O budismo chega séculos depois, pela Rota da Seda, na dinastia Han.', 'Encyclopaedia Britannica — Qin dynasty; UNESCO World Heritage — The Great Wall', 'a dinastia qin no seculo iii a c e lembrada na historia da china sobretudo por##abolir a escrita ideografica|criar a primeira marinha a vapor|encerrar o comercio com a europa|fundar xangai como capital|introduzir o budismo no pais|unificar o territorio padronizar pesos medidas e escrita e iniciar a grande muralha em sua forma integrada', 'aprovada', TRUE, 1),
  ('br-historia-da-asia-02', 'historia', 'historia-da-asia', 'avancada', 4, 'A Primeira Guerra do Ópio (1839-1842) resultou, entre outras consequências, em:', '[{"letra":"A","texto":"Unificação da Coreia"},{"letra":"B","texto":"Expulsão definitiva dos britânicos da Ásia"},{"letra":"C","texto":"Criação da Organização Mundial do Comércio"},{"letra":"D","texto":"Independência da Índia"},{"letra":"E","texto":"Cessão de Hong Kong à Grã-Bretanha pelo Tratado de Nanquim e abertura de portos chineses ao comércio"},{"letra":"F","texto":"Fim do Império Chinês"}]'::jsonb, 'E', 'O Tratado de Nanquim (1842) encerrou a guerra com a cessão de Hong Kong e a abertura de cinco portos, além de indenização — início dos ''tratados desiguais''. O fim do império chinês vem só em 1912, com a queda da dinastia Qing.', 'Encyclopaedia Britannica — Opium Wars; National Archives (UK) — Treaty of Nanking', 'a primeira guerra do opio 1839 1842 resultou entre outras consequencias em##cessao de hong kong a gra bretanha pelo tratado de nanquim e abertura de portos chineses ao comercio|criacao da organizacao mundial do comercio|expulsao definitiva dos britanicos da asia|fim do imperio chines|independencia da india|unificacao da coreia', 'aprovada', TRUE, 1),
  ('br-guerras-e-revolucoes-01', 'historia', 'guerras-e-revolucoes', 'facil', 1, 'Em qual ano a Revolução Russa levou os bolcheviques ao poder, com a tomada do Palácio de Inverno?', '[{"letra":"A","texto":"1889"},{"letra":"B","texto":"1939"},{"letra":"C","texto":"1945"},{"letra":"D","texto":"1905"},{"letra":"E","texto":"1922"},{"letra":"F","texto":"1917"}]'::jsonb, 'F', 'Em outubro de 1917 (novembro no calendário gregoriano) os bolcheviques derrubaram o governo provisório e instalaram o poder soviético. 1905 foi um ensaio revolucionário que não tomou o poder; 1922 marca a criação da URSS.', 'Encyclopaedia Britannica — Russian Revolution of 1917', 'em qual ano a revolucao russa levou os bolcheviques ao poder com a tomada do palacio de inverno##1889|1905|1917|1922|1939|1945', 'aprovada', TRUE, 1),
  ('br-guerras-e-revolucoes-02', 'historia', 'guerras-e-revolucoes', 'intermediaria', 2, 'O Tratado de Versalhes (1919), que encerrou formalmente a Primeira Guerra Mundial com a Alemanha, impôs:', '[{"letra":"A","texto":"Indenizações pesadas, limites ao exército alemão e perda de territórios"},{"letra":"B","texto":"A criação do Pacto de Varsóvia"},{"letra":"C","texto":"A divisão da Alemanha em dois países"},{"letra":"D","texto":"O fim do Império Britânico"},{"letra":"E","texto":"A devolução de todas as colônias à Alemanha"},{"letra":"F","texto":"A unificação da Europa em um parlamento comum"}]'::jsonb, 'A', 'O tratado impôs reparações, desmilitarização e perdas territoriais, e a cláusula de culpa pela guerra — o que alimentou o revanchismo alemão explorado depois pelo nazismo. A divisão da Alemanha ocorre em 1949, e o Pacto de Varsóvia é de 1955.', 'US National Archives — Treaty of Versailles (1919); Encyclopaedia Britannica', 'o tratado de versalhes 1919 que encerrou formalmente a primeira guerra mundial com a alemanha impos##a criacao do pacto de varsovia|a devolucao de todas as colonias a alemanha|a divisao da alemanha em dois paises|a unificacao da europa em um parlamento comum|indenizacoes pesadas limites ao exercito alemao e perda de territorios|o fim do imperio britanico', 'aprovada', TRUE, 1),
  ('br-personalidades-historicas-01', 'historia', 'personalidades-historicas', 'facil', 1, 'Quem foi o líder sul-africano que passou 27 anos preso e depois se tornou o primeiro presidente negro do país, em 1994?', '[{"letra":"A","texto":"Nelson Mandela"},{"letra":"B","texto":"Kofi Annan"},{"letra":"C","texto":"Desmond Tutu"},{"letra":"D","texto":"Julius Nyerere"},{"letra":"E","texto":"Kwame Nkrumah"},{"letra":"F","texto":"Patrice Lumumba"}]'::jsonb, 'A', 'Mandela lutou contra o apartheid na África do Sul, foi preso em 1962 e libertado em 1990; recebeu o Nobel da Paz em 1993 ao lado de Frederik de Klerk e governou de 1994 a 1999. Tutu foi arcebispo e Nobel da Paz de 1984; Nkrumah liderou Gana.', 'Nobel Prize — Nelson Mandela, biografia oficial; ONU — Mandela Rules', 'quem foi o lider sul africano que passou 27 anos preso e depois se tornou o primeiro presidente negro do pais em 1994##desmond tutu|julius nyerere|kofi annan|kwame nkrumah|nelson mandela|patrice lumumba', 'aprovada', TRUE, 1),
  ('br-personalidades-historicas-02', 'historia', 'personalidades-historicas', 'intermediaria', 2, 'Quem é reconhecida por descrever, ainda no século XIX, um algoritmo para ser executado por uma máquina analítica — trabalho que a tornou referência como pioneira da programação?', '[{"letra":"A","texto":"Grace Hopper"},{"letra":"B","texto":"Rosalind Franklin"},{"letra":"C","texto":"Emmy Noether"},{"letra":"D","texto":"Ada Lovelace"},{"letra":"E","texto":"Marie Curie"},{"letra":"F","texto":"Hedy Lamarr"}]'::jsonb, 'D', 'Nas notas sobre a máquina analítica de Charles Babbage (1843), Ada Lovelace descreveu um método passo a passo para calcular números de Bernoulli — considerado o primeiro programa publicado — e percebeu que a máquina poderia manipular símbolos, não só números. Hopper criou o primeiro compilador, já no século XX.', 'Ada Lovelace — Notes on the Analytical Engine (1843); Oxford Dictionary of National Biography', 'quem e reconhecida por descrever ainda no seculo xix um algoritmo para ser executado por uma maquina analitica trabalho que a tornou referencia como pioneira da programacao##ada lovelace|emmy noether|grace hopper|hedy lamarr|marie curie|rosalind franklin', 'aprovada', TRUE, 1),
  ('br-geografia-humana-01', 'geografia', 'geografia-humana', 'facil', 1, 'A densidade demográfica de uma região é calculada pela razão entre:', '[{"letra":"A","texto":"População urbana e população rural"},{"letra":"B","texto":"Área cultivada e área total"},{"letra":"C","texto":"Número de cidades e número de habitantes"},{"letra":"D","texto":"População total e área territorial"},{"letra":"E","texto":"Natalidade e mortalidade"},{"letra":"F","texto":"Renda total e número de famílias"}]'::jsonb, 'D', 'Densidade demográfica (ou populacional) é habitantes por quilômetro quadrado. É diferente de taxa de urbanização (população urbana sobre o total) e de crescimento vegetativo (natalidade menos mortalidade).', 'IBGE — Conceitos e definições de indicadores demográficos', 'a densidade demografica de uma regiao e calculada pela razao entre##area cultivada e area total|natalidade e mortalidade|numero de cidades e numero de habitantes|populacao total e area territorial|populacao urbana e populacao rural|renda total e numero de familias', 'aprovada', TRUE, 1),
  ('br-geografia-humana-02', 'geografia', 'geografia-humana', 'intermediaria', 2, 'O processo de ''conurbação'' ocorre quando:', '[{"letra":"A","texto":"Uma metrópole cria um novo distrito industrial"},{"letra":"B","texto":"Um bairro é oficialmente anexado a outro"},{"letra":"C","texto":"Uma capital é transferida para o interior"},{"letra":"D","texto":"A população de uma cidade dobra em dez anos"},{"letra":"E","texto":"Uma cidade perde população para o campo"},{"letra":"F","texto":"Duas ou mais cidades crescem e passam a formar um tecido urbano contínuo"}]'::jsonb, 'F', 'Conurbação é a união física do tecido urbano de municípios vizinhos, típica das regiões metropolitanas: a mancha urbana ultrapassa os limites administrativos. É diferente de metropolização, que trata da concentração de poder econômico e político na metrópole.', 'IBGE — Regiões de Influência das Cidades; Observatório das Metrópoles', 'o processo de conurbacao ocorre quando##a populacao de uma cidade dobra em dez anos|duas ou mais cidades crescem e passam a formar um tecido urbano continuo|um bairro e oficialmente anexado a outro|uma capital e transferida para o interior|uma cidade perde populacao para o campo|uma metropole cria um novo distrito industrial', 'aprovada', TRUE, 1),
  ('br-oceanografia-01', 'geografia', 'oceanografia', 'facil', 1, 'Qual é o maior e mais profundo oceano do planeta?', '[{"letra":"A","texto":"Índico"},{"letra":"B","texto":"Mar Cáspio"},{"letra":"C","texto":"Atlântico"},{"letra":"D","texto":"Antártico"},{"letra":"E","texto":"Ártico"},{"letra":"F","texto":"Pacífico"}]'::jsonb, 'F', 'O Pacífico cobre cerca de um terço da superfície terrestre e abriga a Fossa das Marianas, com quase 11 mil metros de profundidade. O Atlântico é o segundo em área; o Ártico é o menor e mais raso.', 'NOAA — Ocean facts; IHO — Limits of Oceans and Seas', 'qual e o maior e mais profundo oceano do planeta##antartico|artico|atlantico|indico|mar caspio|pacifico', 'aprovada', TRUE, 1),
  ('br-oceanografia-02', 'geografia', 'oceanografia', 'intermediaria', 2, 'O fenômeno El Niño, que altera chuvas e temperaturas em várias regiões do mundo, corresponde a:', '[{"letra":"A","texto":"Aquecimento anômalo das águas superficiais do Pacífico equatorial"},{"letra":"B","texto":"Elevação do nível médio dos oceanos por marés"},{"letra":"C","texto":"Aumento da salinidade do Índico"},{"letra":"D","texto":"Derretimento sazonal do Ártico"},{"letra":"E","texto":"Resfriamento das águas do Atlântico Norte"},{"letra":"F","texto":"Mudança na rotação da Terra"}]'::jsonb, 'A', 'El Niño é a fase quente do ENOS: as águas superficiais do Pacífico equatorial ficam mais quentes que o normal, alterando a circulação atmosférica e provocando secas e chuvas extremas em pontos distantes. A fase fria se chama La Niña; o ENOS não é o mesmo que o degelo do Ártico.', 'NOAA Climate.gov — El Niño & La Niña (ENSO) explainer', 'o fenomeno el nino que altera chuvas e temperaturas em varias regioes do mundo corresponde a##aquecimento anomalo das aguas superficiais do pacifico equatorial|aumento da salinidade do indico|derretimento sazonal do artico|elevacao do nivel medio dos oceanos por mares|mudanca na rotacao da terra|resfriamento das aguas do atlantico norte', 'aprovada', TRUE, 1),
  ('br-geografia-economica-01', 'geografia', 'geografia-economica', 'intermediaria', 2, 'O Mercosul é um exemplo de:', '[{"letra":"A","texto":"Bloco econômico com tarifa externa comum entre países da América do Sul"},{"letra":"B","texto":"Organização de defesa do Atlântico Sul"},{"letra":"C","texto":"Tratado de livre comércio apenas entre Brasil e Estados Unidos"},{"letra":"D","texto":"Aliança militar entre países americanos"},{"letra":"E","texto":"Agência da ONU para o meio ambiente"},{"letra":"F","texto":"União aduaneira entre países africanos"}]'::jsonb, 'A', 'O Mercado Comum do Sul (1991, Tratado de Assunção) reúne Brasil, Argentina, Uruguai e Paraguai — com Venezuela suspensa — e busca livre circulação de bens e uma tarifa externa comum. A defesa militar é papel de outras organizações, como a OTAN, que não inclui esses países.', 'Mercosul — site oficial, Tratado de Assunção (1991)', 'o mercosul e um exemplo de##agencia da onu para o meio ambiente|alianca militar entre paises americanos|bloco economico com tarifa externa comum entre paises da america do sul|organizacao de defesa do atlantico sul|tratado de livre comercio apenas entre brasil e estados unidos|uniao aduaneira entre paises africanos', 'aprovada', TRUE, 1),
  ('br-geografia-economica-02', 'geografia', 'geografia-economica', 'avancada', 4, 'Na geografia econômica, diz-se que um país sofre de ''doença holandesa'' quando:', '[{"letra":"A","texto":"O desemprego aumenta por causa da automação"},{"letra":"B","texto":"O país importa mais do que exporta em todos os setores"},{"letra":"C","texto":"A indústria cresce mais rápido que a agricultura"},{"letra":"D","texto":"A exportação de um recurso natural valorizado aprecia a moeda e prejudica os demais setores industriais"},{"letra":"E","texto":"O turismo substitui a indústria nacional"},{"letra":"F","texto":"A dívida externa é paga antes do prazo"}]'::jsonb, 'D', 'O nome vem do gás natural descoberto na Holanda nos anos 1960: a entrada de divisas valoriza a moeda local, encarece as exportações de outros setores e desindustrializa a economia. É o risco de economias muito dependentes de commodities, como o petróleo.', 'The Economist — The Dutch disease (1977); Banco Mundial, relatórios sobre recursos naturais', 'na geografia economica diz se que um pais sofre de doenca holandesa quando##a divida externa e paga antes do prazo|a exportacao de um recurso natural valorizado aprecia a moeda e prejudica os demais setores industriais|a industria cresce mais rapido que a agricultura|o desemprego aumenta por causa da automacao|o pais importa mais do que exporta em todos os setores|o turismo substitui a industria nacional', 'aprovada', TRUE, 1),
  ('br-teatro-01', 'artes', 'teatro', 'facil', 1, 'Qual dramaturgo inglês escreveu ''Romeu e Julieta'' e ''Hamlet'', encenadas no teatro Globe?', '[{"letra":"A","texto":"Molière"},{"letra":"B","texto":"Anton Tchekhov"},{"letra":"C","texto":"William Shakespeare"},{"letra":"D","texto":"Bertolt Brecht"},{"letra":"E","texto":"Sófocles"},{"letra":"F","texto":"Henrik Ibsen"}]'::jsonb, 'C', 'Shakespeare (1564-1616) foi ator e autor ligado ao Globe, em Londres, e escreveu tragédias, comédias e sonetos que se tornaram referência do teatro ocidental. Molière é francês, Ibsen norueguês e Tchekhov russo.', 'Encyclopaedia Britannica — William Shakespeare; Shakespeare Birthplace Trust', 'qual dramaturgo ingles escreveu romeu e julieta e hamlet encenadas no teatro globe##anton tchekhov|bertolt brecht|henrik ibsen|moliere|sofocles|william shakespeare', 'aprovada', TRUE, 1),
  ('br-teatro-02', 'artes', 'teatro', 'intermediaria', 2, 'O ''Teatro do Oprimido'', método em que o público é convidado a intervir e substituir os atores na cena, foi criado pelo brasileiro:', '[{"letra":"A","texto":"Chico Buarque"},{"letra":"B","texto":"Augusto Boal"},{"letra":"C","texto":"Gianfrancesco Guarnieri"},{"letra":"D","texto":"Nelson Rodrigues"},{"letra":"E","texto":"Ariano Suassuna"},{"letra":"F","texto":"Dias Gomes"}]'::jsonb, 'B', 'Boal desenvolveu a proposta nos anos 1960-70, com o ''Teatro-Fórum'' em que o espectador se torna ''espect-ator'' e ensaia mudanças de desfecho para situações de opressão. Foi indicado ao Nobel da Paz em 2008 e seu método é usado hoje em mais de 70 países.', 'Augusto Boal — Teatro do Oprimido e outras poéticas políticas (1975); UNESCO', 'o teatro do oprimido metodo em que o publico e convidado a intervir e substituir os atores na cena foi criado pelo brasileiro##ariano suassuna|augusto boal|chico buarque|dias gomes|gianfrancesco guarnieri|nelson rodrigues', 'aprovada', TRUE, 1),
  ('br-artes-visuais-01', 'artes', 'artes-visuais', 'facil', 1, 'Quem pintou a ''Mona Lisa'', hoje exposta no Museu do Louvre, em Paris?', '[{"letra":"A","texto":"Rafael"},{"letra":"B","texto":"Michelangelo"},{"letra":"C","texto":"Pablo Picasso"},{"letra":"D","texto":"Leonardo da Vinci"},{"letra":"E","texto":"Vincent van Gogh"},{"letra":"F","texto":"Claude Monet"}]'::jsonb, 'D', 'Leonardo pintou a obra no início do século XVI; a técnica do sfumato, com transições suaves de luz e sombra, é uma de suas marcas. Michelangelo esculpiu o Davi e pintou o teto da Capela Sistina; Van Gogh e Monet são séculos posteriores.', 'Musée du Louvre — coleção, Mona Lisa; Encyclopaedia Britannica', 'quem pintou a mona lisa hoje exposta no museu do louvre em paris##claude monet|leonardo da vinci|michelangelo|pablo picasso|rafael|vincent van gogh', 'aprovada', TRUE, 1),
  ('br-artes-visuais-02', 'artes', 'artes-visuais', 'intermediaria', 2, 'Qual movimento artístico do século XIX ficou marcado por pintar ao ar livre e captar variações de luz, tendo em Monet um de seus principais nomes?', '[{"letra":"A","texto":"Impressionismo"},{"letra":"B","texto":"Surrealismo"},{"letra":"C","texto":"Arte gótica"},{"letra":"D","texto":"Cubismo"},{"letra":"E","texto":"Expressionismo abstrato"},{"letra":"F","texto":"Barroco"}]'::jsonb, 'A', 'O nome nasceu de uma crítica irônica à tela ''Impressão, nascer do sol'', de Monet (1874). Os artistas saíam do ateliê, usavam pinceladas visíveis e tubos de tinta portáteis para registrar a luz em mudança. Cubismo e surrealismo são do século XX; o barroco, do XVII.', 'Musée d''Orsay — Impressionism; Encyclopaedia Britannica', 'qual movimento artistico do seculo xix ficou marcado por pintar ao ar livre e captar variacoes de luz tendo em monet um de seus principais nomes##arte gotica|barroco|cubismo|expressionismo abstrato|impressionismo|surrealismo', 'aprovada', TRUE, 1),
  ('br-arquitetura-01', 'artes', 'arquitetura', 'facil', 1, 'Qual arquiteto brasileiro, autor de obras como o Congresso Nacional e a Catedral de Brasília, é referência mundial pelas curvas de concreto armado?', '[{"letra":"A","texto":"Antoni Gaudí"},{"letra":"B","texto":"Paulo Mendes da Rocha"},{"letra":"C","texto":"Frank Lloyd Wright"},{"letra":"D","texto":"Lúcio Costa"},{"letra":"E","texto":"Oscar Niemeyer"},{"letra":"F","texto":"Le Corbusier"}]'::jsonb, 'E', 'Niemeyer projetou os principais edifícios de Brasília (1960), com Lúcio Costa responsável pelo plano urbanístico, e teve obra reconhecida com o Pritzker em 1988. Le Corbusier foi seu mestre e colaborador no Ministério da Educação, no Rio.', 'Pritzker Architecture Prize — Oscar Niemeyer (1988); UNESCO — Brasília, patrimônio mundial', 'qual arquiteto brasileiro autor de obras como o congresso nacional e a catedral de brasilia e referencia mundial pelas curvas de concreto armado##antoni gaudi|frank lloyd wright|le corbusier|lucio costa|oscar niemeyer|paulo mendes da rocha', 'aprovada', TRUE, 1),
  ('br-arquitetura-02', 'artes', 'arquitetura', 'intermediaria', 2, 'Qual elemento estrutural é característico da arquitetura gótica, permitindo paredes mais altas e janelas maiores?', '[{"letra":"A","texto":"Cúpula de concreto armado"},{"letra":"B","texto":"Parede de vidro e aço"},{"letra":"C","texto":"Arco de volta perfeita e alvenaria maciça"},{"letra":"D","texto":"Arco ogival combinado com arcobotantes"},{"letra":"E","texto":"Estrutura metálica aparente"},{"letra":"F","texto":"Coluna dórica sem base"}]'::jsonb, 'D', 'O arco ogival direciona melhor as cargas e os arcobotantes transferem o empuxo para fora, liberando a parede para os vitrais — daí a verticalidade e a luz das catedrais góticas como Chartres e Notre-Dame. O arco de volta perfeita e a alvenaria maciça caracterizam o românico.', 'Encyclopaedia Britannica — Gothic architecture; UNESCO — Chartres Cathedral', 'qual elemento estrutural e caracteristico da arquitetura gotica permitindo paredes mais altas e janelas maiores##arco de volta perfeita e alvenaria macica|arco ogival combinado com arcobotantes|coluna dorica sem base|cupula de concreto armado|estrutura metalica aparente|parede de vidro e aco', 'aprovada', TRUE, 1),
  ('br-historia-da-arte-01', 'artes', 'historia-da-arte', 'intermediaria', 2, 'Qual inovação técnica é considerada marca do Renascimento na pintura ocidental?', '[{"letra":"A","texto":"A pintura sem qualquer figuração humana"},{"letra":"B","texto":"O abandono da representação do corpo"},{"letra":"C","texto":"A perspectiva linear, com ponto de fuga que organiza a profundidade"},{"letra":"D","texto":"O uso de colagem e fotomontagem"},{"letra":"E","texto":"O uso exclusivo de têmpera sobre madeira"},{"letra":"F","texto":"A recusa de temas religiosos"}]'::jsonb, 'C', 'A perspectiva linear foi sistematizada por Brunelleschi e teorizada por Alberti, criando a ilusão de espaço tridimensional num plano. Colagem e fotomontagem só surgem no século XX, com as vanguardas.', 'Encyclopaedia Britannica — Renaissance art; The Met — Heilbrunn Timeline of Art History', 'qual inovacao tecnica e considerada marca do renascimento na pintura ocidental##a perspectiva linear com ponto de fuga que organiza a profundidade|a pintura sem qualquer figuracao humana|a recusa de temas religiosos|o abandono da representacao do corpo|o uso de colagem e fotomontagem|o uso exclusivo de tempera sobre madeira', 'aprovada', TRUE, 1),
  ('br-historia-da-arte-02', 'artes', 'historia-da-arte', 'avancada', 4, 'Ao expor um urinol industrial assinado como ''A Fonte'' (1917), Marcel Duchamp propôs o conceito de:', '[{"letra":"A","texto":"Pintura abstrata geométrica"},{"letra":"B","texto":"Arte sacra barroca"},{"letra":"C","texto":"Arte digital interativa"},{"letra":"D","texto":"Ready-made: um objeto comum deslocado para o espaço da arte, desafiando a ideia de obra original"},{"letra":"E","texto":"Fotografia documental"},{"letra":"F","texto":"Escultura em mármore de precisão"}]'::jsonb, 'D', 'Duchamp escolheu um objeto manufaturado e o apresentou como arte, deslocando a pergunta de ''como foi feito'' para ''o que faz algo ser arte''. A peça original se perdeu, mas as réplicas estão em museus como o Tate e o Centre Pompidou — e a provocação segue central na arte contemporânea.', 'Tate — Marcel Duchamp, Fountain (1917); The Met — Heilbrunn Timeline', 'ao expor um urinol industrial assinado como a fonte 1917 marcel duchamp propos o conceito de##arte digital interativa|arte sacra barroca|escultura em marmore de precisao|fotografia documental|pintura abstrata geometrica|ready made um objeto comum deslocado para o espaco da arte desafiando a ideia de obra original', 'aprovada', TRUE, 1),
  ('br-administracao-01', 'outras', 'administracao', 'facil', 1, 'A administração científica, baseada na divisão de tarefas e no estudo dos tempos e movimentos, foi proposta por:', '[{"letra":"A","texto":"Peter Drucker"},{"letra":"B","texto":"Frederick Taylor"},{"letra":"C","texto":"Abraham Maslow"},{"letra":"D","texto":"Henri Fayol"},{"letra":"E","texto":"Elton Mayo"},{"letra":"F","texto":"Max Weber"}]'::jsonb, 'B', 'Taylor publicou ''Princípios da Administração Científica'' em 1911, buscando eficiência pela padronização e pela separação entre planejamento e execução. Fayol descreveu funções do administrador (planejar, organizar, dirigir, coordenar, controlar) e Mayo conduziu os experimentos de Hawthorne, que fundaram a escola de relações humanas.', 'Taylor — The Principles of Scientific Management (1911); Encyclopaedia Britannica', 'a administracao cientifica baseada na divisao de tarefas e no estudo dos tempos e movimentos foi proposta por##abraham maslow|elton mayo|frederick taylor|henri fayol|max weber|peter drucker', 'aprovada', TRUE, 1),
  ('br-administracao-02', 'outras', 'administracao', 'intermediaria', 2, 'Na análise SWOT, as ''ameaças'' correspondem a:', '[{"letra":"A","texto":"Vantagens competitivas já consolidadas"},{"letra":"B","texto":"Objetivos de longo prazo da empresa"},{"letra":"C","texto":"Fatores internos que a organização controla e podem ser melhorados"},{"letra":"D","texto":"Indicadores financeiros do período"},{"letra":"E","texto":"Fatores externos que podem prejudicar a organização"},{"letra":"F","texto":"Competências dos funcionários"}]'::jsonb, 'E', 'A matriz separa o ambiente interno (forças e fraquezas) do externo (oportunidades e ameaças). Ameaças vêm de fora e não são controláveis — concorrência, câmbio, regulação —, enquanto fraquezas são internas e corrigíveis.', 'Harvard Business Review — SWOT analysis; Kotler & Keller, Administração de Marketing', 'na analise swot as ameacas correspondem a##competencias dos funcionarios|fatores externos que podem prejudicar a organizacao|fatores internos que a organizacao controla e podem ser melhorados|indicadores financeiros do periodo|objetivos de longo prazo da empresa|vantagens competitivas ja consolidadas', 'aprovada', TRUE, 1),
  ('br-contabilidade-01', 'outras', 'contabilidade', 'facil', 1, 'Na contabilidade, qual é a equação fundamental do balanço patrimonial?', '[{"letra":"A","texto":"Ativo = Passivo − Patrimônio Líquido"},{"letra":"B","texto":"Passivo = Ativo + Patrimônio Líquido"},{"letra":"C","texto":"Receita = Despesa + Lucro"},{"letra":"D","texto":"Ativo = Receita − Despesa"},{"letra":"E","texto":"Ativo + Passivo = Patrimônio Líquido"},{"letra":"F","texto":"Ativo = Passivo + Patrimônio Líquido"}]'::jsonb, 'F', 'O total de bens e direitos (ativo) é financiado por capital de terceiros (passivo exigível) e por capital próprio (patrimônio líquido). Por isso o balanço sempre ''fecha'': Ativo = Passivo + PL. A outra relação citada é a apuração do resultado, não a equação patrimonial.', 'Comitê de Pronunciamentos Contábeis — CPC 00 (R2), Estrutura Conceitual', 'na contabilidade qual e a equacao fundamental do balanco patrimonial##ativo passivo patrimonio liquido|ativo passivo patrimonio liquido|ativo passivo patrimonio liquido|ativo receita despesa|passivo ativo patrimonio liquido|receita despesa lucro', 'aprovada', TRUE, 1),
  ('br-contabilidade-02', 'outras', 'contabilidade', 'intermediaria', 2, 'O ''regime de competência'' na contabilidade determina que as receitas e despesas:', '[{"letra":"A","texto":"Sigam o calendário fiscal do governo"},{"letra":"B","texto":"Sejam sempre lançadas no encerramento do exercício"},{"letra":"C","texto":"Sejam reconhecidas apenas quando há lucro"},{"letra":"D","texto":"Sejam reconhecidas no período em que ocorrem, independentemente de terem sido pagas ou recebidas"},{"letra":"E","texto":"Dependam exclusivamente da decisão da administração"},{"letra":"F","texto":"Sejam registradas apenas quando o dinheiro entra ou sai do caixa"}]'::jsonb, 'D', 'Pelo regime de competência, o fato gerador manda: vendeu em dezembro com recebimento em janeiro, a receita é de dezembro. O oposto é o regime de caixa, em que o registro segue a movimentação financeira — usado em controles gerenciais, mas não nas demonstrações contábeis.', 'CPC 00 (R2) — Regime de competência; Lei 6.404/1976, art. 177', 'o regime de competencia na contabilidade determina que as receitas e despesas##dependam exclusivamente da decisao da administracao|sejam reconhecidas apenas quando ha lucro|sejam reconhecidas no periodo em que ocorrem independentemente de terem sido pagas ou recebidas|sejam registradas apenas quando o dinheiro entra ou sai do caixa|sejam sempre lancadas no encerramento do exercicio|sigam o calendario fiscal do governo', 'aprovada', TRUE, 1),
  ('br-astronautica-01', 'outras', 'astronautica', 'facil', 1, 'Quem foi o primeiro ser humano a viajar ao espaço, em 1961?', '[{"letra":"A","texto":"John Glenn"},{"letra":"B","texto":"Valentina Tereshkova"},{"letra":"C","texto":"Neil Armstrong"},{"letra":"D","texto":"Yuri Gagarin"},{"letra":"E","texto":"Alan Shepard"},{"letra":"F","texto":"Buzz Aldrin"}]'::jsonb, 'D', 'O soviético Yuri Gagarin orbitou a Terra a bordo da Vostok 1 em 12 de abril de 1961, em um voo de cerca de 108 minutos. Armstrong pisou na Lua em 1969; Tereshkova foi a primeira mulher no espaço, em 1963.', 'NASA — Yuri Gagarin, first human in space; ONU — Dia Internacional do Voo Espacial Humano', 'quem foi o primeiro ser humano a viajar ao espaco em 1961##alan shepard|buzz aldrin|john glenn|neil armstrong|valentina tereshkova|yuri gagarin', 'aprovada', TRUE, 1),
  ('br-astronautica-02', 'outras', 'astronautica', 'intermediaria', 2, 'Por que um foguete precisa ser lançado na direção leste, próximo ao equador?', '[{"letra":"A","texto":"Para não colidir com satélites polares"},{"letra":"B","texto":"Porque o polo magnético atrai o foguete"},{"letra":"C","texto":"Porque o combustível só funciona em baixa latitude"},{"letra":"D","texto":"Para evitar a atmosfera por completo"},{"letra":"E","texto":"Para escapar da gravidade lunar"},{"letra":"F","texto":"Para aproveitar a velocidade de rotação da Terra, que é maior no equador"}]'::jsonb, 'F', 'A Terra gira para leste, e a velocidade tangencial é máxima no equador (cerca de 1.670 km/h). Lançar nessa direção e o mais perto possível da linha do equador soma essa velocidade à do foguete, economizando combustível — por isso existem bases como a de Kourou, na Guiana Francesa.', 'NASA — Basics of space flight, launch sites and Earth''s rotation; ESA — Kourou', 'por que um foguete precisa ser lancado na direcao leste proximo ao equador##para aproveitar a velocidade de rotacao da terra que e maior no equador|para escapar da gravidade lunar|para evitar a atmosfera por completo|para nao colidir com satelites polares|porque o combustivel so funciona em baixa latitude|porque o polo magnetico atrai o foguete', 'aprovada', TRUE, 1),
  ('br-religioes-01', 'outras', 'religioes', 'intermediaria', 2, 'Os Vedas, conjunto de textos mais antigos do hinduísmo, foram compostos originalmente em qual língua?', '[{"letra":"A","texto":"Sânscrito"},{"letra":"B","texto":"Pali"},{"letra":"C","texto":"Árabe"},{"letra":"D","texto":"Grego antigo"},{"letra":"E","texto":"Latim"},{"letra":"F","texto":"Hebraico"}]'::jsonb, 'A', 'Os Vedas foram transmitidos oralmente em sânscrito védico antes de serem escritos, com destaque para o Rigveda. Pali é a língua de textos budistas Theravada; o hebraico e o grego antigo pertencem a outras tradições.', 'UNESCO — Vedic chanting, patrimônio oral da humanidade; Encyclopaedia Britannica', 'os vedas conjunto de textos mais antigos do hinduismo foram compostos originalmente em qual lingua##arabe|grego antigo|hebraico|latim|pali|sanscrito', 'aprovada', TRUE, 1),
  ('br-religioes-02', 'outras', 'religioes', 'avancada', 4, 'O Concílio de Niceia, convocado em 325, teve como resultado mais conhecido:', '[{"letra":"A","texto":"A separação entre Igreja Católica e Ortodoxa"},{"letra":"B","texto":"O fim do celibato clerical"},{"letra":"C","texto":"A criação da Inquisição"},{"letra":"D","texto":"A tradução da Bíblia para o latim"},{"letra":"E","texto":"A formulação do Credo Niceno, afirmando a consubstancialidade do Filho com o Pai"},{"letra":"F","texto":"A convocação da Primeira Cruzada"}]'::jsonb, 'E', 'Convocado pelo imperador Constantino, o concílio enfrentou a controvérsia ariana e produziu o Credo Niceno, base das profissões de fé cristãs. O cisma entre Roma e Constantinopla ocorre em 1054, a Vulgata de Jerônimo é do fim do século IV e as cruzadas começam em 1096.', 'Encyclopaedia Britannica — First Council of Nicaea (325); Creeds of Christendom', 'o concilio de niceia convocado em 325 teve como resultado mais conhecido##a convocacao da primeira cruzada|a criacao da inquisicao|a formulacao do credo niceno afirmando a consubstancialidade do filho com o pai|a separacao entre igreja catolica e ortodoxa|a traducao da biblia para o latim|o fim do celibato clerical', 'aprovada', TRUE, 1)
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
