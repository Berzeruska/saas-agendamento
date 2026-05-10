-- ============================================================
-- SAAS AGENDAMENTO — SETUP COMPLETO MULTI-TENANT
-- Execute no SQL Editor do Supabase para novos clientes
-- ============================================================

-- ── Tenants ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  slug       TEXT        NOT NULL UNIQUE,
  nome       TEXT        NOT NULL,
  config     JSONB       NOT NULL DEFAULT '{}',
  -- config esperado: { cores, terminologia, icone, camposExtras,
  --                    duracaoPadrao, horariosFuncionamento }
  ativo      BOOLEAN     DEFAULT TRUE,
  criado_em  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Superadmin (global, sem tenant) ────────────────────────
CREATE TABLE IF NOT EXISTS superadmin (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario    TEXT        NOT NULL UNIQUE,
  senha_hash TEXT        NOT NULL,
  criado_em  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Clientes ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clientes (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome          TEXT        NOT NULL,
  telefone      TEXT        NOT NULL,
  senha_hash    TEXT        NOT NULL,
  email         TEXT,
  notas_admin   TEXT,
  data_cadastro TIMESTAMPTZ DEFAULT NOW(),
  ativo         BOOLEAN     DEFAULT TRUE,
  UNIQUE(telefone, tenant_id)
);

-- ── Admin por tenant ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id  UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  usuario    TEXT        NOT NULL,
  senha_hash TEXT        NOT NULL,
  criado_em  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(usuario, tenant_id)
);

-- ── Serviços ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS servicos (
  id               UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id        UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome             TEXT          NOT NULL,
  descricao        TEXT,
  preco            NUMERIC(10,2) NOT NULL,
  duracao_minutos  INT           NOT NULL,
  categoria        TEXT,
  ativo            BOOLEAN       DEFAULT TRUE
);

-- ── Horários disponíveis ───────────────────────────────────
CREATE TABLE IF NOT EXISTS horarios_disponiveis (
  id         UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id  UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  data       DATE    NOT NULL,
  hora       TIME    NOT NULL,
  disponivel BOOLEAN DEFAULT TRUE,
  UNIQUE(data, hora, tenant_id)
);

-- ── Agendamentos ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agendamentos (
  id          UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cliente_id  UUID          REFERENCES clientes(id) ON DELETE CASCADE,
  servico_id  UUID          REFERENCES servicos(id),
  data        DATE          NOT NULL,
  hora        TIME          NOT NULL,
  status      TEXT          DEFAULT 'pendente'
    CHECK (status IN ('pendente','confirmado','concluido','cancelado')),
  notas       TEXT,
  deposito    NUMERIC(10,2) DEFAULT 0,
  criado_em   TIMESTAMPTZ   DEFAULT NOW()
);

-- ── Produtos ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS produtos (
  id            UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome          TEXT          NOT NULL,
  preco         NUMERIC(10,2) NOT NULL,
  quantidade    INT           DEFAULT 0,
  alerta_minimo INT           DEFAULT 5,
  ativo         BOOLEAN       DEFAULT TRUE
);

-- ── Pedidos ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pedidos (
  id                UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agendamento_id    UUID          REFERENCES agendamentos(id) ON DELETE SET NULL,
  cliente_id        UUID          REFERENCES clientes(id),
  total             NUMERIC(10,2) NOT NULL,
  status_pagamento  TEXT          DEFAULT 'pendente'
    CHECK (status_pagamento IN ('pendente','pago','cancelado')),
  metodo_pagamento  TEXT,
  criado_em         TIMESTAMPTZ   DEFAULT NOW()
);

-- ── Itens do pedido ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pedido_itens (
  id             UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id      UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pedido_id      UUID          REFERENCES pedidos(id) ON DELETE CASCADE,
  produto_id     UUID          REFERENCES produtos(id),
  quantidade     INT           NOT NULL,
  preco_unitario NUMERIC(10,2) NOT NULL
);

-- ── Briefings (fluxo de orçamento para tatuadores) ─────────
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

-- ── Audit log ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id  UUID        REFERENCES tenants(id) ON DELETE SET NULL,
  acao       TEXT        NOT NULL,
  detalhes   JSONB,
  ip         TEXT,
  criado_em  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Login tentativas ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS login_tentativas (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  ip            TEXT        NOT NULL,
  tenant_id     UUID        REFERENCES tenants(id) ON DELETE SET NULL,
  tentativas    INT         DEFAULT 1,
  bloqueado_ate TIMESTAMPTZ,
  ultima_vez    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_tentativas_ip       ON login_tentativas(ip);
CREATE INDEX IF NOT EXISTS idx_agendamentos_tenant_data  ON agendamentos(tenant_id, data);
CREATE INDEX IF NOT EXISTS idx_clientes_tenant           ON clientes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_servicos_tenant           ON servicos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_briefings_tenant_status   ON briefings(tenant_id, status);

-- ============================================================
-- ROW LEVEL SECURITY
-- O backend usa service_role key e bypassa RLS.
-- Estas políticas bloqueiam acesso direto via anon key.
-- ============================================================

ALTER TABLE tenants              ENABLE ROW LEVEL SECURITY;
ALTER TABLE superadmin           ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin                ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE horarios_disponiveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_itens         ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log            ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_tentativas     ENABLE ROW LEVEL SECURITY;

-- Bloqueia tudo via anon key
CREATE POLICY "deny_anon_tenants"     ON tenants             FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_superadmin"  ON superadmin          FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_clientes"    ON clientes            FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_admin"       ON admin               FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_servicos"    ON servicos            FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_horarios"    ON horarios_disponiveis FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_agendamentos" ON agendamentos       FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_produtos"    ON produtos            FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_pedidos"     ON pedidos             FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_pedido_itens" ON pedido_itens       FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_briefings"   ON briefings           FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_audit"       ON audit_log           FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_tentativas"  ON login_tentativas    FOR ALL TO anon USING (false);

-- ============================================================
-- FUNÇÃO — Decrementa estoque com proteção contra negativo
-- ============================================================
CREATE OR REPLACE FUNCTION decrementar_estoque(p_produto_id UUID, p_quantidade INT)
RETURNS void AS $$
BEGIN
  UPDATE produtos
  SET quantidade = GREATEST(0, quantidade - p_quantidade)
  WHERE id = p_produto_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- TENANT EXEMPLO — Tattoo Studio
-- ============================================================
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

-- Serviços do tenant demo
INSERT INTO servicos (tenant_id, nome, descricao, preco, duracao_minutos, categoria)
SELECT t.id, s.nome, s.descricao, s.preco, s.duracao_minutos, s.categoria
FROM tenants t,
(VALUES
  ('Tattoo Pequena',  'Até 5cm — traço simples ou preenchido',   200.00,  60, 'pequena'),
  ('Tattoo Média',    '5–15cm — detalhe moderado',               500.00, 180, 'media'),
  ('Tattoo Grande',   'Acima de 15cm ou peça complexa',         1200.00, 360, 'grande'),
  ('Cover-Up',        'Cobertura de tattoo antiga',               800.00, 300, 'cover'),
  ('Retoque',         'Retoque de tattoo anterior',               150.00,  60, 'retoque')
) AS s(nome, descricao, preco, duracao_minutos, categoria)
WHERE t.slug = 'tattoo-demo'
ON CONFLICT DO NOTHING;

-- ============================================================
-- Admin padrão — TROQUE A SENHA imediatamente!
-- Rode: cd backend && python create_admin.py tattoo-demo admin SENHA_FORTE
-- ============================================================
