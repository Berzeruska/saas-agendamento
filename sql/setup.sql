-- ============================================================
-- SAAS AGENDAMENTO — SETUP DO BANCO (Supabase SQL Editor)
-- Execute este script inteiro no SQL Editor do Supabase
-- ============================================================

-- Tabela de clientes
CREATE TABLE IF NOT EXISTS clientes (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  nome           TEXT        NOT NULL,
  telefone       TEXT        NOT NULL UNIQUE,
  senha_hash     TEXT        NOT NULL,
  email          TEXT,
  notas_admin    TEXT,
  data_cadastro  TIMESTAMPTZ DEFAULT NOW(),
  ativo          BOOLEAN     DEFAULT TRUE
);

-- Tabela de serviços
CREATE TABLE IF NOT EXISTS servicos (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  nome             TEXT        NOT NULL,
  descricao        TEXT,
  preco            NUMERIC(10,2) NOT NULL,
  duracao_minutos  INT         NOT NULL,
  categoria        TEXT,       -- ex: "corte", "barba" / "small", "large", "cover-up"
  ativo            BOOLEAN     DEFAULT TRUE
);

-- Tabela de horários disponíveis na agenda
CREATE TABLE IF NOT EXISTS horarios_disponiveis (
  id         UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  data       DATE    NOT NULL,
  hora       TIME    NOT NULL,
  disponivel BOOLEAN DEFAULT TRUE,
  UNIQUE(data, hora)
);

-- Tabela de agendamentos
CREATE TABLE IF NOT EXISTS agendamentos (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id  UUID        REFERENCES clientes(id)  ON DELETE CASCADE,
  servico_id  UUID        REFERENCES servicos(id),
  data        DATE        NOT NULL,
  hora        TIME        NOT NULL,
  status      TEXT        DEFAULT 'pendente'
    CHECK (status IN ('pendente','confirmado','concluido','cancelado')),
  notas       TEXT,       -- notas do cliente (ex: estilo tattoo, referência)
  deposito    NUMERIC(10,2) DEFAULT 0,
  criado_em   TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de produtos (estoque + venda)
CREATE TABLE IF NOT EXISTS produtos (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  nome           TEXT        NOT NULL,
  preco          NUMERIC(10,2) NOT NULL,
  quantidade     INT         DEFAULT 0,
  alerta_minimo  INT         DEFAULT 5,
  ativo          BOOLEAN     DEFAULT TRUE
);

-- Tabela de pedidos
CREATE TABLE IF NOT EXISTS pedidos (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  agendamento_id    UUID        REFERENCES agendamentos(id) ON DELETE SET NULL,
  cliente_id        UUID        REFERENCES clientes(id),
  total             NUMERIC(10,2) NOT NULL,
  status_pagamento  TEXT        DEFAULT 'pendente'
    CHECK (status_pagamento IN ('pendente','pago','cancelado')),
  metodo_pagamento  TEXT,
  criado_em         TIMESTAMPTZ DEFAULT NOW()
);

-- Itens do pedido
CREATE TABLE IF NOT EXISTS pedido_itens (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id      UUID        REFERENCES pedidos(id) ON DELETE CASCADE,
  produto_id     UUID        REFERENCES produtos(id),
  quantidade     INT         NOT NULL,
  preco_unitario NUMERIC(10,2) NOT NULL
);

-- Tabela do administrador
CREATE TABLE IF NOT EXISTS admin (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario    TEXT        NOT NULL UNIQUE,
  senha_hash TEXT        NOT NULL,
  criado_em  TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log — rastreio de ações administrativas
CREATE TABLE IF NOT EXISTS audit_log (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  acao       TEXT        NOT NULL,
  detalhes   JSONB,
  ip         TEXT,
  criado_em  TIMESTAMPTZ DEFAULT NOW()
);

-- Tentativas de login — proteção contra brute force
CREATE TABLE IF NOT EXISTS login_tentativas (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  ip          TEXT        NOT NULL,
  tentativas  INT         DEFAULT 1,
  bloqueado_ate TIMESTAMPTZ,
  ultima_vez  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_login_tentativas_ip ON login_tentativas(ip);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE clientes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_itens        ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_tentativas    ENABLE ROW LEVEL SECURITY;

-- Bloqueia acesso direto via anon key a tabelas sensíveis
-- O backend Flask usa service_role key e bypassa RLS.
-- Nenhum dado sensível é acessível via anon key.
CREATE POLICY "deny_all_clientes" ON clientes FOR ALL TO anon USING (false);
CREATE POLICY "deny_all_agendamentos" ON agendamentos FOR ALL TO anon USING (false);
CREATE POLICY "deny_all_pedidos" ON pedidos FOR ALL TO anon USING (false);
CREATE POLICY "deny_all_pedido_itens" ON pedido_itens FOR ALL TO anon USING (false);
CREATE POLICY "deny_all_audit" ON audit_log FOR ALL TO anon USING (false);
CREATE POLICY "deny_all_tentativas" ON login_tentativas FOR ALL TO anon USING (false);

-- Serviços e produtos são públicos (leitura)
ALTER TABLE servicos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE horarios_disponiveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "servicos_public_read" ON servicos FOR SELECT TO anon USING (ativo = true);
CREATE POLICY "produtos_public_read" ON produtos FOR SELECT TO anon USING (ativo = true);
CREATE POLICY "horarios_public_read" ON horarios_disponiveis FOR SELECT TO anon USING (disponivel = true);

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
-- DADOS INICIAIS — BARBEARIA
-- Comente este bloco e use o tatuador abaixo se for tatuador
-- ============================================================

INSERT INTO servicos (nome, descricao, preco, duracao_minutos, categoria) VALUES
  ('Corte simples',    'Corte na tesoura ou máquina',          35.00,  30, 'corte'),
  ('Corte + Barba',    'Corte completo com barba feita',        55.00,  50, 'combo'),
  ('Barba',            'Barba na navalha com toalha quente',    25.00,  20, 'barba'),
  ('Pigmentação',      'Pigmentação capilar completa',          80.00,  60, 'tratamento'),
  ('Platinado',        'Descoloração e tonalização',           120.00,  90, 'tratamento')
ON CONFLICT DO NOTHING;

INSERT INTO produtos (nome, preco, quantidade, alerta_minimo) VALUES
  ('Água mineral 500ml',  3.00, 30, 10),
  ('Coca-Cola 350ml',     6.00, 20,  5),
  ('Energético',         10.00, 15,  5),
  ('Cerveja long neck',   8.00, 24,  6)
ON CONFLICT DO NOTHING;

-- ============================================================
-- DADOS INICIAIS — TATUADOR
-- Descomente este bloco para usar no sistema de tatuador
-- ============================================================

-- INSERT INTO servicos (nome, descricao, preco, duracao_minutos, categoria) VALUES
--   ('Tattoo Pequena',   'Até 5cm — traço simples ou preenchido',  200.00,  60, 'pequena'),
--   ('Tattoo Média',     '5–15cm — detalhe moderado',              500.00, 180, 'media'),
--   ('Tattoo Grande',    'Acima de 15cm ou peça complexa',        1200.00, 360, 'grande'),
--   ('Cover-Up',         'Cobertura de tattoo antiga',             800.00, 300, 'cover'),
--   ('Retoque',          'Retoque de tattoo anterior',             150.00,  60, 'retoque')
-- ON CONFLICT DO NOTHING;

-- ============================================================
-- Admin padrão — TROQUE A SENHA imediatamente após setup!
-- Rode: cd backend && python create_admin.py admin SUA_SENHA_FORTE
-- ============================================================
