import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { appointmentsAPI } from '../services/api'
import { config } from '../config/index.js'
import BottomNav from '../components/layout/BottomNav'
import './ClientHome.css'

export default function ClientHome() {
  const { cliente, logoutCliente } = useAuth()
  const navigate = useNavigate()
  const [proximoAg, setProximoAg] = useState(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    appointmentsAPI.mine()
      .then(({ data }) => {
        const hoje = new Date().toISOString().split('T')[0]
        const proximos = data.filter(a => a.data >= hoje && a.status !== 'cancelado')
        setProximoAg(proximos[0] || null)
      })
      .catch(() => {})
      .finally(() => setCarregando(false))
  }, [])

  return (
    <div className="tem-bottom-nav">
      <div className="pagina">
        <header className="home-header animar-entrada">
          <div>
            <p className="home-boas-vindas">Olá, {cliente?.nome?.split(' ')[0]}</p>
            <h2 className="home-titulo">{config.termos.home_titulo}</h2>
          </div>
          <button className="home-logout" onClick={logoutCliente} title="Sair">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </header>

        {/* Próximo agendamento */}
        {!carregando && proximoAg && (
          <div className="card card-ouro home-prox-ag animar-entrada delay-1">
            <p className="home-card-label">PRÓXIMO {config.termos.Servico.toUpperCase()}</p>
            <p className="home-prox-nome">{proximoAg.servicos?.nome}</p>
            <div className="home-prox-detalhes">
              <span>
                {new Date(proximoAg.data + 'T00:00:00').toLocaleDateString('pt-BR', {
                  weekday: 'short', day: '2-digit', month: 'short'
                })}
              </span>
              <span>·</span>
              <span>{proximoAg.hora?.slice(0, 5)}</span>
            </div>
            <span className={`badge badge-${proximoAg.status}`}>{proximoAg.status}</span>
          </div>
        )}

        {!carregando && !proximoAg && (
          <div className="alerta alerta-info animar-entrada delay-1">
            Você não tem {config.termos.servicos} agendados. Que tal marcar um?
          </div>
        )}

        {/* Menu rápido */}
        <section className="animar-entrada delay-2">
          <p className="home-secao-label">{config.termos.home_subtitulo.toUpperCase()}</p>
          <div className="home-grid">
            <button
              className="home-menu-card"
              onClick={() => navigate(config.camposExtras === 'briefing' ? '/briefing' : '/agendar')}
            >
              <span className="home-menu-icone">📅</span>
              <span className="home-menu-label">{config.termos.agendar}</span>
            </button>
            <button className="home-menu-card" onClick={() => navigate('/produtos')}>
              <span className="home-menu-icone">🛍</span>
              <span className="home-menu-label">Produtos</span>
            </button>
            <button className="home-menu-card" onClick={() => navigate('/historico')}>
              <span className="home-menu-icone">📋</span>
              <span className="home-menu-label">Histórico</span>
            </button>
          </div>
        </section>
      </div>
      <BottomNav />
    </div>
  )
}
