-- ============================================================
-- MIGRAÇÃO: Adiciona suporte multi-tenant ao banco existente
-- Execute no SQL Editor do Supabase em banco com dados.
-- Seguro para rodar em produção — NÃO apaga dados existentes.
-- ============================================================

-- ── 1. Criar tabela tenants ────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  slug       TEXT        NOT NULL UNIQUE,
  nome       TEXT        NOT NULL,
  config     JSONB       NOT NULL DEFAULT '{}',
  ativo      BOOLEAN     DEFAULT TRUE,
  criado_em  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. Criar tabela superadmin ─────────────────────────────
CREATE TABLE IF NOT EXISTS superadmin (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario    TEXT        NOT NULL UNIQUE,
  senha_hash TEXT        NOT NULL,
  criado_em  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. Inserir tenant padrão para dados existentes ─────────
INSERT INTO tenants (slug, nome, config) VALUES (
  'tattoo-demo',
  'Tattoo Studio',
  '{
    "nome": "TATTOO STUDIO",
    "tagline": "Arte permanente na sua pele",
    "icone": "◈",
    "cores": {
      "acento": "#a855f7",
      "acentoClaro": "#c084fc",
      "acentoEscuro": "#7c3aed",
      "sombraAcento": "rgba(168,85,247,0.25)",
      "bgAcento": "rgba(168,85,247,0.04)"
    },
    "termos": {
      "servico": "sessão",
      "Servico": "Sessão",
      "servicos": "sessões",
      "Servicos": "Sessões",
      "agendar": "Solicitar orçamento",
      "notas_placeholder": "Descreva sua ideia de tattoo",
      "notas_label": "Briefing",
      "historico_titulo": "Minhas sessões",
      "home_titulo": "Sua próxima tattoo",
      "home_subtitulo": "O que vamos tatuar?",
      "servicos_exemplo": "blackwork, realismo, fineline..."
    },
    "camposExtras": "briefing",
    "duracaoPadrao": 120,
    "horariosFuncionamento": {
      "inicio": "10:00",
      "fim": "20:00",
      "intervalos": 60
    }
  }'::jsonb
) ON CONFLICT (slug) DO NOTHING;

-- Captura o ID do tenant criado para usar nas migrações abaixo
DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'tattoo-demo';

  -- ── 4. Adicionar tenant_id às tabelas existentes ─────────

  -- clientes
  ALTER TABLE clientes ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  UPDATE clientes SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  ALTER TABLE clientes ALTER COLUMN tenant_id SET NOT NULL;

  -- admin
  ALTER TABLE admin ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  UPDATE admin SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  ALTER TABLE admin ALTER COLUMN tenant_id SET NOT NULL;

  -- servicos
  ALTER TABLE servicos ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  UPDATE servicos SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  ALTER TABLE servicos ALTER COLUMN tenant_id SET NOT NULL;

  -- horarios_disponiveis
  ALTER TABLE horarios_disponiveis ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  UPDATE horarios_disponiveis SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  ALTER TABLE horarios_disponiveis ALTER COLUMN tenant_id SET NOT NULL;

  -- agendamentos
  ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  UPDATE agendamentos SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  ALTER TABLE agendamentos ALTER COLUMN tenant_id SET NOT NULL;

  -- produtos
  ALTER TABLE produtos ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  UPDATE produtos SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  ALTER TABLE produtos ALTER COLUMN tenant_id SET NOT NULL;

  -- pedidos
  ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  UPDATE pedidos SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  ALTER TABLE pedidos ALTER COLUMN tenant_id SET NOT NULL;

  -- pedido_itens
  ALTER TABLE pedido_itens ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  UPDATE pedido_itens SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  ALTER TABLE pedido_itens ALTER COLUMN tenant_id SET NOT NULL;

  -- audit_log
  ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;

  -- login_tentativas
  ALTER TABLE login_tentativas ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;

END $$;

-- ── 5. Atualizar UNIQUE constraints ───────────────────────

-- clientes: telefone passa a ser único por tenant
ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_telefone_key;
ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_telefone_tenant_unique;
ALTER TABLE clientes ADD CONSTRAINT clientes_telefone_tenant_unique UNIQUE (telefone, tenant_id);

-- admin: usuario único por tenant
ALTER TABLE admin DROP CONSTRAINT IF EXISTS admin_usuario_key;
ALTER TABLE admin DROP CONSTRAINT IF EXISTS admin_usuario_tenant_unique;
ALTER TABLE admin ADD CONSTRAINT admin_usuario_tenant_unique UNIQUE (usuario, tenant_id);

-- horarios_disponiveis: data+hora únicos por tenant
ALTER TABLE horarios_disponiveis DROP CONSTRAINT IF EXISTS horarios_disponiveis_data_hora_key;
ALTER TABLE horarios_disponiveis DROP CONSTRAINT IF EXISTS horarios_disponiveis_data_hora_tenant_unique;
ALTER TABLE horarios_disponiveis ADD CONSTRAINT horarios_disponiveis_data_hora_tenant_unique UNIQUE (data, hora, tenant_id);

-- ── 6. Criar tabela briefings ──────────────────────────────
CREATE TABLE IF NOT EXISTS briefings (
  id               UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id        UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cliente_id       UUID          REFERENCES clientes(id) ON DELETE SET NULL,
  descricao        TEXT,
  foto_url         TEXT,
  estilo           TEXT,
  local_corpo      TEXT,
  tamanho_aprox    TEXT,
  periodo_sugerido TEXT,
  valor_proposto   NUMERIC(10,2),
  status           TEXT          DEFAULT 'aguardando'
    CHECK (status IN ('aguardando','proposta_enviada','confirmado','recusado')),
  agendamento_id   UUID          REFERENCES agendamentos(id) ON DELETE SET NULL,
  criado_em        TIMESTAMPTZ   DEFAULT NOW()
);

-- ── 7. Índices de performance ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_agendamentos_tenant_data  ON agendamentos(tenant_id, data);
CREATE INDEX IF NOT EXISTS idx_clientes_tenant           ON clientes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_servicos_tenant           ON servicos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_briefings_tenant_status   ON briefings(tenant_id, status);

-- ── 8. RLS para tabelas novas ─────────────────────────────
ALTER TABLE tenants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE superadmin ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefings  ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "deny_anon_tenants"    ON tenants    FOR ALL TO anon USING (false);
CREATE POLICY IF NOT EXISTS "deny_anon_superadmin" ON superadmin FOR ALL TO anon USING (false);
CREATE POLICY IF NOT EXISTS "deny_anon_briefings"  ON briefings  FOR ALL TO anon USING (false);

-- ── 9. Função decrementar_estoque (recria com segurança) ──
CREATE OR REPLACE FUNCTION decrementar_estoque(p_produto_id UUID, p_quantidade INT)
RETURNS void AS $$
BEGIN
  UPDATE produtos
  SET quantidade = GREATEST(0, quantidade - p_quantidade)
  WHERE id = p_produto_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Migração concluída.
-- Próximo passo: rodar python create_admin.py tattoo-demo <usuario> <senha>
-- ============================================================
