import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminAPI } from '../../services/api'
import './Admin.css'

function formatarTelefone(t) {
  if (!t) return ''
  const d = t.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return t
}

export default function AdminClients() {
  const navigate = useNavigate()
  const [clientes, setClientes] = useState([])
  const [filtro, setFiltro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [expandido, setExpandido] = useState(null)
  const [editandoNota, setEditandoNota] = useState(null)
  const [notaTexto, setNotaTexto] = useState('')

  useEffect(() => {
    adminAPI.clients()
      .then(({ data }) => setClientes(data))
      .catch(console.error)
      .finally(() => setCarregando(false))
  }, [])

  const filtrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(filtro.toLowerCase()) ||
    (c.telefone || '').includes(filtro.replace(/\D/g, ''))
  )

  async function salvarNota(clienteId) {
    try {
      await adminAPI.updateNotes(clienteId, notaTexto)
      setClientes(prev => prev.map(c => c.id === clienteId ? { ...c, notas_admin: notaTexto } : c))
      setEditandoNota(null)
    } catch (err) {
      alert(err.message)
    }
  }

  async function toggleAtivo(clienteId) {
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
        <h2>Clientes</h2>
        <p style={{ color: 'var(--cor-texto-fraco)', fontSize: '0.85rem' }}>{clientes.length} cadastrados</p>
      </header>

      <div className="input-grupo" style={{ marginBottom: 'var(--espaco-lg)' }}>
        <input className="input-campo" type="text" placeholder="🔍 Buscar por nome ou telefone..."
          value={filtro} onChange={e => setFiltro(e.target.value)} />
      </div>

      {carregando && <p className="carregando" style={{ color: 'var(--cor-texto-fraco)' }}>Carregando...</p>}
      {!carregando && filtrados.length === 0 && <div className="alerta alerta-aviso">Nenhum cliente encontrado.</div>}

      <div className="stack">
        {filtrados.map((c, i) => (
          <div key={c.id} className="card animar-entrada" style={{ animationDelay: `${i * 0.03}s`, cursor: 'pointer' }}
            onClick={() => setExpandido(expandido === c.id ? null : c.id)}>

            <div className="admin-cliente-card" style={{ padding: 0 }}>
              <div className="admin-cliente-avatar">{c.nome.charAt(0).toUpperCase()}</div>
              <div className="admin-cliente-info">
                <p className="admin-cliente-nome">{c.nome}</p>
                <p className="admin-cliente-tel">{formatarTelefone(c.telefone)}</p>
                <p className="admin-cliente-data">
                  Desde {new Date(c.data_cadastro).toLocaleDateString('pt-BR')}
                </p>
              </div>
              {!c.ativo && <span className="badge badge-cancelado">Inativo</span>}
            </div>

            {/* Detalhes expandidos */}
            {expandido === c.id && (
              <div className="stack" style={{ marginTop: 'var(--espaco-md)', borderTop: '1px solid var(--cor-borda)', paddingTop: 'var(--espaco-md)' }}
                onClick={e => e.stopPropagation()}>

                {editandoNota === c.id ? (
                  <>
                    <textarea className="input-campo" rows={3} placeholder="Observações sobre o cliente..."
                      value={notaTexto} onChange={e => setNotaTexto(e.target.value)} />
                    <div className="grid-2">
                      <button className="btn btn-primario" style={{ padding: '8px' }} onClick={() => salvarNota(c.id)}>Salvar</button>
                      <button className="btn btn-ghost" style={{ padding: '8px' }} onClick={() => setEditandoNota(null)}>Cancelar</button>
                    </div>
                  </>
                ) : (
                  <>
                    {c.notas_admin && <p style={{ fontSize: '0.85rem', color: 'var(--cor-texto-fraco)', fontStyle: 'italic' }}>{c.notas_admin}</p>}
                    <div className="grid-2">
                      <button className="btn btn-ghost" style={{ padding: '8px', fontSize: '0.8rem' }}
                        onClick={() => { setEditandoNota(c.id); setNotaTexto(c.notas_admin || '') }}>
                        ✏ {c.notas_admin ? 'Editar nota' : 'Adicionar nota'}
                      </button>
                      <button className={`btn ${c.ativo ? 'btn-perigo' : 'btn-secundario'}`}
                        style={{ padding: '8px', fontSize: '0.8rem' }} onClick={() => toggleAtivo(c.id)}>
                        {c.ativo ? '🚫 Bloquear' : '✓ Reativar'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
