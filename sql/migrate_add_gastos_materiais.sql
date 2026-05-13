CREATE TABLE IF NOT EXISTS gastos_materiais (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  valor       NUMERIC(10,2) NOT NULL,
  briefing_id UUID REFERENCES briefings(id) ON DELETE SET NULL,
  descricao   TEXT,
  criado_em   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gastos_tenant ON gastos_materiais(tenant_id, criado_em);
