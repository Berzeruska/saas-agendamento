import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { config } from '../config/index.js'
import './Auth.css'

export default function Login() {
  const { loginCliente } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ telefone: '', senha: '' })
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    setCarregando(true)
    try {
      await loginCliente(form)
      navigate('/home', { replace: true })
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
          <div className="auth-icone">{config.icone}</div>
          <h2 className="auth-titulo">{config.nome}</h2>
          <p className="auth-subtitulo">Entre com seu telefone e senha</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="input-grupo">
            <label>Telefone (com DDD)</label>
            <input
              className="input-campo"
              type="tel"
              placeholder="(11) 99999-9999"
              value={form.telefone}
              onChange={e => setForm(p => ({ ...p, telefone: e.target.value }))}
              required
            />
          </div>
          <div className="input-grupo">
            <label>Senha</label>
            <input
              className="input-campo"
              type="password"
              placeholder="Sua senha"
              value={form.senha}
              onChange={e => setForm(p => ({ ...p, senha: e.target.value }))}
              required
            />
          </div>

          {erro && <div className="alerta alerta-erro">{erro}</div>}

          <button className="btn btn-primario" type="submit" disabled={carregando}>
            {carregando ? <><div className="spinner" /> Entrando...</> : 'Entrar'}
          </button>
        </form>

        <p className="auth-link" style={{ marginTop: 'var(--espaco-lg)' }}>
          Novo por aqui? <Link to="/registro">Crie sua conta</Link>
        </p>
      </div>
    </div>
  )
}
