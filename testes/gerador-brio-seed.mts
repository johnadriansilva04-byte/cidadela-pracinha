/**
 * Gera supabase/migrations/guerra_de_brio.sql a partir do acervo curado.
 *
 * Uso: JITI_TSCONFIG_PATHS=true ./node_modules/.bin/jiti testes/gerador-brio-seed.mts
 *
 * IMPORTANTE: o gerador REGRAVA a migration inteira. Se rodar, confira o diff
 * antes de commitar (o cabeçalho das RPCs é preservado como template abaixo).
 */
import { writeFileSync } from "node:fs";
import { ACERVO_BRIO_EQUILIBRADO } from "../src/lib/brio/acervo";
import { AREAS } from "../src/lib/brio/categorias";
import { assinaturaPergunta } from "../src/lib/brio/selecao";
import { B_INICIAL } from "../src/lib/brio/tri";

const esc = (s: string) => s.replace(/'/g, "''");

function sqlPergunta(p: (typeof ACERVO_BRIO_EQUILIBRADO)[number]): string {
  const alts = JSON.stringify(p.alternativas);
  const assinatura = assinaturaPergunta(p.enunciado, p.alternativas);
  return `  ('${esc(p.id)}', '${esc(p.areaSlug)}', '${esc(p.subcategoriaSlug)}', '${esc(p.dificuldade)}', ${p.ordem}, '${esc(p.enunciado)}', '${esc(alts)}'::jsonb, '${p.letraCorreta}', '${esc(p.explicacao)}', ${p.referencia ? `'${esc(p.referencia)}'` : "NULL"}, '${esc(assinatura)}', 'aprovada', TRUE, 1, ${B_INICIAL[p.dificuldade]})`;
}

const categoriasSql = AREAS.map(
  (a) => `  ('${esc(a.slug)}', NULL, '${esc(a.nome)}', '${a.icone}'),\n` +
    a.subcategorias.map((s) => `  ('${esc(s.slug)}', '${esc(a.slug)}', '${esc(s.nome)}', NULL)`).join(",\n"),
).join(",\n");

const sql = `-- ============================================================
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
  -- Motivo de suspeita (NULL = ok). Item suspeito SAI da seleção.
  tri_suspeita TEXT,
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

-- O CREATE TABLE IF NOT EXISTS não adiciona coluna em banco já existente.
ALTER TABLE public.brio_questions ADD COLUMN IF NOT EXISTS tri_suspeita TEXT;

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
      -- Item com comportamento suspeito não entra na avaliação (§5.4). Se a
      -- categoria inteira estiver marcada, o fallback abaixo evita jogo vazio.
      AND q.tri_suspeita IS NULL
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

-- ---------- 15b. Dificuldade declarada → b inicial (espelha tri.ts) ----------
-- O "b" inicial NÃO é 0 para todo mundo: a dificuldade declarada é a
-- estimativa provisória de onde fica o ponto de 50% de acerto. Sem isto o
-- importador em lote gravava b=0 em tudo e a TRI tratava uma questão fácil e
-- uma de especialista como idênticas.
CREATE OR REPLACE FUNCTION public.brio_b_inicial(p_dificuldade TEXT)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_dificuldade
    WHEN 'facil' THEN -1.5
    WHEN 'intermediaria' THEN -0.7
    WHEN 'dificil' THEN 0.0
    WHEN 'avancada' THEN 0.8
    WHEN 'especialista' THEN 1.7
    ELSE 0.0
  END;
$$;

REVOKE ALL ON FUNCTION public.brio_b_inicial(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.brio_b_inicial(TEXT) TO service_role;

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
      -- Sem tri_b no payload, deriva da dificuldade declarada (não 0.0).
      COALESCE((v_item->>'tri_b')::NUMERIC,
               public.brio_b_inicial(COALESCE(v_item->>'dificuldade', 'dificil'))),
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

-- ---------- 17b. RPC: CALIBRAR os itens com as respostas reais (§5.4) ----------
-- Esta é a peça que faltava: a tabela brio_calibracao existia mas NINGUÉM
-- escrevia nela, e brio_questions.tri_* nunca era atualizado — os parâmetros
-- ficavam provisórios para sempre. Aqui o acervo aprende com o comportamento
-- real: recalcula discriminação (ponto-bisserial) e dificuldade (inverso da
-- 3PL), com SHRINKAGE para o valor provisório, e marca suspeitos.
--
-- Rodar como service_role (job administrativo), nunca pelo cliente:
--   SELECT public.brio_calibrar();
CREATE OR REPLACE FUNCTION public.brio_calibrar(p_minimo INTEGER DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
  v_n INTEGER;
  v_prop NUMERIC;
  v_media NUMERIC;
  v_var NUMERIC;
  v_disc NUMERIC;
  v_peso NUMERIC;
  v_a NUMERIC;
  v_q NUMERIC;
  v_b NUMERIC;
  v_provisorio BOOLEAN;
  v_suspeita TEXT;
  v_itens INTEGER := 0;
  v_calibrados INTEGER := 0;
  v_suspeitos INTEGER := 0;
  -- Shrinkage: peso da amostra real na estimativa.
  k_shrink CONSTANT NUMERIC := 30;
  k_minimo CONSTANT INTEGER := GREATEST(5, COALESCE(p_minimo, 30));
BEGIN
  -- 1. Agrega as respostas HUMANAS por item. O adversário virtual não tem
  --    linha em brio_habilidade, então o JOIN o exclui: ele não é respondente
  --    real e não pode contaminar a calibração.
  DROP TABLE IF EXISTS _brio_cal;
  CREATE TEMP TABLE _brio_cal ON COMMIT DROP AS
  SELECT rod.pergunta_id,
         COUNT(*)::INT AS n,
         COUNT(*) FILTER (WHERE r.acertou)::INT AS n_acertos,
         COALESCE(SUM(h.theta), 0) AS soma_theta,
         COALESCE(SUM(h.theta * h.theta), 0) AS soma_theta2,
         COALESCE(SUM(h.theta * (CASE WHEN r.acertou THEN 1 ELSE 0 END)), 0) AS soma_theta_acerto
  FROM public.brio_respostas r
  JOIN public.brio_rodadas rod
    ON rod.partida_id = r.partida_id AND rod.numero = r.rodada_numero
  JOIN public.brio_habilidade h
    ON h.user_id = r.jogador_id AND h.area_slug IS NULL
  WHERE r.acertou IS NOT NULL
  GROUP BY rod.pergunta_id;

  -- 2. Acumulado por item: é o que permite recalibrar SEM reprocessar todo o
  --    histórico de respostas.
  INSERT INTO public.brio_calibracao
    (pergunta_id, n_respostas, n_acertos, soma_theta, soma_theta2, soma_theta_acerto, atualizado_em)
  SELECT pergunta_id, n, n_acertos, soma_theta, soma_theta2, soma_theta_acerto, now()
  FROM _brio_cal
  ON CONFLICT (pergunta_id) DO UPDATE SET
    n_respostas = EXCLUDED.n_respostas,
    n_acertos = EXCLUDED.n_acertos,
    soma_theta = EXCLUDED.soma_theta,
    soma_theta2 = EXCLUDED.soma_theta2,
    soma_theta_acerto = EXCLUDED.soma_theta_acerto,
    atualizado_em = now();

  SELECT COUNT(*) INTO v_itens FROM _brio_cal;

  -- 3. Reestima os parâmetros de cada item.
  FOR v_rec IN
    SELECT c.pergunta_id, c.n, c.n_acertos, c.soma_theta, c.soma_theta2,
           c.soma_theta_acerto, q.tri_a, q.tri_b, q.tri_c
    FROM _brio_cal c
    JOIN public.brio_questions q ON q.id = c.pergunta_id
  LOOP
    v_n := GREATEST(1, v_rec.n);
    v_prop := v_rec.n_acertos::NUMERIC / v_n;
    v_media := v_rec.soma_theta / v_n;
    v_var := GREATEST(0, v_rec.soma_theta2 / v_n - v_media * v_media);

    -- Discriminação ponto-bisserial: correlação entre θ e o acerto.
    v_disc := 0;
    IF v_var > 1e-9 AND v_prop > 0 AND v_prop < 1 THEN
      v_disc := (v_rec.soma_theta_acerto / v_n - v_media * v_prop)
                / sqrt(v_var * v_prop * (1 - v_prop));
    END IF;

    v_peso := v_n / (v_n + k_shrink);

    -- a: mapeada da ponto-bisserial, puxada para o provisório.
    v_a := LEAST(2.5, GREATEST(0.3,
             v_peso * (1.0 + 1.6 * v_disc) + (1 - v_peso) * v_rec.tri_a));

    -- b: inverso fechado da 3PL no θ médio dos respondentes.
    --   P = c + (1−c)/(1+e^(−a(θ−b)))  ⇒  b = θ̄ + ln((1−q)/q)/a,  q = (P−c)/(1−c)
    -- Item fácil (P alto) ⇒ q alto ⇒ ln negativo ⇒ b baixo. Confere.
    v_q := LEAST(1 - 1e-6, GREATEST(1e-6, (v_prop - v_rec.tri_c) / GREATEST(1e-9, 1 - v_rec.tri_c)));
    v_b := LEAST(4, GREATEST(-4,
             v_peso * (v_media + ln((1 - v_q) / v_q) / v_a) + (1 - v_peso) * v_rec.tri_b));

    -- 4. Diagnóstico de qualidade: item que se comporta mal sai da avaliação.
    v_suspeita := NULL;
    IF v_n >= k_minimo THEN
      IF v_prop < GREATEST(v_rec.tri_c, 0.1667) - 0.03 THEN
        v_suspeita := 'acerto abaixo do esperado por chute (possível erro de gabarito)';
      ELSIF v_disc < -0.1 THEN
        v_suspeita := 'discriminação negativa (melhores jogadores erram mais)';
      END IF;
    END IF;

    v_provisorio := v_n < k_minimo;
    IF v_suspeita IS NOT NULL THEN v_suspeitos := v_suspeitos + 1; END IF;
    IF NOT v_provisorio THEN v_calibrados := v_calibrados + 1; END IF;

    UPDATE public.brio_questions
    SET tri_a = v_a, tri_b = v_b, tri_provisorio = v_provisorio, tri_suspeita = v_suspeita
    WHERE id = v_rec.pergunta_id;

    UPDATE public.brio_calibracao
    SET tri_a = v_a, tri_b = v_b, tri_c = v_rec.tri_c,
        provisorio = v_provisorio, suspeita = v_suspeita, atualizado_em = now()
    WHERE pergunta_id = v_rec.pergunta_id;
  END LOOP;

  RETURN jsonb_build_object(
    'itens_avaliados', v_itens,
    'calibrados', v_calibrados,
    'provisorios', v_itens - v_calibrados,
    'suspeitos', v_suspeitos,
    'minimo_amostra', k_minimo
  );
END
$$;

REVOKE ALL ON FUNCTION public.brio_calibrar(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.brio_calibrar(INTEGER) TO service_role;

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
${categoriasSql}
ON CONFLICT (slug) DO UPDATE SET
  area_slug = EXCLUDED.area_slug,
  nome = EXCLUDED.nome,
  icone = EXCLUDED.icone,
  ativa = TRUE;

-- ---------- 20. Seed: perguntas curadas (${ACERVO_BRIO_EQUILIBRADO.length}) ----------
INSERT INTO public.brio_questions
  (id, area_slug, subcategoria_slug, dificuldade, ordem, enunciado, alternativas,
   letra_correta, explicacao, referencia, assinatura, status, ativa, versao, tri_b)
VALUES
${ACERVO_BRIO_EQUILIBRADO.map(sqlPergunta).join(",\n")}
ON CONFLICT (id) DO UPDATE SET
  area_slug = EXCLUDED.area_slug,
  -- O seed MANDA o tri_b inicial por dificuldade. Sem isto o DEFAULT 0.0 do
  -- schema nivelava facil e especialista (a TRI tratava todas como iguais) e
  -- nem o reimportar corrigia perguntas ja gravadas.
  tri_b = EXCLUDED.tri_b,
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
`;

writeFileSync("supabase/migrations/guerra_de_brio.sql", sql);
console.log(`guerra_de_brio.sql gerado: ${ACERVO_BRIO_EQUILIBRADO.length} perguntas, ${AREAS.length} áreas`);
