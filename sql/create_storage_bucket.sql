-- ════════════════════════════════════════════════════════════
-- CRIAÇÃO DO BUCKET DE STORAGE PARA FOTOS DE BRIEFINGS
-- Execute via Supabase Dashboard → Storage → Buckets
-- OU via SQL Editor com a extensão storage ativa
-- ════════════════════════════════════════════════════════════

-- Opção A: Via Supabase Dashboard (recomendado)
-- 1. Acesse https://supabase.com → seu projeto → Storage
-- 2. Clique em "New bucket"
-- 3. Name: briefings
-- 4. Public bucket: SIM (marque a opção)
-- 5. Clique em "Create bucket"

-- Opção B: Via SQL (apenas se a extensão storage estiver habilitada)
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('briefings', 'briefings', true)
-- ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- POLÍTICAS RLS para o bucket (Execute no SQL Editor)
-- ────────────────────────────────────────────────────────────

-- Leitura pública (para exibir fotos no painel)
CREATE POLICY "briefings_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'briefings');

-- Upload apenas para usuários autenticados via service_role
-- (o backend usa a service_role key, então não precisa de policy de insert)

-- ────────────────────────────────────────────────────────────
-- ESTRUTURA DO PATH no bucket:
-- {tenant_id}/{cliente_id}/{uuid}.{ext}
-- Exemplo: abc123.../def456.../foto.jpg
-- ────────────────────────────────────────────────────────────
