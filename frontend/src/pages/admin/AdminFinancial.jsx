import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ordersAPI } from '../../services/api'
import './Admin.css'

export default function AdminFinancial() {
  const navigate = useNavigate()
  const [pedidos, setPedidos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [filtro, setFiltro] = useState('todos')

  useEffect(() => {
    ordersAPI.list()
      .then(({ data }) => setPedidos(data))
      .catch(console.error)
      .finally(() => setCarregando(false))
  }, [])

  async function confirmar(id) {
    try {
      await ordersAPI.confirm(id)
      setPedidos(prev => prev.map(p => p.id === id ? { ...p, status_pagamento: 'pago' } : p))
    } catch (err) {
      alert(err.message)
    }
  }

  const filtrados = pedidos.filter(p => filtro === 'todos' || p.status_pagamento === filtro)
  const totalPago = pedidos.filter(p => p.status_pagamento === 'pago').reduce((s, p) => s + p.total, 0)
  const totalPendente = pedidos.filter(p => p.status_pagamento === 'pendente').reduce((s, p) => s + p.total, 0)

  return (
    <div className="pagina admin-pagina">
      <header className="pagina-titulo">
        <button className="auth-voltar" onClick={() => navigate('/admin')}>← Painel</button>
        <h2>Financeiro</h2>
      </header>

      <div className="admin-stats animar-entrada" style={{ marginBottom: 'var(--espaco-lg)', gridTemplateColumns: '1fr 1fr' }}>
        <div className="admin-stat-card">
          <span className="admin-stat-numero" style={{ color: 'var(--cor-sucesso)', fontSize: '1.4rem' }}>
            R$ {totalPago.toFixed(2)}
          </span>
          <span className="admin-stat-label">Recebido</span>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-numero" style={{ color: 'var(--cor-aviso)', fontSize: '1.4rem' }}>
            R$ {totalPendente.toFixed(2)}
          </span>
          <span className="admin-stat-label">Pendente</span>
        </div>
      </div>

      <div className="admin-filtros animar-entrada delay-1">
        {['todos', 'pendente', 'pago'].map(f => (
          <button key={f} className={`admin-filtro-btn ${filtro === f ? 'ativo' : ''}`} onClick={() => setFiltro(f)}>
            {f === 'todos' ? 'Todos' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {carregando && <p className="carregando" style={{ color: 'var(--cor-texto-fraco)' }}>Carregando...</p>}

      {!carregando && filtrados.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--espaco-xl)' }}>
          <p style={{ color: 'var(--cor-texto-fraco)' }}>Nenhum pedido encontrado.</p>
        </div>
      )}

      <div className="stack">
        {filtrados.map((pedido, i) => (
          <div key={pedido.id} className="card animar-entrada" style={{ animationDelay: `${i * 0.04}s` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--espaco-sm)' }}>
              <div>
                <p style={{ fontWeight: 700 }}>{pedido.clientes?.nome}</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--cor-texto-fraco)' }}>
                  {new Date(pedido.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  {pedido.metodo_pagamento && ` · ${pedido.metodo_pagamento.toUpperCase()}`}
                </p>
              </div>
              <span className={`badge badge-${pedido.status_pagamento}`}>{pedido.status_pagamento}</span>
            </div>

            {pedido.pedido_itens?.map((item, j) => (
              <p key={j} style={{ fontSize: '0.82rem', color: 'var(--cor-texto-fraco)' }}>
                {item.produtos?.nome} × {item.quantidade} = R$ {(item.preco_unitario * item.quantidade).toFixed(2)}
              </p>
            ))}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--espaco-sm)' }}>
              <span style={{ fontFamily: 'var(--fonte-display)', fontSize: '1.5rem', color: 'var(--cor-acento)' }}>
                R$ {Number(pedido.total).toFixed(2)}
              </span>
              {pedido.status_pagamento === 'pendente' && (
                <button className="btn btn-primario" style={{ width: 'auto', padding: '8px 16px', fontSize: '0.85rem' }}
                  onClick={() => confirmar(pedido.id)}>
                  ✓ Confirmar pagamento
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
