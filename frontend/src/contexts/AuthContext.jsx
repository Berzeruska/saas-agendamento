import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authAPI } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [cliente, setCliente] = useState(null)
  const [adminAutenticado, setAdminAutenticado] = useState(false)
  const [carregando, setCarregando] = useState(true)

  // Restaura sessão ao carregar — token fica em sessionStorage
  useEffect(() => {
    const token = sessionStorage.getItem('token')
    const tipo = sessionStorage.getItem('tipo')
    const dados = sessionStorage.getItem('dados')

    if (token && tipo && dados) {
      try {
        // Verifica expiração do JWT no lado cliente (não substitui validação no servidor)
        const payload = JSON.parse(atob(token.split('.')[1]))
        if (payload.exp * 1000 > Date.now()) {
          if (tipo === 'cliente') setCliente(JSON.parse(dados))
          if (tipo === 'admin')   setAdminAutenticado(true)
        } else {
          sessionStorage.clear()
        }
      } catch {
        sessionStorage.clear()
      }
    }
    setCarregando(false)
  }, [])

  const loginCliente = useCallback(async ({ telefone, senha }) => {
    const { data } = await authAPI.login({ telefone, senha })
    sessionStorage.setItem('token', data.token)
    sessionStorage.setItem('tipo', 'cliente')
    sessionStorage.setItem('dados', JSON.stringify(data.cliente))
    setCliente(data.cliente)
  }, [])

  const registrarCliente = useCallback(async ({ nome, telefone, senha }) => {
    const { data } = await authAPI.register({ nome, telefone, senha })
    sessionStorage.setItem('token', data.token)
    sessionStorage.setItem('tipo', 'cliente')
    sessionStorage.setItem('dados', JSON.stringify(data.cliente))
    setCliente(data.cliente)
  }, [])

  const loginAdmin = useCallback(async ({ usuario, senha }) => {
    const { data } = await authAPI.adminLogin({ usuario, senha })
    sessionStorage.setItem('token', data.token)
    sessionStorage.setItem('tipo', 'admin')
    sessionStorage.setItem('dados', JSON.stringify(data.admin))
    setAdminAutenticado(true)
  }, [])

  const logoutCliente = useCallback(() => {
    sessionStorage.clear()
    setCliente(null)
  }, [])

  const logoutAdmin = useCallback(() => {
    sessionStorage.clear()
    setAdminAutenticado(false)
  }, [])

  return (
    <AuthContext.Provider value={{
      cliente, adminAutenticado, carregando,
      loginCliente, registrarCliente, loginAdmin,
      logoutCliente, logoutAdmin,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve estar dentro de AuthProvider')
  return ctx
}
