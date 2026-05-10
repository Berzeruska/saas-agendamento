import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { config } from '../config/index.js'
import './Auth.css'

export default function Register() {
  const { registrarCliente } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ nome: '', telefone: '', senha: '', confirmar: '' })
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    if (form.senha !== form.confirmar) return setErro('As senhas não conferem')
    if (form.senha.length < 6) return setErro('Senha deve ter no mínimo 6 caracteres')
    setCarregando(true)
    try {
      await registrarCliente({ nome: form.nome, telefone: form.telefone, senha: form.senha })
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
          <p className="auth-subtitulo">Crie sua conta</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="input-grupo">
            <label>Nome completo</label>
            <input className="input-campo" type="text" placeholder="Seu nome"
              value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} required />
          </div>
          <div className="input-grupo">
            <label>Telefone (com DDD)</label>
            <input className="input-campo" type="tel" placeholder="(11) 99999-9999"
              value={form.telefone} onChange={e => setForm(p => ({ ...p, telefone: e.target.value }))} required />
          </div>
          <div className="input-grupo">
            <label>Senha (mín. 6 caracteres)</label>
            <input className="input-campo" type="password" placeholder="Crie uma senha"
              value={form.senha} onChange={e => setForm(p => ({ ...p, senha: e.target.value }))} required />
          </div>
          <div className="input-grupo">
            <label>Confirme a senha</label>
            <input className="input-campo" type="password" placeholder="Repita a senha"
              value={form.confirmar} onChange={e => setForm(p => ({ ...p, confirmar: e.target.value }))} required />
          </div>

          {erro && <div className="alerta alerta-erro">{erro}</div>}

          <button className="btn btn-primario" type="submit" disabled={carregando}>
            {carregando ? <><div className="spinner" /> Criando conta...</> : 'Criar conta'}
          </button>
        </form>

        <p className="auth-link" style={{ marginTop: 'var(--espaco-lg)' }}>
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </div>
    </div>
  )
}
