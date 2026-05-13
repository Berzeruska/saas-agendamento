import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { briefingsAPI } from '../../services/api'
import HelpBox from '../../components/HelpBox'
import './Admin.css'

function whatsappUrl(telefone) {
  const num = (telefone || '').replace(/\D/g, '')
  return `https://wa.me/55${num}`
}

export default function AdminHistorico() {
  const navigate = useNavigate()
  const [briefings, setBriefings] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    briefingsAPI.historico()
      .then(({ data }) => setBriefings(data || []))
      .catch(() => {})
      .finally(() => setCarregando(false))
  }, [])

  const filtrados = busca
    ? briefings.filter(b =>
        (b.clientes?.nome || '').toLowerCase().includes(busca.toLowerCase()) ||
        (b.estilo || '').toLowerCase().includes(busca.toLowerCase())
      )
    : briefings

  return (
    <div className="pagina admin-pagina">
      <header className="pagina-titulo">
        <button className="auth-voltar" onClick={() => navigate('/admin')}>← Painel</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2>Histórico</h2>
          <HelpBox texto="Todos os trabalhos concluídos e pagos. Consulte clientes antigos e valores recebidos." />
        </div>
        <p style={{ color: 'var(--cor-texto-fraco)', fontSize: '0.85rem' }}>
          {briefings.length} trabalhos
        </p>
      </header>

      <div className="input-grupo" style={{ marginBottom: 'var(--espaco-lg)' }}>
        <input
          className="input-campo"
          type="text"
          placeholder="Buscar por cliente ou estilo..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      {carregando && (
        <p className="carregando" style={{ color: 'var(--cor-texto-fraco)' }}>Carregando...</p>
      )}

      {!carregando && filtrados.length === 0 && (
        <div className="alerta alerta-info">Nenhum trabalho concluído ainda.</div>
      )}

      <div className="stack">
        {filtrados.map((b, i) => (
          <div
            key={b.id}
            className="card animar-entrada"
            style={{ animationDelay: `${i * 0.03}s`, padding: '14px 16px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 2 }}>
                  {b.clientes?.nome || 'Cliente'}
                </p>
                <p style={{ fontSize: '0.78rem', color: 'var(--cor-texto-fraco)', marginBottom: 4 }}>
                  {b.estilo || 'Tattoo'}
                  {b.local_corpo ? ` · ${b.local_corpo}` : ''}
                </p>
                {b.data_proposta && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--cor-texto-fraco)' }}>
                    {new Date(b.data_proposta + 'T00:00:00').toLocaleDateString('pt-BR', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                    {b.hora_proposta && ` · ${b.hora_proposta.slice(0, 5)}`}
                  </p>
                )}
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {b.valor_combinado ? (
                  <p style={{ fontWeight: 700, color: 'var(--cor-sucesso)', fontSize: '1rem', marginBottom: 4 }}>
                    R$ {Number(b.valor_combinado).toFixed(2)}
                  </p>
                ) : (
                  <p style={{ fontSize: '0.75rem', color: 'var(--cor-texto-fraco)', marginBottom: 4 }}>Sem valor</p>
                )}
                <span className={`badge ${b.status === 'concluido' ? 'badge-cancelado' : 'badge-concluido'}`}
                  style={{ fontSize: '0.62rem' }}>
                  {b.status === 'concluido' ? 'Concluído' : 'Pago'}
                </span>
              </div>
            </div>

            {b.clientes?.telefone && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--cor-borda)', display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--cor-texto-fraco)', flex: 1 }}>
                  {b.clientes.telefone}
                </span>
                <a
                  href={whatsappUrl(b.clientes.telefone)}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: '0.72rem', fontWeight: 700, color: '#25D366',
                    border: '1px solid #25D366', borderRadius: 6,
                    padding: '3px 10px', textDecoration: 'none', whiteSpace: 'nowrap',
                  }}
                >
                  WhatsApp
                </a>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
