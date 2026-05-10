import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { briefingsAPI } from '../services/api'
import { config } from '../config/index.js'
import BottomNav from '../components/layout/BottomNav'
import './Booking.css'

export default function Briefing() {
  const navigate = useNavigate()
  const [descricao, setDescricao]               = useState('')
  const [estilo, setEstilo]                     = useState('')
  const [localCorpo, setLocalCorpo]             = useState('')
  const [tamanhoAprox, setTamanhoAprox]         = useState('')
  const [periodoSugerido, setPeriodoSugerido]   = useState('')
  const [foto, setFoto]                         = useState(null)
  const [fotoPreview, setFotoPreview]           = useState(null)
  const [carregando, setCarregando]             = useState(false)
  const [erro, setErro]                         = useState('')
  const [sucesso, setSucesso]                   = useState(false)

  function handleFoto(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setErro('Foto muito grande. Máximo 10 MB.')
      return
    }
    setFoto(file)
    setFotoPreview(URL.createObjectURL(file))
  }

  async function enviar(e) {
    e.preventDefault()
    setCarregando(true)
    setErro('')
    try {
      const fd = new FormData()
      fd.append('descricao', descricao)
      fd.append('estilo', estilo)
      fd.append('local_corpo', localCorpo)
      fd.append('tamanho_aprox', tamanhoAprox)
      fd.append('periodo_sugerido', periodoSugerido)
      if (foto) fd.append('foto', foto)
      await briefingsAPI.create(fd)
      setSucesso(true)
    } catch (err) {
      setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }

  if (sucesso) {
    return (
      <div className="tem-bottom-nav">
        <div className="pagina">
          <div className="booking-sucesso animar-entrada">
            <div className="booking-sucesso-icone">✓</div>
            <h2>Briefing enviado!</h2>
            <p>Recebemos sua ideia. O artista vai analisar e te enviar uma proposta de valor e data.</p>
            <button className="btn btn-primario" onClick={() => navigate('/home')}>Voltar ao início</button>
            <button className="btn btn-secundario" onClick={() => navigate('/historico')}>Ver meus briefings</button>
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
          <button className="auth-voltar" onClick={() => navigate('/home')}>← Voltar</button>
          <h2>{config.termos.agendar}</h2>
        </header>

        <form onSubmit={enviar} className="stack animar-entrada">
          <p className="booking-instrucao">Conte sobre a tattoo que você quer</p>

          <div className="input-grupo">
            <label>Descrição da ideia *</label>
            <textarea
              className="input-campo"
              placeholder="Ex: Quero uma rosa realista no antebraço esquerdo, com folhas e espinhos..."
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              rows={4}
              required
            />
          </div>

          <div className="input-grupo">
            <label>Estilo</label>
            <input
              className="input-campo"
              placeholder="Ex: Realismo, Old School, Blackwork, Aquarela..."
              value={estilo}
              onChange={e => setEstilo(e.target.value)}
            />
          </div>

          <div className="input-grupo">
            <label>Local no corpo</label>
            <input
              className="input-campo"
              placeholder="Ex: Antebraço esquerdo, costela, panturrilha..."
              value={localCorpo}
              onChange={e => setLocalCorpo(e.target.value)}
            />
          </div>

          <div className="input-grupo">
            <label>Tamanho aproximado</label>
            <input
              className="input-campo"
              placeholder="Ex: 10cm × 8cm, cobertura total da costela..."
              value={tamanhoAprox}
              onChange={e => setTamanhoAprox(e.target.value)}
            />
          </div>

          <div className="input-grupo">
            <label>Período preferido</label>
            <input
              className="input-campo"
              placeholder="Ex: Final de semana, semana que vem, próximo mês..."
              value={periodoSugerido}
              onChange={e => setPeriodoSugerido(e.target.value)}
            />
          </div>

          <div className="input-grupo">
            <label>Foto de referência (opcional, máx. 10 MB)</label>
            <input
              type="file"
              accept="image/*"
              className="input-campo"
              onChange={handleFoto}
              style={{ padding: '8px' }}
            />
            {fotoPreview && (
              <img
                src={fotoPreview}
                alt="Prévia da referência"
                style={{ marginTop: 8, borderRadius: 8, maxHeight: 200, objectFit: 'cover', width: '100%' }}
              />
            )}
          </div>

          {erro && <div className="alerta alerta-erro">{erro}</div>}

          <button type="submit" className="btn btn-primario" disabled={carregando || !descricao.trim()}>
            {carregando ? <><div className="spinner" /> Enviando...</> : 'Enviar briefing'}
          </button>
        </form>
      </div>
      <BottomNav />
    </div>
  )
}
