import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { appointmentsAPI, briefingsAPI } from '../services/api'
import { config } from '../config/index.js'
import BottomNav from '../components/layout/BottomNav'
import './History.css'

const STATUS_BRIEFING = {
  aguardando:       'Aguardando resposta',
  proposta_enviada: 'Proposta recebida',
  confirmado:       'Confirmado',
  recusado:         'Recusado',
  cancelado:        'Cancelado',
  concluido:        'Concluído',
}

export default function History() {
  const navigate = useNavigate()
  const [agendamentos, setAgendamentos] = useState([])
  const [briefings, setBriefings] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [cancelando, setCancelando] = useState(null)
  const [respondendo, setRespondendo] = useState(null)
  const isBriefingMode = config.camposExtras === 'briefing'

  function carregar() {
    setCarregando(true)
    const promises = [appointmentsAPI.mine()]
    if (isBriefingMode) promises.push(briefingsAPI.mine())
    Promise.all(promises)
      .then(([ags, bfs]) => {
        setAgendamentos(ags.data || [])
        if (bfs) setBriefings(bfs.data || [])
      })
      .catch(() => {})
      .finally(() => setCarregando(false))
  }

  useEffect(() => { carregar() }, [])

  async function cancelar(id) {
    if (!confirm('Cancelar este agendamento?')) return
    setCancelando(id)
    try {
      await appointmentsAPI.cancel(id)
      setAgendamentos(prev => prev.map(a => a.id === id ? { ...a, status: 'cancelado' } : a))
    } catch (err) {
      alert(err.message)
    } finally {
      setCancelando(null)
    }
  }

  async function responderProposta(id, aceitar) {
    setRespondendo(id)
    try {
      await briefingsAPI.responderProposta(id, aceitar)
      setBriefings(prev => prev.map(b => b.id === id ? { ...b, status: aceitar ? 'confirmado' : 'recusado' } : b))
    } catch (err) {
      alert(err.message)
    } finally {
      setRespondendo(null)
    }
  }

  const podeCancelar = (ag) => ['pendente', 'confirmado'].includes(ag.status)

  return (
    <div className="tem-bottom-nav">
      <div className="pagina">
        <header className="pagina-titulo">
          <button className="auth-voltar" onClick={() => navigate('/home')}>← Voltar</button>
          <h2>{config.termos.historico_titulo}</h2>
        </header>

        {carregando && <p className="carregando" style={{ color: 'var(--cor-texto-fraco)' }}>Carregando...</p>}

        {/* Briefings (modo tatuador) */}
        {isBriefingMode && (
          <>
            <p className="home-secao-label" style={{ marginTop: 24 }}>MEUS BRIEFINGS</p>
            {!carregando && briefings.length === 0 && (
              <div className="alerta alerta-info">Nenhum briefing enviado ainda.</div>
            )}
            <div className="stack">
              {briefings.map((b, i) => (
                <div key={b.id} className="card history-card animar-entrada" style={{ animationDelay: `${i * 0.04}s` }}>
                  <div className="history-topo">
                    <div>
                      <p className="history-servico">{b.estilo || 'Tattoo'}</p>
                      <p className="history-data">{b.local_corpo || ''}</p>
                    </div>
                    <span className={`badge badge-${b.status === 'confirmado' ? 'concluido' : b.status === 'proposta_enviada' ? 'confirmado' : b.status === 'recusado' ? 'cancelado' : 'pendente'}`}>
                      {STATUS_BRIEFING[b.status]}
                    </span>
                  </div>
                  {b.descricao && <p className="history-notas">{b.descricao}</p>}
                  {b.foto_url && (
                    <img
                      src={b.foto_url}
                      alt="Referência"
                      style={{ maxWidth: '100%', borderRadius: 8, marginTop: 10, display: 'block' }}
                    />
                  )}
                  {b.data_proposta && (
                    <p style={{ fontWeight: 600, color: 'var(--cor-acento)', marginTop: 8 }}>
                      {b.status === 'confirmado' ? 'Confirmado: ' : 'Sua sugestão: '}
                      {new Date(b.data_proposta + 'T00:00:00').toLocaleDateString('pt-BR', {
                        weekday: 'long', day: '2-digit', month: 'long',
                      })}
                      {b.hora_proposta && ` às ${b.hora_proposta.slice(0, 5)}`}
                    </p>
                  )}
                  {b.status === 'proposta_enviada' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button
                        className="btn btn-primario"
                        style={{ flex: 1, fontSize: '0.85rem' }}
                        onClick={() => responderProposta(b.id, true)}
                        disabled={respondendo === b.id}
                      >
                        Aceitar
                      </button>
                      <button
                        className="btn btn-perigo"
                        style={{ flex: 1, fontSize: '0.85rem' }}
                        onClick={() => responderProposta(b.id, false)}
                        disabled={respondendo === b.id}
                      >
                        Recusar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Agendamentos */}
        {!isBriefingMode && !carregando && agendamentos.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--espaco-xl)' }}>
            <p style={{ color: 'var(--cor-texto-fraco)' }}>Nenhum {config.termos.servico} encontrado.</p>
          </div>
        )}

        {!isBriefingMode && (
          <div className="stack">
            {agendamentos.map((ag, i) => (
              <div key={ag.id} className="card history-card animar-entrada" style={{ animationDelay: `${i * 0.04}s` }}>
                <div className="history-topo">
                  <div>
                    <p className="history-servico">{ag.servicos?.nome}</p>
                    <p className="history-data">
                      {new Date(ag.data + 'T00:00:00').toLocaleDateString('pt-BR', {
                        weekday: 'long', day: '2-digit', month: 'long'
                      })} às {ag.hora?.slice(0, 5)}
                    </p>
                  </div>
                  <span className={`badge badge-${ag.status}`}>{ag.status}</span>
                </div>

                {ag.notas && (
                  <p className="history-notas">{ag.notas}</p>
                )}

                <div className="history-footer">
                  <span className="history-preco">R$ {Number(ag.servicos?.preco || 0).toFixed(2)}</span>
                  {podeCancelar(ag) && (
                    <button
                      className="btn btn-perigo"
                      style={{ width: 'auto', padding: '6px 14px', fontSize: '0.8rem' }}
                      onClick={() => cancelar(ag.id)}
                      disabled={cancelando === ag.id}
                    >
                      {cancelando === ag.id ? '...' : 'Cancelar'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
}
