import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { config } from '../config/index.js'
import './Welcome.css'

export default function Welcome() {
  const navigate = useNavigate()
  const { cliente, adminAutenticado, carregando } = useAuth()

  useEffect(() => {
    if (carregando) return
    if (adminAutenticado) navigate('/admin', { replace: true })
    else if (cliente)     navigate('/home',  { replace: true })
  }, [adminAutenticado, cliente, carregando, navigate])

  if (carregando) return null

  function handleSolicitar() {
    navigate(cliente ? '/briefing' : '/registro')
  }

  return (
    <div className="welcome-container">
      <div className="welcome-bg">
        <div className="welcome-orb welcome-orb-1" />
        <div className="welcome-orb welcome-orb-2" />
      </div>

      <div className="welcome-conteudo">
        <div className="welcome-logo animar-entrada">
          <div className="welcome-icone">{config.icone}</div>
          <h1 className="welcome-titulo">{config.nome}</h1>
          {config.tagline && <p className="welcome-tagline">{config.tagline}</p>}
        </div>

        <div className="welcome-divisor animar-entrada delay-1">
          <span />
          <span className="welcome-divisor-texto">ESTÚDIO DE TATUAGEM</span>
          <span />
        </div>

        <div className="welcome-botoes animar-entrada delay-2">
          <button
            className="btn btn-primario welcome-btn-grande"
            onClick={handleSolicitar}
          >
            <span className="btn-icone">✦</span>
            Solicitar horário
          </button>

          <button
            className="btn btn-secundario welcome-btn-grande"
            onClick={() => navigate('/login')}
          >
            <span className="btn-icone">→</span>
            Entrar
          </button>

          <button
            className="welcome-btn-admin"
            onClick={() => navigate('/admin/login')}
          >
            Área administrativa
          </button>
        </div>
      </div>
    </div>
  )
}
