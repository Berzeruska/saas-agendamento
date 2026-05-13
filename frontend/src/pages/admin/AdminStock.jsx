import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { productsAPI, adminAPI } from '../../services/api'
import HelpBox from '../../components/HelpBox'
import './Admin.css'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const HELP_ESTOQUE = 'Itens do seu estúdio. Mantenha atualizado para saber quando repor.'
const HELP_USADOS  = 'Materiais consumidos em cada sessão. Registrado automaticamente ao concluir pagamento.'

export default function AdminStock() {
  const navigate = useNavigate()
  const [aba, setAba] = useState('estoque')

  // ── Aba Estoque ──────────────────────────────────────────
  const [produtos, setProdutos]     = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro]             = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm]             = useState({ nome: '', preco: '', quantidade: '', alerta_minimo: '5' })
  const [salvando, setSalvando]     = useState(false)

  // ── Aba Usados ───────────────────────────────────────────
  const hojeDate = new Date()
  const [mesU, setMesU]             = useState(hojeDate.getMonth() + 1)
  const [anoU, setAnoU]             = useState(hojeDate.getFullYear())
  const [gastos, setGastos]         = useState([])
  const [carregandoU, setCarregandoU] = useState(false)

  useEffect(() => {
    productsAPI.list()
      .then(({ data }) => setProdutos(data))
      .catch(() => setErro('Erro ao carregar estoque'))
      .finally(() => setCarregando(false))
  }, [])

  useEffect(() => {
    if (aba !== 'usados') return
    setCarregandoU(true)
    adminAPI.listGastos(mesU, anoU)
      .then(({ data }) => setGastos(data || []))
      .catch(() => setGastos([]))
      .finally(() => setCarregandoU(false))
  }, [aba, mesU, anoU])

  function navMesU(delta) {
    let m = mesU + delta, a = anoU
    if (m > 12) { m = 1; a++ }
    if (m < 1)  { m = 12; a-- }
    setMesU(m); setAnoU(a)
  }

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

  function stepInt(field, delta, min = 0) {
    setForm(p => ({ ...p, [field]: String(Math.max(min, (parseInt(p[field], 10) || 0) + delta)) }))
  }

  async function salvar(e) {
    e.preventDefault()
    const preco = parseFloat((form.preco || '').replace(',', '.'))
    if (isNaN(preco) || preco < 0) { setErro('Preço inválido'); return }
    setSalvando(true)
    try {
      const { data } = await productsAPI.create({
        nome:          form.nome.trim(),
        preco,
        quantidade:    parseInt(form.quantidade, 10) || 0,
        alerta_minimo: parseInt(form.alerta_minimo, 10) || 0,
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
  const totalGastos = gastos.reduce((s, g) => s + Number(g.valor || 0), 0)

  return (
    <div className="pagina admin-pagina">
      <header className="pagina-titulo">
        <button className="auth-voltar" onClick={() => navigate('/admin')}>← Painel</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2>Materiais</h2>
          <HelpBox texto={aba === 'estoque' ? HELP_ESTOQUE : HELP_USADOS} />
        </div>
        {aba === 'estoque' && (
          <button className="btn btn-primario" style={{ width: 'auto', padding: '8px 16px' }}
            onClick={() => setMostrarForm(v => !v)}>
            + Item
          </button>
        )}
      </header>

      {/* Abas */}
      <div className="admin-filtros" style={{ marginBottom: 'var(--espaco-lg)' }}>
        <button className={`admin-filtro-btn ${aba === 'estoque' ? 'ativo' : ''}`} onClick={() => setAba('estoque')}>
          Estoque
        </button>
        <button className={`admin-filtro-btn ${aba === 'usados' ? 'ativo' : ''}`} onClick={() => setAba('usados')}>
          Usados
        </button>
      </div>

      {/* ── ABA ESTOQUE ───────────────────────────────────── */}
      {aba === 'estoque' && (
        <>
          {alertas.length > 0 && (
            <div className="alerta alerta-aviso" style={{ marginBottom: 'var(--espaco-lg)' }}>
              ⚠️ Estoque baixo: {alertas.map(p => `${p.nome} (${p.quantidade})`).join(' · ')}
            </div>
          )}

          {erro && <div className="alerta alerta-erro" style={{ marginBottom: 'var(--espaco-md)' }}>{erro}</div>}

          {mostrarForm && (
            <form className="card stack animar-entrada" onSubmit={salvar} style={{ marginBottom: 'var(--espaco-lg)' }}>
              <p className="admin-secao-label">NOVO ITEM</p>

              {/* Nome */}
              <div className="input-grupo">
                <label>Nome</label>
                <input className="input-campo" placeholder="Nome do item" value={form.nome}
                  onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} required />
              </div>

              {/* Preço + Quantidade */}
              <div className="grid-2">
                <div className="input-grupo">
                  <label>Preço (R$)</label>
                  <input
                    className="input-campo"
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={form.preco}
                    onChange={e => setForm(p => ({ ...p, preco: e.target.value.replace(/[^0-9.,]/g, '') }))}
                    required
                  />
                </div>
                <div className="input-grupo">
                  <label>Quantidade</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button type="button" onClick={() => stepInt('quantidade', -1)}
                      style={{ width: 38, height: 44, borderRadius: 'var(--raio-md)', flexShrink: 0, background: 'var(--cor-fundo-input)', border: '1.5px solid var(--cor-borda)', color: 'var(--cor-texto)', fontSize: '1.1rem', cursor: 'pointer' }}>−</button>
                    <input
                      className="input-campo"
                      type="text"
                      inputMode="numeric"
                      value={form.quantidade}
                      onChange={e => setForm(p => ({ ...p, quantidade: e.target.value.replace(/\D/g, '') }))}
                      style={{ textAlign: 'center', minWidth: 0 }}
                      required
                    />
                    <button type="button" onClick={() => stepInt('quantidade', 1)}
                      style={{ width: 38, height: 44, borderRadius: 'var(--raio-md)', flexShrink: 0, background: 'var(--cor-acento)', border: 'none', color: '#fff', fontSize: '1.1rem', cursor: 'pointer' }}>+</button>
                  </div>
                </div>
              </div>

              {/* Alerta mínimo */}
              <div className="input-grupo">
                <label>Alerta quando abaixo de</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button type="button" onClick={() => stepInt('alerta_minimo', -1)}
                    style={{ width: 38, height: 44, borderRadius: 'var(--raio-md)', flexShrink: 0, background: 'var(--cor-fundo-input)', border: '1.5px solid var(--cor-borda)', color: 'var(--cor-texto)', fontSize: '1.1rem', cursor: 'pointer' }}>−</button>
                  <input
                    className="input-campo"
                    type="text"
                    inputMode="numeric"
                    value={form.alerta_minimo}
                    onChange={e => setForm(p => ({ ...p, alerta_minimo: e.target.value.replace(/\D/g, '') }))}
                    style={{ textAlign: 'center', minWidth: 0 }}
                  />
                  <button type="button" onClick={() => stepInt('alerta_minimo', 1)}
                    style={{ width: 38, height: 44, borderRadius: 'var(--raio-md)', flexShrink: 0, background: 'var(--cor-acento)', border: 'none', color: '#fff', fontSize: '1.1rem', cursor: 'pointer' }}>+</button>
                </div>
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
            {!carregando && produtos.length === 0 && (
              <div className="alerta alerta-info">Nenhum item cadastrado.</div>
            )}
            {produtos.map(prod => {
              const alerta = prod.quantidade <= prod.alerta_minimo
              return (
                <div key={prod.id} className={`card admin-estoque-card ${alerta ? 'admin-estoque-alerta' : ''}`}>
                  <div className="admin-estoque-info">
                    <p className="admin-estoque-nome">{prod.nome}</p>
                    <p className="admin-estoque-preco">R$ {Number(prod.preco).toFixed(2)}</p>
                    {alerta && <span className="badge badge-pendente" style={{ marginTop: 4 }}>Estoque baixo</span>}
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
        </>
      )}

      {/* ── ABA USADOS ────────────────────────────────────── */}
      {aba === 'usados' && (
        <>
          {/* Seletor de mês */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 'var(--espaco-lg)', justifyContent: 'center' }}>
            <button className="btn btn-ghost" style={{ padding: '6px 16px', fontSize: '1.1rem', width: 'auto' }}
              onClick={() => navMesU(-1)}>‹</button>
            <p style={{ fontWeight: 700, fontSize: '0.9rem', minWidth: 160, textAlign: 'center' }}>
              {MESES[mesU - 1]} {anoU}
            </p>
            <button className="btn btn-ghost" style={{ padding: '6px 16px', fontSize: '1.1rem', width: 'auto' }}
              onClick={() => navMesU(1)}>›</button>
          </div>

          {/* Total do mês */}
          {!carregandoU && gastos.length > 0 && (
            <div className="admin-stat-card animar-entrada" style={{ marginBottom: 'var(--espaco-lg)', textAlign: 'center' }}>
              <span className="admin-stat-numero" style={{ color: 'var(--cor-erro)', fontSize: '1.3rem' }}>
                R$ {totalGastos.toFixed(2)}
              </span>
              <span className="admin-stat-label">Total gasto no mês</span>
            </div>
          )}

          {carregandoU && (
            <p className="carregando" style={{ color: 'var(--cor-texto-fraco)' }}>Carregando...</p>
          )}

          {!carregandoU && gastos.length === 0 && (
            <div className="alerta alerta-info">Nenhum gasto registrado neste mês.</div>
          )}

          <div className="stack">
            {gastos.map((g, i) => (
              <div key={g.id} className="card animar-entrada" style={{ animationDelay: `${i * 0.03}s`, padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 2 }}>
                      {g.descricao || 'Materiais'}
                    </p>
                    <p style={{ fontSize: '0.72rem', color: 'var(--cor-texto-fraco)' }}>
                      {new Date(g.criado_em).toLocaleDateString('pt-BR', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <span style={{ fontWeight: 700, color: 'var(--cor-erro)', fontSize: '1rem', flexShrink: 0 }}>
                    − R$ {Number(g.valor).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
