import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { productsAPI } from '../../services/api'
import './Admin.css'

export default function AdminStock() {
  const navigate = useNavigate()
  const [produtos, setProdutos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState({ nome: '', preco: '', quantidade: '', alerta_minimo: '5' })
  const [salvando, setSalvando] = useState(false)

  async function carregar() {
    try { setProdutos((await productsAPI.list()).data) }
    catch { setErro('Erro ao carregar estoque') }
    finally { setCarregando(false) }
  }

  useEffect(() => { carregar() }, [])

  async function ajustar(id, delta) {
    const prod = produtos.find(p => p.id === id)
    const nova = Math.max(0, prod.quantidade + delta)
    try {
      await productsAPI.updateStock(id, nova)
      setProdutos(prev => prev.map(p => p.id === id ? { ...p, quantidade: nova } : p))
    } catch { setErro('Erro ao atualizar') }
  }

  async function deletar(id) {
    if (!confirm('Remover produto?')) return
    try {
      await productsAPI.remove(id)
      setProdutos(prev => prev.filter(p => p.id !== id))
    } catch { setErro('Erro ao remover') }
  }

  async function salvar(e) {
    e.preventDefault()
    setSalvando(true)
    try {
      const { data } = await productsAPI.create({
        nome: form.nome,
        preco: parseFloat(form.preco),
        quantidade: parseInt(form.quantidade),
        alerta_minimo: parseInt(form.alerta_minimo),
      })
      setProdutos(prev => [...prev, data])
      setForm({ nome: '', preco: '', quantidade: '', alerta_minimo: '5' })
      setMostrarForm(false)
    } catch (err) {
      setErro(err.message)
    } finally {
      setSalvando(false)
    }
  }

  const alertas = produtos.filter(p => p.quantidade <= p.alerta_minimo)

  return (
    <div className="pagina admin-pagina">
      <header className="pagina-titulo">
        <button className="auth-voltar" onClick={() => navigate('/admin')}>← Painel</button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Estoque</h2>
          <button className="btn btn-primario" style={{ width: 'auto', padding: '8px 16px' }}
            onClick={() => setMostrarForm(v => !v)}>
            + Produto
          </button>
        </div>
      </header>

      {alertas.length > 0 && (
        <div className="alerta alerta-aviso" style={{ marginBottom: 'var(--espaco-lg)' }}>
          ⚠️ Estoque baixo: {alertas.map(p => `${p.nome} (${p.quantidade})`).join(' · ')}
        </div>
      )}

      {erro && <div className="alerta alerta-erro" style={{ marginBottom: 'var(--espaco-md)' }}>{erro}</div>}

      {mostrarForm && (
        <form className="card stack animar-entrada" onSubmit={salvar} style={{ marginBottom: 'var(--espaco-lg)' }}>
          <p className="admin-secao-label">NOVO PRODUTO</p>
          <div className="input-grupo">
            <label>Nome</label>
            <input className="input-campo" placeholder="Nome do produto" value={form.nome}
              onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} required />
          </div>
          <div className="grid-2">
            <div className="input-grupo">
              <label>Preço (R$)</label>
              <input className="input-campo" type="number" step="0.01" placeholder="0.00" value={form.preco}
                onChange={e => setForm(p => ({ ...p, preco: e.target.value }))} required />
            </div>
            <div className="input-grupo">
              <label>Quantidade</label>
              <input className="input-campo" type="number" placeholder="0" value={form.quantidade}
                onChange={e => setForm(p => ({ ...p, quantidade: e.target.value }))} required />
            </div>
          </div>
          <div className="input-grupo">
            <label>Alerta quando abaixo de</label>
            <input className="input-campo" type="number" value={form.alerta_minimo}
              onChange={e => setForm(p => ({ ...p, alerta_minimo: e.target.value }))} />
          </div>
          <div className="grid-2">
            <button type="submit" className="btn btn-primario" disabled={salvando}>
              {salvando ? '...' : 'Salvar'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setMostrarForm(false)}>Cancelar</button>
          </div>
        </form>
      )}

      {carregando && <p className="carregando" style={{ color: 'var(--cor-texto-fraco)' }}>Carregando...</p>}

      <div className="stack">
        {produtos.map(prod => {
          const alerta = prod.quantidade <= prod.alerta_minimo
          return (
            <div key={prod.id} className={`card admin-estoque-card ${alerta ? 'admin-estoque-alerta' : ''}`}>
              <div className="admin-estoque-info">
                <p className="admin-estoque-nome">{prod.nome}</p>
                <p className="admin-estoque-preco">R$ {Number(prod.preco).toFixed(2)}</p>
                {alerta && <span className="badge badge-pendente" style={{ marginTop: '4px' }}>Estoque baixo</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--espaco-sm)' }}>
                <div className="admin-estoque-controles">
                  <button className="produtos-btn-qtd" onClick={() => ajustar(prod.id, -1)}>−</button>
                  <span className={`admin-estoque-qtd ${alerta ? 'alerta' : ''}`}>{prod.quantidade}</span>
                  <button className="produtos-btn-qtd produtos-btn-add" onClick={() => ajustar(prod.id, +1)}>+</button>
                </div>
                <button onClick={() => deletar(prod.id)}
                  style={{ background: 'transparent', border: '1px solid var(--cor-erro)', borderRadius: 'var(--raio-sm)', color: 'var(--cor-erro)', padding: '6px 10px', cursor: 'pointer' }}>
                  🗑
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
