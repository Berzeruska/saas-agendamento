import { useNavigate, useLocation } from 'react-router-dom'
import { useCart } from '../../contexts/CartContext'
import { config } from '../../config/index.js'

export default function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { totalItens } = useCart()

  const agendarPath = config.camposExtras === 'briefing' ? '/briefing' : '/agendar'

  const itens = [
    {
      path: '/home',
      label: 'Início',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
    {
      path: agendarPath,
      label: config.termos.Servico,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
    },
    {
      path: '/produtos',
      label: 'Produtos',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 01-8 0" />
        </svg>
      ),
      badge: true,
    },
    {
      path: '/historico',
      label: 'Histórico',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
  ]

  return (
    <nav className="bottom-nav">
      {itens.map(item => (
        <button
          key={item.path}
          className={`bottom-nav-item ${pathname === item.path ? 'ativo' : ''}`}
          onClick={() => navigate(item.path)}
        >
          <div style={{ position: 'relative' }}>
            {item.icon}
            {item.badge && totalItens > 0 && (
              <span className="bottom-nav-badge">{totalItens}</span>
            )}
          </div>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
