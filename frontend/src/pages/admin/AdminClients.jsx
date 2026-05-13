import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminAPI } from '../../services/api'
import HelpBox from '../../components/HelpBox'
import './Admin.css'

const STATUS_LABEL = {
  aguardando:       'Aguardando',
  proposta_enviada: 'Proposta enviada',
  confirmado:       'Confirmado',
  recusado:         'Recusado',
  cancelado:        'Cancelado',
  concluido:        'Concluído',
}

const STATUS_CLASS = {
  aguardando:       'badge-pendente',
  proposta_enviada: 'badge-confirmado',
  confirmado:       'badge-concluido',
  recusado:         'badge-cancelado',
  cancelado:        'badge-cancelado',
  concluido:        'badge-cancelado',
}

function whatsappUrl(telefone) {
  const num = (telefone || '').replace(/\D/g, '')
  return `https://wa.me/55${num}`
}

function formatarTel(t) {
  if (!t) return ''
  const d = t.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return t
}

export default function AdminClients() {
  const navigate = useNavigate()
  const [clientes, setClientes]         = useState([])
  const [filtro, setFiltro]             = useState('')
  const [carregando, setCarregando]     = useState(true)
  const [expandido, setExpandido]       = useState(null)
  const [historico, setHistorico]       = useState({})
  const [loadingHist, setLoadingHist]   = useState(false)

  useEffect(() => {
    adminAPI.clients()
      .then(({ data }) => setClientes(data || []))
      .catch(console.error)
      .finally(() => setCarregando(false))
  }, [])

  const filtrados = clientes.filter(c => {
    const q = filtro.toLowerCase()
    return c.nome.toLowerCase().includes(q) ||
      (c.telefone || '').replace(/\D/g, '').includes(q.replace(/\D/g, ''))
  })

  async function toggleCard(c) {
    if (expandido === c.id) {
      setExpandido(null)
      return
    }
    setExpandido(c.id)
    if (historico[c.id]) return // cached
    setLoadingHist(true)
    try {
      const { data } = await adminAPI.clientBriefings(c.id)
      setHistorico(prev => ({ ...prev, [c.id]: data }))
    } catch {
      setHistorico(prev => ({ ...prev, [c.id]: [] }))
    } finally {
      setLoadingHist(false)
    }
  }

  async function toggleAtivo(e, clienteId, ativo) {
    e.stopPropagation()
    try {
      const { data } = await adminAPI.toggleClient(clienteId)
      setClientes(prev => prev.map(c => c.id === clienteId ? { ...c, ativo: data.ativo } : c))
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="pagina admin-pagina">
      <header className="pagina-titulo">
        <button className="auth-voltar" onClick={() => navigate('/admin')}>← Painel</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2>Clientes</h2>
          <HelpBox texto="Lista de todos os clientes cadastrados. Clique para ver histórico de sessões e contato direto via WhatsApp." />
        </div>
        <p style={{ color: 'var(--cor-texto-fraco)', fontSize: '0.85rem' }}>
          {clientes.length} cadastrados
        </p>
      </header>

      <div className="input-grupo" style={{ marginBottom: 'var(--espaco-lg)' }}>
        <input
          className="input-campo"
          type="text"
          placeholder="Buscar por nome ou telefone..."
          value={filtro}
          onChange={e => setFiltro(e.target.value)}
        />
      </div>

      {carregando && <p className="carregando" style={{ color: 'var(--cor-texto-fraco)' }}>Carregando...</p>}
      {!carregando && filtrados.length === 0 && (
        <div className="alerta alerta-aviso">Nenhum cliente encontrado.</div>
      )}

      <div className="stack">
        {filtrados.map((c, i) => (
          <div
            key={c.id}
            className="card animar-entrada"
            style={{ animationDelay: `${i * 0.03}s`, cursor: 'pointer' }}
            onClick={() => toggleCard(c)}
          >
            {/* Linha principal */}
            <div className="admin-cliente-card" style={{ padding: 0 }}>
              <div className="admin-cliente-avatar">
                {c.nome.charAt(0).toUpperCase()}
              </div>

              <div className="admin-cliente-info">
                <p className="admin-cliente-nome">{c.nome}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <p className="admin-cliente-tel">{formatarTel(c.telefone)}</p>
                  {c.telefone && (
                    <a
                      href={whatsappUrl(c.telefone)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: '#25D366',
                        border: '1px solid #25D366',
                        borderRadius: 6,
                        padding: '1px 7px',
                        textDecoration: 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      WhatsApp
                    </a>
                  )}
                </div>
                <p className="admin-cliente-data">
                  Desde {new Date(c.data_cadastro).toLocaleDateString('pt-BR')}
                </p>
              </div>

              {!c.ativo && <span className="badge badge-cancelado">Inativo</span>}
            </div>

            {/* Perfil expandido */}
            {expandido === c.id && (
              <div
                className="stack"
                style={{
                  marginTop: 'var(--espaco-md)',
                  borderTop: '1px solid var(--cor-borda)',
                  paddingTop: 'var(--espaco-md)',
                }}
                onClick={e => e.stopPropagation()}
              >
                <p className="admin-secao-label">HISTÓRICO DE SOLICITAÇÕES</p>

                {loadingHist && !historico[c.id] ? (
                  <p style={{ color: 'var(--cor-texto-fraco)', fontSize: '0.82rem' }}>Carregando...</p>
                ) : !historico[c.id] || historico[c.id].length === 0 ? (
                  <p style={{ color: 'var(--cor-texto-fraco)', fontSize: '0.82rem' }}>
                    Nenhuma solicitação ainda.
                  </p>
                ) : (
                  <div className="stack" style={{ gap: 6 }}>
                    {historico[c.id].map(b => (
                      <div
                        key={b.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: 'var(--cor-fundo-input)',
                          borderRadius: 8,
                          padding: '8px 12px',
                          gap: 8,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                            {b.estilo || 'Tatuagem'}
                            {b.local_corpo ? ` · ${b.local_corpo}` : ''}
                          </p>
                          <p style={{ fontSize: '0.72rem', color: 'var(--cor-texto-fraco)', marginTop: 2 }}>
                            {new Date(b.criado_em).toLocaleDateString('pt-BR')}
                            {b.data_proposta && (
                              <> → {new Date(b.data_proposta + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</>
                            )}
                          </p>
                        </div>
                        <span
                          className={`badge ${STATUS_CLASS[b.status] || 'badge-pendente'}`}
                          style={{ fontSize: '0.62rem', flexShrink: 0 }}
                        >
                          {STATUS_LABEL[b.status] || b.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  className={`btn ${c.ativo ? 'btn-perigo' : 'btn-secundario'}`}
                  style={{ padding: '8px', fontSize: '0.8rem', marginTop: 8 }}
                  onClick={e => toggleAtivo(e, c.id, c.ativo)}
                >
                  {c.ativo ? '🚫 Bloquear cliente' : '✓ Reativar cliente'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
