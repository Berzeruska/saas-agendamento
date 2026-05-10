import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { config } from '../../config/index.js'
import '../Auth.css'

export default function AdminLogin() {
  const { loginAdmin } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ usuario: '', senha: '' })
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    setCarregando(true)
    try {
      await loginAdmin(form)
      navigate('/admin', { replace: true })
    } catch (err) {
      setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card card animar-entrada">
        <div className="auth-header">
          <div className="auth-icone">🔐</div>
          <h2 className="auth-titulo">Admin</h2>
          <p className="auth-subtitulo">{config.nome} — Painel administrativo</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="input-grupo">
            <label>Usuário</label>
            <input className="input-campo" type="text" placeholder="admin"
              value={form.usuario} onChange={e => setForm(p => ({ ...p, usuario: e.target.value }))} autoComplete="username" required />
          </div>
          <div className="input-grupo">
            <label>Senha</label>
            <input className="input-campo" type="password" placeholder="Senha do administrador"
              value={form.senha} onChange={e => setForm(p => ({ ...p, senha: e.target.value }))} autoComplete="current-password" required />
          </div>

          {erro && <div className="alerta alerta-erro">{erro}</div>}

          <button className="btn btn-primario" type="submit" disabled={carregando}>
            {carregando ? <><div className="spinner" /> Entrando...</> : 'Entrar no painel'}
          </button>
        </form>

        <button className="auth-voltar" onClick={() => navigate('/')} style={{ marginTop: 'var(--espaco-lg)', display: 'block', textAlign: 'center' }}>
          ← Voltar ao site
        </button>
      </div>
    </div>
  )
}
