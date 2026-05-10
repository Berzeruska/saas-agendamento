import { useState, useEffect } from 'react'
import { briefingsAPI } from '../../services/api'
import './Admin.css'

const STATUS_LABEL = {
  aguardando:       'Aguardando',
  proposta_enviada: 'Proposta enviada',
  confirmado:       'Confirmado',
  recusado:         'Recusado',
}

const STATUS_CLASS = {
  aguardando:       'badge-pendente',
  proposta_enviada: 'badge-confirmado',
  confirmado:       'badge-concluido',
  recusado:         'badge-cancelado',
}

export default function AdminBriefings() {
  const [briefings, setBriefings]         = useState([])
  const [filtroStatus, setFiltroStatus]   = useState('')
  const [selecionado, setSelecionado]     = useState(null)
  const [valorProposto, setValorProposto] = useState('')
  const [periodo, setPeriodo]             = useState('')
  const [carregando, setCarregando]       = useState(true)
  const [salvando, setSalvando]           = useState(false)
  const [erro, setErro]                   = useState('')
  const [sucesso, setSucesso]             = useState('')

  useEffect(() => {
    carregar()
  }, [filtroStatus])

  async function carregar() {
    setCarregando(true)
    setErro('')
    try {
      const { data } = await briefingsAPI.list(filtroStatus)
      setBriefings(data)
    } catch (e) {
      setErro(e.message)
    } finally {
      setCarregando(false)
    }
  }

  function abrirProposta(b) {
    setSelecionado(b)
    setValorProposto(b.valor_proposto ? String(b.valor_proposto) : '')
    setPeriodo(b.periodo_sugerido || '')
    setSucesso('')
    setErro('')
  }

  async function enviarProposta(e) {
    e.preventDefault()
    const valor = parseFloat(valorProposto)
    if (isNaN(valor) || valor <= 0) {
      setErro('Informe um valor válido')
      return
    }
    setSalvando(true)
    setErro('')
    try {
      await briefingsAPI.enviarProposta(selecionado.id, {
        valor_proposto: valor,
        periodo_sugerido: periodo,
      })
      setSucesso('Proposta enviada!')
      await carregar()
      setSelecionado(null)
    } catch (e) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="admin-pagina">
      <h2 className="admin-titulo">Briefings</h2>

      <div className="admin-filtros" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['', 'aguardando', 'proposta_enviada', 'confirmado', 'recusado'].map(s => (
          <button
            key={s}
            className={`btn ${filtroStatus === s ? 'btn-primario' : 'btn-ghost'}`}
            style={{ fontSize: 13, padding: '4px 12px' }}
            onClick={() => setFiltroStatus(s)}
          >
            {s === '' ? 'Todos' : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {erro && <div className="alerta alerta-erro">{erro}</div>}
      {sucesso && <div className="alerta alerta-sucesso">{sucesso}</div>}

      {carregando ? (
        <p className="carregando">Carregando...</p>
      ) : briefings.length === 0 ? (
        <div className="alerta alerta-info">Nenhum briefing{filtroStatus ? ` com status "${STATUS_LABEL[filtroStatus]}"` : ''}.</div>
      ) : (
        <div className="stack">
          {briefings.map(b => (
            <div key={b.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div>
                  <p style={{ fontWeight: 600 }}>{b.clientes?.nome || 'Cliente'}</p>
                  <p style={{ fontSize: 13, color: 'var(--cor-texto-fraco)' }}>{b.clientes?.telefone}</p>
                </div>
                <span className={`badge ${STATUS_CLASS[b.status] || ''}`}>{STATUS_LABEL[b.status]}</span>
              </div>

              {b.descricao && <p style={{ marginTop: 8 }}>{b.descricao}</p>}

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8, fontSize: 13 }}>
                {b.estilo        && <span><strong>Estilo:</strong> {b.estilo}</span>}
                {b.local_corpo   && <span><strong>Local:</strong> {b.local_corpo}</span>}
                {b.tamanho_aprox && <span><strong>Tamanho:</strong> {b.tamanho_aprox}</span>}
                {b.periodo_sugerido && <span><strong>Período:</strong> {b.periodo_sugerido}</span>}
              </div>

              {b.foto_url && (
                <a href={b.foto_url} target="_blank" rel="noreferrer">
                  <img
                    src={b.foto_url}
                    alt="Referência"
                    style={{ marginTop: 8, borderRadius: 8, maxHeight: 180, objectFit: 'cover', width: '100%', cursor: 'pointer' }}
                  />
                </a>
              )}

              {b.valor_proposto && (
                <p style={{ marginTop: 8, fontWeight: 600, color: 'var(--cor-acento)' }}>
                  Proposta: R$ {Number(b.valor_proposto).toFixed(2)}
                </p>
              )}

              <p style={{ fontSize: 12, color: 'var(--cor-texto-fraco)', marginTop: 8 }}>
                {new Date(b.criado_em).toLocaleString('pt-BR')}
              </p>

              {b.status === 'aguardando' && (
                <button
                  className="btn btn-primario"
                  style={{ marginTop: 12, width: '100%' }}
                  onClick={() => abrirProposta(b)}
                >
                  Enviar proposta
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal de proposta */}
      {selecionado && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 16,
          }}
          onClick={e => e.target === e.currentTarget && setSelecionado(null)}
        >
          <div style={{ background: 'var(--cor-fundo-card)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 440 }}>
            <h3 style={{ marginBottom: 16 }}>Proposta para {selecionado.clientes?.nome}</h3>
            <form onSubmit={enviarProposta} className="stack">
              <div className="input-grupo">
                <label>Valor proposto (R$) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input-campo"
                  placeholder="Ex: 500.00"
                  value={valorProposto}
                  onChange={e => setValorProposto(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="input-grupo">
                <label>Período disponível</label>
                <input
                  className="input-campo"
                  placeholder="Ex: Próxima sexta às 14h, semana que vem..."
                  value={periodo}
                  onChange={e => setPeriodo(e.target.value)}
                />
              </div>
              {erro && <div className="alerta alerta-erro">{erro}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primario" disabled={salvando} style={{ flex: 1 }}>
                  {salvando ? 'Enviando...' : 'Enviar proposta'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setSelecionado(null)} style={{ flex: 1 }}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
