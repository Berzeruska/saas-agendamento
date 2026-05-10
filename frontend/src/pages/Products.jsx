import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { productsAPI } from '../services/api'
import { useCart } from '../contexts/CartContext'
import BottomNav from '../components/layout/BottomNav'
import './Products.css'

export default function Products() {
  const navigate = useNavigate()
  const { itens, adicionar, remover, totalItens } = useCart()
  const [produtos, setProdutos] = useState([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    productsAPI.list()
      .then(({ data }) => setProdutos(data))
      .catch(() => {})
      .finally(() => setCarregando(false))
  }, [])

  function qtdNoCarrinho(id) {
    return itens.find(i => i.id === id)?.quantidade || 0
  }

  return (
    <div className="tem-bottom-nav">
      <div className="pagina">
        <header className="pagina-titulo">
          <button className="auth-voltar" onClick={() => navigate('/home')}>← Voltar</button>
          <h2>Produtos</h2>
          <p style={{ color: 'var(--cor-texto-fraco)', fontSize: '0.85rem' }}>Adicione ao seu pedido</p>
        </header>

        {carregando && <p className="carregando" style={{ color: 'var(--cor-texto-fraco)' }}>Carregando...</p>}

        <div className="stack">
          {produtos.map(prod => {
            const qtd = qtdNoCarrinho(prod.id)
            return (
              <div key={prod.id} className="card produtos-card">
                <div className="produtos-info">
                  <p className="produtos-nome">{prod.nome}</p>
                  <p className="produtos-preco">R$ {Number(prod.preco).toFixed(2)}</p>
                </div>
                <div className="produtos-controles">
                  {qtd > 0 ? (
                    <>
                      <button className="produtos-btn-qtd" onClick={() => remover(prod.id)}>−</button>
                      <span className="produtos-qtd-atual">{qtd}</span>
                      <button className="produtos-btn-qtd produtos-btn-add" onClick={() => adicionar(prod)}>+</button>
                    </>
                  ) : (
                    <button className="btn btn-secundario produtos-btn-adicionar" onClick={() => adicionar(prod)}>
                      + Adicionar
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {totalItens > 0 && (
          <div className="produtos-carrinho-flutuante">
            <button className="btn btn-primario" onClick={() => navigate('/pagamento')}>
              Ver carrinho ({totalItens})
            </button>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
}
