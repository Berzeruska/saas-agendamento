import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminAPI } from '../../services/api'
import HelpBox from '../../components/HelpBox'
import './Admin.css'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export default function AdminFinancial() {
  const navigate = useNavigate()
  const hoje = new Date()
  const [mes, setMes]         = useState(hoje.getMonth() + 1)
  const [ano, setAno]         = useState(hoje.getFullYear())
  const [dados, setDados]     = useState(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => { carregar() }, [mes, ano])

  async function carregar() {
    setCarregando(true)
    try {
      const { data } = await adminAPI.financeiro(mes, ano)
      setDados(data)
    } catch (e) {
      console.error(e)
    } finally {
      setCarregando(false)
    }
  }

  function mudarMes(delta) {
    let novoMes = mes + delta
    let novoAno = ano
    if (novoMes > 12) { novoMes = 1; novoAno++ }
    if (novoMes < 1)  { novoMes = 12; novoAno-- }
    setMes(novoMes)
    setAno(novoAno)
  }

  const pagamentos = dados?.pagamentos || []

  return (
    <div className="pagina admin-pagina">
      <header className="pagina-titulo">
        <button className="auth-voltar" onClick={() => navigate('/admin')}>← Painel</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2>Financeiro</h2>
          <HelpBox texto="Resumo financeiro mensal. Receita recebida, gastos com materiais e lucro líquido." />
        </div>
      </header>

      {/* Seletor de mês */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 'var(--espaco-lg)', justifyContent: 'center' }}>
        <button className="btn btn-ghost" style={{ padding: '6px 16px', fontSize: '1.1rem' }} onClick={() => mudarMes(-1)}>
          ‹
        </button>
        <p style={{ fontWeight: 700, fontSize: '0.95rem', minWidth: 160, textAlign: 'center' }}>
          {MESES[mes - 1]} {ano}
        </p>
        <button className="btn btn-ghost" style={{ padding: '6px 16px', fontSize: '1.1rem' }} onClick={() => mudarMes(1)}>
          ›
        </button>
      </div>

      {/* Stats — linha 1: receita + geral */}
      <div className="admin-stats animar-entrada" style={{ marginBottom: 'var(--espaco-md)', gridTemplateColumns: '1fr 1fr' }}>
        <div className="admin-stat-card">
          <span className="admin-stat-numero" style={{ color: 'var(--cor-sucesso)', fontSize: '1.3rem' }}>
            R$ {dados ? Number(dados.total_mes).toFixed(2) : '—'}
          </span>
          <span className="admin-stat-label">Recebido no mês</span>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-numero" style={{ fontSize: '1.3rem' }}>
            R$ {dados ? Number(dados.total_geral).toFixed(2) : '—'}
          </span>
          <span className="admin-stat-label">Total geral</span>
        </div>
      </div>

      {/* Stats — linha 2: gastos + lucro */}
      <div className="admin-stats animar-entrada" style={{ marginBottom: 'var(--espaco-xl)', gridTemplateColumns: '1fr 1fr' }}>
        <div className="admin-stat-card">
          <span className="admin-stat-numero" style={{ color: 'var(--cor-erro)', fontSize: '1.3rem' }}>
            R$ {dados ? Number(dados.total_gastos || 0).toFixed(2) : '—'}
          </span>
          <span className="admin-stat-label">Gastos materiais</span>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-numero" style={{ color: 'var(--cor-acento)', fontSize: '1.3rem' }}>
            R$ {dados ? Number(dados.lucro_liquido || 0).toFixed(2) : '—'}
          </span>
          <span className="admin-stat-label">Lucro líquido</span>
        </div>
      </div>

      {/* Lista */}
      <p className="admin-secao-label">
        SESSÕES — {MESES[mes - 1].toUpperCase()} {ano}
      </p>

      {carregando && (
        <p style={{ color: 'var(--cor-texto-fraco)', textAlign: 'center', marginTop: 24 }}>Carregando...</p>
      )}

      {!carregando && pagamentos.length === 0 && (
        <div className="alerta alerta-info">Nenhuma sessão registrada neste mês.</div>
      )}

      <div className="stack">
        {pagamentos.map((p, i) => {
          const dataRef = p.data_pagamento || p.data_proposta
          const concluido = p.status === 'concluido'
          return (
            <div
              key={i}
              className="card animar-entrada"
              style={{ animationDelay: `${i * 0.04}s`, padding: '14px 16px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                      {p.clientes?.nome || 'Cliente'}
                    </p>
                    <span style={{
                      fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em',
                      padding: '2px 7px', borderRadius: 20,
                      background: concluido ? 'var(--cor-acento)' : 'var(--cor-sucesso)',
                      color: '#fff',
                    }}>
                      {concluido ? 'CONCLUÍDO' : 'PAGO'}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--cor-texto-fraco)' }}>
                    {p.estilo || 'Tattoo'}
                    {dataRef && (
                      <> · {new Date(dataRef + 'T00:00:00').toLocaleDateString('pt-BR')}</>
                    )}
                  </p>
                </div>
                <span style={{
                  fontFamily: 'var(--fonte-display)',
                  fontSize: '1.25rem',
                  color: 'var(--cor-sucesso)',
                  flexShrink: 0,
                }}>
                  R$ {Number(p.valor_combinado).toFixed(2)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
