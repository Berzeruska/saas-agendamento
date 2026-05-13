import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { briefingsAPI } from '../services/api'
import BottomNav from '../components/layout/BottomNav'
import './Booking.css'

const ESTILOS = [
  'Blackwork', 'Realismo', 'Aquarela', 'Tradicional',
  'Geométrico', 'Fineline', 'Maori / Tribal', 'Outro',
]

const LOCAIS = [
  'Braço', 'Antebraço', 'Perna', 'Coxa', 'Costas',
  'Peito', 'Pescoço', 'Mão / Dedo', 'Pé', 'Costela', 'Outro',
]

const TAMANHOS = [
  { label: 'Pequena (até 5 cm)',    value: 'pequena' },
  { label: 'Média (5 a 15 cm)',     value: 'media'   },
  { label: 'Grande (acima de 15 cm)', value: 'grande' },
]

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const DIAS = Array.from({ length: 31 }, (_, i) => i + 1)
const HORARIOS = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00']

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const TIPOS_OK  = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

function erroAmigavel(msg) {
  if (!msg) return 'Algo deu errado. Tente novamente.'
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('Network'))
    return 'Sem conexão com o servidor. Verifique sua internet.'
  return msg
}

export default function Briefing() {
  const navigate = useNavigate()
  const inputRef = useRef(null)

  const [foto, setFoto]                     = useState(null)
  const [fotoPreview, setFotoPreview]       = useState(null)
  const [erroFoto, setErroFoto]             = useState('')
  const [uploadando, setUploadando]         = useState(false)

  const [estilo, setEstilo]                 = useState('')
  const [localCorpo, setLocalCorpo]         = useState('')
  const [tamanho, setTamanho]               = useState('')
  const [diaPreferido, setDia]              = useState('')
  const [mesPreferido, setMes]              = useState('')
  const [horaPreferida, setHora]            = useState('')
  const [descricao, setDescricao]           = useState('')

  const [enviando, setEnviando]             = useState(false)
  const [erro, setErro]                     = useState('')
  const [sucesso, setSucesso]               = useState(false)

  function handleFoto(e) {
    const file = e.target.files?.[0]
    setErroFoto('')
    if (!file) return

    if (!TIPOS_OK.includes(file.type)) {
      setErroFoto('Formato inválido. Use JPEG, PNG ou WebP.')
      return
    }
    if (file.size > MAX_BYTES) {
      setErroFoto('Foto muito grande. Máximo 5 MB.')
      return
    }

    setFoto(file)
    setFotoPreview(URL.createObjectURL(file))
  }

  function removerFoto(e) {
    e.preventDefault()
    setFoto(null)
    setFotoPreview(null)
    setErroFoto('')
    if (inputRef.current) inputRef.current.value = ''
  }

  async function enviar(e) {
    e.preventDefault()
    setErro('')

    // Validações client-side
    if (!foto) {
      setErroFoto('A foto de referência é obrigatória.')
      return
    }
    if (!estilo) {
      setErro('Selecione o estilo da tatuagem.')
      return
    }
    if (!localCorpo) {
      setErro('Selecione o local no corpo.')
      return
    }

    setEnviando(true)

    try {
      // 1. Upload da foto
      setUploadando(true)
      const fd = new FormData()
      fd.append('foto', foto)
      const { data: uploadData } = await briefingsAPI.uploadFoto(fd)
      setUploadando(false)

      const fotoUrl = uploadData.foto_url

      // 2. Criar briefing com a URL
      let dataProposta = ''
      if (diaPreferido && mesPreferido) {
        const ano = new Date().getFullYear()
        dataProposta = `${ano}-${String(mesPreferido).padStart(2, '0')}-${String(diaPreferido).padStart(2, '0')}`
      }

      await briefingsAPI.createJSON({
        foto_url:      fotoUrl,
        estilo,
        local_corpo:   localCorpo,
        tamanho_aprox: tamanho,
        data_proposta: dataProposta,
        hora_proposta: horaPreferida,
        descricao,
      })

      setSucesso(true)
    } catch (err) {
      setUploadando(false)
      setErro(erroAmigavel(err.message))
    } finally {
      setEnviando(false)
    }
  }

  if (sucesso) {
    return (
      <div className="tem-bottom-nav">
        <div className="pagina">
          <div className="booking-sucesso animar-entrada">
            <div className="booking-sucesso-icone">✓</div>
            <h2>Solicitação enviada!</h2>
            <p>Recebemos sua solicitação. O artista vai confirmar a data em breve.</p>
            <button className="btn btn-primario" onClick={() => navigate('/home')}>
              Voltar ao início
            </button>
            <button className="btn btn-secundario" onClick={() => navigate('/historico')}>
              Ver minhas solicitações
            </button>
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
          <h2>Nova solicitação</h2>
        </header>

        <form onSubmit={enviar} className="stack animar-entrada">
          <p className="booking-instrucao">Conte sobre a tattoo que você quer</p>

          {/* Foto de referência (obrigatória) */}
          <div className="input-grupo">
            <label>
              Foto de referência <span style={{ color: 'var(--cor-erro)' }}>*</span>
            </label>

            {!fotoPreview ? (
              <div
                style={{
                  border: `2px dashed ${erroFoto ? 'var(--cor-erro)' : 'var(--cor-borda)'}`,
                  borderRadius: 'var(--raio-md)',
                  padding: 'var(--espaco-xl)',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: 'var(--cor-fundo-input)',
                  transition: 'var(--transicao)',
                }}
                onClick={() => inputRef.current?.click()}
              >
                <p style={{ fontSize: '2rem', marginBottom: 8 }}>📷</p>
                <p style={{ fontWeight: 600, marginBottom: 4 }}>Toque para escolher</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--cor-texto-fraco)' }}>
                  JPEG, PNG ou WebP · máx. 5 MB
                </p>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <img
                  src={fotoPreview}
                  alt="Prévia"
                  style={{
                    width: '100%', borderRadius: 'var(--raio-md)',
                    maxHeight: 220, objectFit: 'cover',
                  }}
                />
                <button
                  type="button"
                  onClick={removerFoto}
                  style={{
                    position: 'absolute', top: 8, right: 8,
                    background: 'rgba(0,0,0,0.7)', border: 'none',
                    borderRadius: '50%', width: 32, height: 32,
                    color: '#fff', cursor: 'pointer', fontSize: '1rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  ✕
                </button>
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={handleFoto}
            />

            {erroFoto && (
              <p style={{ color: 'var(--cor-erro)', fontSize: '0.82rem', marginTop: 6 }}>
                {erroFoto}
              </p>
            )}
          </div>

          {/* Estilo */}
          <div className="input-grupo">
            <label>
              Estilo <span style={{ color: 'var(--cor-erro)' }}>*</span>
            </label>
            <select
              className="input-campo"
              value={estilo}
              onChange={e => setEstilo(e.target.value)}
              required
            >
              <option value="">Selecione o estilo...</option>
              {ESTILOS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Local no corpo */}
          <div className="input-grupo">
            <label>
              Local no corpo <span style={{ color: 'var(--cor-erro)' }}>*</span>
            </label>
            <select
              className="input-campo"
              value={localCorpo}
              onChange={e => setLocalCorpo(e.target.value)}
              required
            >
              <option value="">Selecione o local...</option>
              {LOCAIS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          {/* Tamanho */}
          <div className="input-grupo">
            <label>Tamanho aproximado</label>
            <select
              className="input-campo"
              value={tamanho}
              onChange={e => setTamanho(e.target.value)}
            >
              <option value="">Selecione o tamanho...</option>
              {TAMANHOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Data preferida */}
          <div className="input-grupo">
            <label>
              Data preferida{' '}
              <span style={{ color: 'var(--cor-texto-fraco)', fontSize: '0.8rem' }}>(opcional)</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <select
                className="input-campo"
                value={diaPreferido}
                onChange={e => setDia(e.target.value)}
              >
                <option value="">Dia</option>
                {DIAS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select
                className="input-campo"
                value={mesPreferido}
                onChange={e => setMes(e.target.value)}
              >
                <option value="">Mês</option>
                {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--cor-texto-fraco)', marginTop: 4 }}>
              Ano {new Date().getFullYear()}
            </p>
          </div>

          {/* Horário preferido */}
          <div className="input-grupo">
            <label>
              Horário preferido{' '}
              <span style={{ color: 'var(--cor-texto-fraco)', fontSize: '0.8rem' }}>(opcional)</span>
            </label>
            <select
              className="input-campo"
              value={horaPreferida}
              onChange={e => setHora(e.target.value)}
            >
              <option value="">A combinar com o artista</option>
              {HORARIOS.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>

          {/* Descrição livre */}
          <div className="input-grupo">
            <label>Descrição da ideia</label>
            <textarea
              className="input-campo"
              placeholder="Descreva o que você imagina: tema, cores, detalhes, referências culturais..."
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              rows={4}
              maxLength={2000}
            />
          </div>

          {erro && <div className="alerta alerta-erro">{erro}</div>}

          <button
            type="submit"
            className="btn btn-primario"
            disabled={enviando}
            style={{ marginTop: 8 }}
          >
            {uploadando
              ? <><div className="spinner" /> Enviando foto...</>
              : enviando
              ? <><div className="spinner" /> Enviando...</>
              : 'Enviar solicitação'
            }
          </button>
        </form>
      </div>
      <BottomNav />
    </div>
  )
}
