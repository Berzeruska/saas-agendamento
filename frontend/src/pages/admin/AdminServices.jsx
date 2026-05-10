import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { servicesAPI } from '../../services/api'
import { config } from '../../config/index.js'
import './Admin.css'

export default function AdminServices() {
  const formVazio = { nome: '', descricao: '', preco: '', duracao_minutos: String(config.duracaoPadrao), categoria: '' }
  const navigate = useNavigate()
  const [servicos, setServicos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [form, setForm] = useState(formVazio)
  const [editandoId, setEditandoId] = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [salvando, setSalvando] = useState(false)

  async function carregar() {
    try { setServicos((await servicesAPI.list()).data) }
    catch { setErro('Erro ao carregar') }
    finally { setCarregando(false) }
  }

  useEffect(() => { carregar() }, [])

  function abrirNovo() {
    setForm(formVazio)
    setEditandoId(null)
    setMostrarForm(true)
  }

  function abrirEditar(s) {
    setForm({
      nome: s.nome,
      descricao: s.descricao || '',
      preco: String(s.preco),
      duracao_minutos: String(s.duracao_minutos),
      categoria: s.categoria || '',
    })
    setEditandoId(s.id)
    setMostrarForm(true)
  }

  async function salvar(e) {
    e.preventDefault()
    setSalvando(true)
    setErro('')
    const payload = {
      nome: form.nome,
      descricao: form.descricao,
      preco: parseFloat(form.preco),
      duracao_minutos: parseInt(form.duracao_minutos),
      categoria: form.categoria,
    }
    try {
      if (editandoId) {
        const { data } = await servicesAPI.update(editandoId, payload)
        setServicos(prev => prev.map(s => s.id === editandoId ? data : s))
      } else {
        const { data } = await servicesAPI.create(payload)
        setServicos(prev => [...prev, data])
      }
      setMostrarForm(false)
      setEditandoId(null)
    } catch (err) {
      setErro(err.message)
    } finally {
      setSalvando(false)
    }
  }

  async function deletar(id) {
    if (!confirm(`Remover este ${config.termos.servico}?`)) return
    try {
      await servicesAPI.remove(id)
      setServicos(prev => prev.filter(s => s.id !== id))
    } catch (err) {
      setErro(err.message)
    }
  }

  return (
    <div className="pagina admin-pagina">
      <header className="pagina-titulo">
        <button className="auth-voltar" onClick={() => navigate('/admin')}>← Painel</button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>{config.termos.Servicos}</h2>
          <button className="btn btn-primario" style={{ width: 'auto', padding: '8px 16px' }} onClick={abrirNovo}>
            + Novo
          </button>
        </div>
      </header>

      {erro && <div className="alerta alerta-erro" style={{ marginBottom: 'var(--espaco-md)' }}>{erro}</div>}

      {mostrarForm && (
        <form className="card stack animar-entrada" onSubmit={salvar} style={{ marginBottom: 'var(--espaco-lg)' }}>
          <p className="admin-secao-label">{editandoId ? 'EDITAR' : 'NOVO'} {config.termos.Servico.toUpperCase()}</p>
          <div className="input-grupo">
            <label>Nome</label>
            <input className="input-campo" placeholder={`Nome do ${config.termos.servico}`}
              value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} required />
          </div>
          <div className="input-grupo">
            <label>Descrição (opcional)</label>
            <input className="input-campo" placeholder="Breve descrição"
              value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} />
          </div>
          <div className="grid-2">
            <div className="input-grupo">
              <label>Preço (R$)</label>
              <input className="input-campo" type="number" step="0.01" placeholder="0.00"
                value={form.preco} onChange={e => setForm(p => ({ ...p, preco: e.target.value }))} required />
            </div>
            <div className="input-grupo">
              <label>Duração (min)</label>
              <input className="input-campo" type="number"
                value={form.duracao_minutos} onChange={e => setForm(p => ({ ...p, duracao_minutos: e.target.value }))} required />
            </div>
          </div>
          <div className="input-grupo">
            <label>Categoria (opcional)</label>
            <input className="input-campo" placeholder={`Ex: ${config.termos.servicos_exemplo || config.termos.servicos}`}
              value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))} />
          </div>
          <div className="grid-2">
            <button type="submit" className="btn btn-primario" disabled={salvando}>
              {salvando ? '...' : editandoId ? 'Salvar alterações' : 'Criar'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setMostrarForm(false)}>Cancelar</button>
          </div>
        </form>
      )}

      {carregando && <p className="carregando" style={{ color: 'var(--cor-texto-fraco)' }}>Carregando...</p>}

      <div className="stack">
        {servicos.map(s => (
          <div key={s.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700 }}>{s.nome}</p>
              {s.descricao && <p style={{ fontSize: '0.82rem', color: 'var(--cor-texto-fraco)' }}>{s.descricao}</p>}
              <p style={{ fontSize: '0.8rem', color: 'var(--cor-texto-fraco)' }}>
                ⏱ {s.duracao_minutos} min
                {s.categoria && ` · ${s.categoria}`}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--espaco-sm)' }}>
              <span style={{ fontFamily: 'var(--fonte-display)', fontSize: '1.3rem', color: 'var(--cor-acento)' }}>
                R$ {Number(s.preco).toFixed(2)}
              </span>
              <div style={{ display: 'flex', gap: 'var(--espaco-xs)' }}>
                <button onClick={() => abrirEditar(s)}
                  style={{ background: 'transparent', border: '1px solid var(--cor-borda)', borderRadius: 'var(--raio-sm)', padding: '4px 10px', color: 'var(--cor-texto-fraco)', cursor: 'pointer', fontSize: '0.8rem' }}>
                  ✏
                </button>
                <button onClick={() => deletar(s.id)}
                  style={{ background: 'transparent', border: '1px solid var(--cor-erro)', borderRadius: 'var(--raio-sm)', padding: '4px 10px', color: 'var(--cor-erro)', cursor: 'pointer', fontSize: '0.8rem' }}>
                  🗑
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
