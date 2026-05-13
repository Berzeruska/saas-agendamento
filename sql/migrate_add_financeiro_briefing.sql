-- Migration: campos financeiros na tabela briefings
-- Rodar no Supabase SQL Editor antes do deploy

ALTER TABLE briefings
  ADD COLUMN IF NOT EXISTS valor_combinado NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS pago            BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_pagamento  DATE;

-- Índice para consultas do módulo financeiro
CREATE INDEX IF NOT EXISTS idx_briefings_pagamento
  ON briefings (tenant_id, data_pagamento)
  WHERE pago = true;
