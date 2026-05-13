import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { briefingsAPI } from '../services/api'
import { config } from '../config/index.js'
import BottomNav from '../components/layout/BottomNav'
import './ClientHome.css'

const STATUS_LABEL = {
  aguardando:       'Aguardando',
  proposta_enviada: 'Proposta recebida',
  confirmado:       'Confirmado',
  recusado:         'Recusado',
  cancelado:        'Cancelado',
  concluido:        'Concluído',
}

const STATUS_BADGE = {
  aguardando:       'badge-pendente',
  proposta_enviada: 'badge-confirmado',
  confirmado:       'badge-concluido',
  recusado:         'badge-cancelado',
  cancelado:        'badge-cancelado',
  concluido:        'badge-concluido',
}

export default function ClientHome() {
  const { cliente, logoutCliente } = useAuth()
  const navigate = useNavigate()
  const [briefings, setBriefings]   = useState([])
  const [carregando, setCarregando] = useState(true)
  const isBriefingMode = config.camposExtras === 'briefing'

  useEffect(() => {
    if (!isBriefingMode) { setCarregando(false); return }
    briefingsAPI.mine()
      .then(({ data }) => setBriefings(data || []))
      .catch(() => {})
      .finally(() => setCarregando(false))
  }, [])

  const pendente = briefings.find(b => b.status === 'aguardando')
  const proximoConfirmado = briefings.find(b => b.status === 'confirmado')

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

        {/* Solicitação aguardando confirmação */}
        {!carregando && pendente && (
          <div className="card card-ouro home-prox-ag animar-entrada delay-1">
            <p className="home-card-label">AGUARDANDO CONFIRMAÇÃO</p>
            <p className="home-prox-nome">
              {pendente.estilo || 'Sua solicitação'}{pendente.local_corpo ? ` · ${pendente.local_corpo}` : ''}
            </p>
            {pendente.data_proposta && (
              <div className="home-prox-detalhes">
                <span>
                  Sugestão: {new Date(pendente.data_proposta + 'T00:00:00').toLocaleDateString('pt-BR', {
                    day: '2-digit', month: 'short',
                  })}
                </span>
              </div>
            )}
            <span className="badge badge-pendente" style={{ marginTop: 8 }}>Aguardando artista</span>
          </div>
        )}

        {/* Próxima sessão confirmada */}
        {!carregando && !pendente && proximoConfirmado && (
          <div className="card card-ouro home-prox-ag animar-entrada delay-1">
            <p className="home-card-label">PRÓXIMA SESSÃO</p>
            <p className="home-prox-nome">
              {proximoConfirmado.estilo || 'Tatuagem'}
              {proximoConfirmado.local_corpo ? ` · ${proximoConfirmado.local_corpo}` : ''}
            </p>
            {proximoConfirmado.data_proposta && (
              <div className="home-prox-detalhes">
                <span>
                  {new Date(proximoConfirmado.data_proposta + 'T00:00:00').toLocaleDateString('pt-BR', {
                    weekday: 'short', day: '2-digit', month: 'short',
                  })}
                  {proximoConfirmado.hora_proposta && ` · ${proximoConfirmado.hora_proposta.slice(0, 5)}`}
                </span>
              </div>
            )}
            <span className="badge badge-concluido">Confirmado</span>
          </div>
        )}

        {/* Botão nova solicitação */}
        <section className="animar-entrada delay-2" style={{ marginTop: 'var(--espaco-lg)' }}>
          <button
            className="btn btn-primario"
            style={{ width: '100%', padding: '18px', fontSize: '1rem', letterSpacing: '0.1em' }}
            onClick={() => navigate('/briefing')}
          >
            <span style={{ marginRight: 8 }}>✦</span>
            Nova solicitação
          </button>
        </section>

        {/* Lista de solicitações anteriores */}
        {isBriefingMode && (
          <section className="animar-entrada delay-2" style={{ marginTop: 'var(--espaco-xl)' }}>
            <p className="home-secao-label">MINHAS SOLICITAÇÕES</p>

            {carregando && <p style={{ color: 'var(--cor-texto-fraco)', textAlign: 'center' }}>Carregando...</p>}

            {!carregando && briefings.length === 0 && (
              <div className="alerta alerta-info">
                Você ainda não fez nenhuma solicitação.
              </div>
            )}

            <div className="stack">
              {briefings.slice(0, 5).map((b, i) => (
                <div
                  key={b.id}
                  className="card animar-entrada"
                  style={{ animationDelay: `${i * 0.04}s`, padding: '14px 16px', cursor: 'pointer' }}
                  onClick={() => navigate('/historico')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    {b.foto_url && (
                      <img
                        src={b.foto_url}
                        alt="Referência"
                        style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 2 }}>
                        {b.estilo || 'Tatuagem'}
                        {b.local_corpo ? ` · ${b.local_corpo}` : ''}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--cor-texto-fraco)' }}>
                        {new Date(b.criado_em).toLocaleDateString('pt-BR')}
                        {b.data_proposta && (
                          <> · {new Date(b.data_proposta + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</>
                        )}
                      </p>
                    </div>
                    <span className={`badge ${STATUS_BADGE[b.status] || 'badge-pendente'}`} style={{ flexShrink: 0, fontSize: '0.65rem' }}>
                      {STATUS_LABEL[b.status] || b.status}
                    </span>
                  </div>
                </div>
              ))}

              {briefings.length > 5 && (
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: '0.82rem', padding: '10px' }}
                  onClick={() => navigate('/historico')}
                >
                  Ver todas ({briefings.length})
                </button>
              )}
            </div>
          </section>
        )}

        {/* Menu rápido para não-briefing mode */}
        {!isBriefingMode && (
          <section className="animar-entrada delay-2" style={{ marginTop: 'var(--espaco-lg)' }}>
            <p className="home-secao-label">{config.termos.home_subtitulo.toUpperCase()}</p>
            <div className="home-grid">
              <button className="home-menu-card" onClick={() => navigate('/agendar')}>
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
        )}
      </div>
      <BottomNav />
    </div>
  )
}
