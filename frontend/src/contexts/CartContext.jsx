import { createContext, useContext, useState, useCallback } from 'react'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const [itens, setItens] = useState([])

  const adicionar = useCallback((produto) => {
    setItens(prev => {
      const existente = prev.find(i => i.id === produto.id)
      if (existente) {
        return prev.map(i => i.id === produto.id ? { ...i, quantidade: i.quantidade + 1 } : i)
      }
      return [...prev, { ...produto, quantidade: 1 }]
    })
  }, [])

  const remover = useCallback((produtoId) => {
    setItens(prev => {
      const item = prev.find(i => i.id === produtoId)
      if (!item) return prev
      if (item.quantidade === 1) return prev.filter(i => i.id !== produtoId)
      return prev.map(i => i.id === produtoId ? { ...i, quantidade: i.quantidade - 1 } : i)
    })
  }, [])

  const limpar = useCallback(() => setItens([]), [])

  const total = itens.reduce((s, i) => s + i.preco * i.quantidade, 0)
  const totalItens = itens.reduce((s, i) => s + i.quantidade, 0)

  return (
    <CartContext.Provider value={{ itens, adicionar, remover, limpar, total, totalItens }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart deve estar dentro de CartProvider')
  return ctx
}
