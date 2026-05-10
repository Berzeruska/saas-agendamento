import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { servicesAPI, appointmentsAPI } from '../services/api'
import { config } from '../config/index.js'
import BottomNav from '../components/layout/BottomNav'
import './Booking.css'

function proximosDias(n = 7) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return d.toISOString().split('T')[0]
  })
}

function formatarData(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long'
  })
}

export default function Booking() {
  const navigate = useNavigate()
  const [etapa, setEtapa] = useState(1)
  const [servicos, setServicos] = useState([])
  const [servicoSel, setServicoSel] = useState(null)
  const [dataSel, setDataSel] = useState(proximosDias()[0])
  const [horarios, setHorarios] = useState([])
  const [horarioSel, setHorarioSel] = useState(null)
  const [notas, setNotas] = useState('')
  const [extras, setExtras] = useState({})
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  useEffect(() => {
    servicesAPI.list()
      .then(({ data }) => setServicos(data))
      .catch(() => setErro('Erro ao carregar serviços'))
  }, [])

  useEffect(() => {
    if (!dataSel) return
    setHorarioSel(null)
    setCarregando(true)
    appointmentsAPI.slots(dataSel)
      .then(({ data }) => setHorarios(data))
      .catch(() => setErro('Erro ao buscar horários'))
      .finally(() => setCarregando(false))
  }, [dataSel])

  async function confirmar() {
    if (!servicoSel || !horarioSel) return
    setCarregando(true)
    setErro('')
    // Monta notas com campos extras se for tatuador
    let notasCompletas = notas
    if (config.camposExtras && config.extras) {
      const linhas = config.extras.filter(f => extras[f.id]).map(f => `${f.label}: ${extras[f.id]}`)
      if (linhas.length) notasCompletas = linhas.join('\n') + (notas ? '\n' + notas : '')
    }
    try {
      await appointmentsAPI.create({
        servico_id: servicoSel.id,
        data: dataSel,
        hora: horarioSel,
        notas: notasCompletas,
      })
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
            <h2>Agendado!</h2>
            <p>Seu {config.termos.servico} foi marcado com sucesso.</p>
            <div className="card card-ouro booking-sucesso-detalhes">
              <p><strong>{servicoSel?.nome}</strong></p>
              <p>{formatarData(dataSel)}</p>
              <p>às {horarioSel}</p>
            </div>
            <button className="btn btn-primario" onClick={() => navigate('/home')}>Voltar ao início</button>
            <button className="btn btn-secundario" onClick={() => navigate('/produtos')}>Adicionar produtos</button>
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
          <div className="booking-etapas">
            <div className={`booking-etapa ${etapa >= 1 ? 'ativa' : ''}`}><span>1</span> {config.termos.Servico}</div>
            <div className="booking-etapa-linha" />
            <div className={`booking-etapa ${etapa >= 2 ? 'ativa' : ''}`}><span>2</span> Data & Hora</div>
            {config.camposExtras && <><div className="booking-etapa-linha" /><div className={`booking-etapa ${etapa >= 3 ? 'ativa' : ''}`}><span>3</span> Detalhes</div></>}
          </div>
        </header>

        {/* Etapa 1 — Escolha do serviço */}
        {etapa === 1 && (
          <div className="stack animar-entrada">
            <p className="booking-instrucao">Qual {config.termos.servico} você quer?</p>
            {servicos.map(s => (
              <button
                key={s.id}
                className={`booking-card-servico ${servicoSel?.id === s.id ? 'selecionado' : ''}`}
                onClick={() => setServicoSel(s)}
              >
                <div>
                  <p className="booking-servico-nome">{s.nome}</p>
                  {s.descricao && <p className="booking-servico-desc">{s.descricao}</p>}
                  <p className="booking-servico-duracao">⏱ {s.duracao_minutos} min</p>
                </div>
                <p className="booking-servico-preco">R$ {Number(s.preco).toFixed(2)}</p>
              </button>
            ))}
            <button className="btn btn-primario" disabled={!servicoSel} onClick={() => setEtapa(2)}>
              Continuar →
            </button>
          </div>
        )}

        {/* Etapa 2 — Data e hora */}
        {etapa === 2 && (
          <div className="stack animar-entrada">
            <div className="card booking-resumo-servico">
              <p className="home-card-label">{config.termos.Servico.toUpperCase()} SELECIONADO</p>
              <p className="booking-servico-nome">{servicoSel?.nome}</p>
            </div>

            <div>
              <p className="booking-instrucao">Escolha o dia</p>
              <div className="booking-dias">
                {proximosDias(14).map(dia => (
                  <button
                    key={dia}
                    className={`booking-dia ${dataSel === dia ? 'selecionado' : ''}`}
                    onClick={() => setDataSel(dia)}
                  >
                    <span className="booking-dia-semana">
                      {new Date(dia + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase().replace('.', '')}
                    </span>
                    <span className="booking-dia-numero">{new Date(dia + 'T00:00:00').getDate()}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="booking-instrucao">{formatarData(dataSel)} — escolha o horário</p>
              {carregando ? (
                <p className="carregando" style={{ color: 'var(--cor-texto-fraco)' }}>Buscando horários...</p>
              ) : horarios.length === 0 ? (
                <div className="alerta alerta-aviso">Nenhum horário neste dia. Escolha outro.</div>
              ) : (
                <div className="booking-horarios">
                  {horarios.map(h => (
                    <button
                      key={h.id}
                      className={`booking-horario ${horarioSel === h.hora ? 'selecionado' : ''}`}
                      onClick={() => setHorarioSel(h.hora)}
                    >
                      {h.hora.slice(0, 5)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {erro && <div className="alerta alerta-erro">{erro}</div>}

            <div className="stack">
              {config.camposExtras ? (
                <button className="btn btn-primario" disabled={!horarioSel} onClick={() => setEtapa(3)}>
                  Continuar →
                </button>
              ) : (
                <button className="btn btn-primario" disabled={!horarioSel || carregando} onClick={confirmar}>
                  {carregando ? <><div className="spinner" /> Agendando...</> : 'Confirmar'}
                </button>
              )}
              <button className="btn btn-ghost" onClick={() => setEtapa(1)}>← Mudar {config.termos.servico}</button>
            </div>
          </div>
        )}

        {/* Etapa 3 — Campos extras (tatuador) */}
        {etapa === 3 && config.camposExtras && (
          <div className="stack animar-entrada">
            <p className="booking-instrucao">Conte sobre sua tattoo</p>

            {config.extras?.map(campo => (
              <div key={campo.id} className="input-grupo">
                <label>{campo.label}</label>
                <input
                  className="input-campo"
                  placeholder={campo.placeholder}
                  value={extras[campo.id] || ''}
                  onChange={e => setExtras(p => ({ ...p, [campo.id]: e.target.value }))}
                />
              </div>
            ))}

            <div className="input-grupo">
              <label>{config.termos.notas_label}</label>
              <textarea
                className="input-campo"
                placeholder={config.termos.notas_placeholder}
                value={notas}
                onChange={e => setNotas(e.target.value)}
                rows={4}
              />
            </div>

            {erro && <div className="alerta alerta-erro">{erro}</div>}

            <div className="stack">
              <button className="btn btn-primario" disabled={carregando} onClick={confirmar}>
                {carregando ? <><div className="spinner" /> Agendando...</> : 'Confirmar agendamento'}
              </button>
              <button className="btn btn-ghost" onClick={() => setEtapa(2)}>← Voltar</button>
            </div>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
}
