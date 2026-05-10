import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCart } from '../contexts/CartContext'
import { ordersAPI } from '../services/api'
import BottomNav from '../components/layout/BottomNav'
import './Payment.css'

export default function Payment() {
  const navigate = useNavigate()
  const { cliente } = useAuth()
  const { itens, total, limpar } = useCart()
  const [metodo, setMetodo] = useState('pix')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  async function finalizar() {
    if (!itens.length) return
    setErro('')
    setCarregando(true)
    try {
      await ordersAPI.create({
        itens: itens.map(i => ({
          produto_id: i.id,
          quantidade: i.quantidade,
          preco_unitario: i.preco,
        })),
        total: round2(total),
        metodo_pagamento: metodo,
      })
      limpar()
      setSucesso(true)
    } catch (err) {
      setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }

  function round2(n) { return Math.round(n * 100) / 100 }

  if (!itens.length && !sucesso) {
    return (
      <div className="tem-bottom-nav">
        <div className="pagina">
          <header className="pagina-titulo">
            <button className="auth-voltar" onClick={() => navigate('/produtos')}>← Voltar</button>
            <h2>Pagamento</h2>
          </header>
          <div className="alerta alerta-aviso">Seu carrinho está vazio.</div>
        </div>
        <BottomNav />
      </div>
    )
  }

  if (sucesso) {
    return (
      <div className="tem-bottom-nav">
        <div className="pagina">
          <div className="booking-sucesso animar-entrada">
            <div className="booking-sucesso-icone">✓</div>
            <h2>Pedido feito!</h2>
            <p>Seu pedido foi registrado. O pagamento será confirmado pelo atendente.</p>
            <button className="btn btn-primario" onClick={() => navigate('/home')}>Voltar ao início</button>
          </div>
        </div>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="tem-bottom-nav">
      <div className="pagina">
        <header className="pagina-titulo">
          <button className="auth-voltar" onClick={() => navigate('/produtos')}>← Voltar</button>
          <h2>Pagamento</h2>
        </header>

        <div className="stack animar-entrada">
          <div className="card">
            <p className="home-card-label">RESUMO DO PEDIDO</p>
            <div className="stack" style={{ marginTop: 'var(--espaco-md)' }}>
              {itens.map(item => (
                <div key={item.id} className="payment-item">
                  <span>{item.nome}</span>
                  <span style={{ color: 'var(--cor-texto-fraco)', fontSize: '0.85rem' }}>×{item.quantidade}</span>
                  <span>R$ {(item.preco * item.quantidade).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="divisor" />
            <div className="payment-total">
              <span>Total</span>
              <span className="payment-total-valor">R$ {total.toFixed(2)}</span>
            </div>
          </div>

          <div className="card">
            <p className="home-card-label">MÉTODO DE PAGAMENTO</p>
            <div className="payment-metodos">
              {['pix', 'cartao'].map(m => (
                <button
                  key={m}
                  className={`payment-metodo-btn ${metodo === m ? 'ativo' : ''}`}
                  onClick={() => setMetodo(m)}
                >
                  {m === 'pix' ? '📱 PIX' : '💳 Cartão'}
                </button>
              ))}
            </div>
          </div>

          {erro && <div className="alerta alerta-erro">{erro}</div>}

          <button className="btn btn-primario" onClick={finalizar} disabled={carregando}>
            {carregando ? <><div className="spinner" /> Processando...</> : `Confirmar — R$ ${total.toFixed(2)}`}
          </button>
        </div>
      </div>
      <BottomNav />
    </div>
  )
}
