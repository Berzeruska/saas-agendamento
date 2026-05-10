import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export function ClienteGuard({ children }) {
  const { cliente, carregando } = useAuth()
  if (carregando) return null
  if (!cliente) return <Navigate to="/login" replace />
  return children
}

export function AdminGuard({ children }) {
  const { adminAutenticado, carregando } = useAuth()
  if (carregando) return null
  if (!adminAutenticado) return <Navigate to="/admin/login" replace />
  return children
}
