import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { adminAPI, briefingsAPI } from '../../services/api'
import { config } from '../../config/index.js'
import HelpBox from '../../components/HelpBox'
import './Admin.css'

const NAV_BASE = [
  { path: '/admin',             label: 'Início',       icon: '🏠' },
  { path: '/admin/agenda',      label: 'Agenda',       icon: '📅' },
  { path: '/admin/solicitacoes',label: 'Solicitações', icon: '📋' },
  { path: '/admin/historico',   label: 'Histórico',   icon: '📁' },
  { path: '/admin/clientes',    label: 'Clientes',     icon: '👥' },
  { path: '/admin/estoque',     label: 'Materiais',    icon: '📦' },
  { path: '/admin/financeiro',  label: 'Financeiro',   icon: '💰' },
  { path: '/admin/exportar',    label: 'Exportar',     icon: '💾' },
]

export default function AdminDashboard() {
  const NAV = NAV_BASE

  const { logoutAdmin } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [dados, setDados]               = useState(null)
  const [aguardandoCount, setAguardandoCount] = useState(0)
  const [carregando, setCarregando]     = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchPending() {
      try {
        const { data } = await briefingsAPI.list('aguardando')
        if (!cancelled) setAguardandoCount(Array.isArray(data) ? data.length : 0)
      } catch {}
    }

    Promise.all([adminAPI.dashboard(), briefingsAPI.list('aguardando')])
      .then(([{ data: dash }, { data: pending }]) => {
        if (cancelled) return
        setDados(dash)
        setAguardandoCount(Array.isArray(pending) ? pending.length : 0)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setCarregando(false) })

    const interval = setInterval(fetchPending, 30_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const hoje = dados?.hoje || {}
  const alertas = dados?.alertas_estoque || []

  return (
    <div className="tem-bottom-nav admin-pagina">
      <div className="pagina">
        <header className="admin-header animar-entrada">
          <div>
            <p className="admin-sub">PAINEL</p>
            <h2 className="admin-titulo">{config.nome}</h2>
          </div>
          <HelpBox texto="Visão geral do estúdio. Acompanhe sessões do dia, clientes ativos e receita da semana." />
          <button className="home-logout" onClick={logoutAdmin} title="Sair">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </header>

        <section className="animar-entrada delay-1">
          <p className="admin-secao-label">
            HOJE — {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </p>
          <div className="admin-stats">
            <div className="admin-stat-card">
              <span className="admin-stat-numero">{hoje.total || 0}</span>
              <span className="admin-stat-label">{config.termos.Servicos}</span>
            </div>
            <div className="admin-stat-card">
              <span className="admin-stat-numero" style={{ color: 'var(--cor-aviso)' }}>{hoje.pendentes || 0}</span>
              <span className="admin-stat-label">Pendentes</span>
            </div>
            <div className="admin-stat-card">
              <span className="admin-stat-numero" style={{ color: 'var(--cor-sucesso)' }}>{hoje.confirmados || 0}</span>
              <span className="admin-stat-label">Confirmadas</span>
            </div>
          </div>
        </section>

        {dados && (
          <div className="admin-stats animar-entrada delay-1" style={{ marginBottom: 'var(--espaco-xl)' }}>
            <div className="admin-stat-card">
              <span className="admin-stat-numero" style={{ fontSize: '1.3rem' }}>
                R$ {(dados.receita_7_dias || 0).toFixed(0)}
              </span>
              <span className="admin-stat-label">Receita (7 dias)</span>
            </div>
            <div className="admin-stat-card" style={{ gridColumn: 'span 2' }}>
              <span className="admin-stat-numero">{dados.total_clientes || 0}</span>
              <span className="admin-stat-label">Total Clientes</span>
            </div>
          </div>
        )}

        {alertas.length > 0 && (
          <div className="alerta alerta-aviso animar-entrada delay-2" style={{ marginBottom: 'var(--espaco-lg)' }}>
            ⚠️ <strong>{alertas.length} produto(s)</strong> com estoque baixo:{' '}
            {alertas.map(p => p.nome).join(', ')}
          </div>
        )}

        <section className="animar-entrada delay-2">
          <p className="admin-secao-label">GERENCIAR</p>
          <div className="admin-menu-grid">
            {NAV.slice(1).map(item => (
              <button
                key={item.path}
                className="admin-menu-card"
                onClick={() => navigate(item.path)}
              >
                <span className="admin-menu-icone">{item.icon}</span>
                <span className="admin-menu-label">{item.label}</span>
                {item.path === '/admin/estoque' && alertas.length > 0 && (
                  <span className="admin-menu-badge">{alertas.length}</span>
                )}
                {item.path === '/admin/solicitacoes' && aguardandoCount > 0 && (
                  <span className="admin-menu-badge acento">{aguardandoCount}</span>
                )}
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* Bottom Nav Admin */}
      <nav className="admin-bottom-nav">
        {NAV.slice(0, 5).map(item => (
          <button
            key={item.path}
            className={`admin-nav-item ${pathname === item.path ? 'ativo' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span style={{ position: 'relative', display: 'inline-block' }}>
              <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
              {item.path === '/admin/solicitacoes' && aguardandoCount > 0 && (
                <span className="admin-nav-badge">{aguardandoCount}</span>
              )}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
