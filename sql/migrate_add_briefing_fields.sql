-- Migration: campos de data/hora para confirmação de briefings
-- Execute no Supabase SQL Editor

ALTER TABLE briefings
  ADD COLUMN IF NOT EXISTS data_proposta DATE,
  ADD COLUMN IF NOT EXISTS hora_proposta TEXT,
  ADD COLUMN IF NOT EXISTS notas_admin   TEXT;

-- Expande o status para incluir cancelado e concluido
ALTER TABLE briefings DROP CONSTRAINT IF EXISTS briefings_status_check;
ALTER TABLE briefings ADD CONSTRAINT briefings_status_check
  CHECK (status IN ('aguardando','proposta_enviada','confirmado','recusado','cancelado','concluido'));

-- Índice para a query da tela de Agenda
CREATE INDEX IF NOT EXISTS idx_briefings_data_proposta
  ON briefings(tenant_id, data_proposta)
  WHERE status = 'confirmado';
