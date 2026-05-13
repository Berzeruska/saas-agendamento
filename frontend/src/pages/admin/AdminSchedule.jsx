import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { appointmentsAPI, servicesAPI, briefingsAPI, productsAPI } from '../../services/api'
import { config } from '../../config/index.js'
import HelpBox from '../../components/HelpBox'
import ModalConcluirSessao from '../../components/admin/ModalConcluirSessao'
import './Admin.css'

const isBriefingMode = () => config.camposExtras === 'briefing'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const HORARIOS = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00']
const HOJE = new Date().toISOString().split('T')[0]

function buildCalendar(mes, ano) {
  const firstDay = new Date(ano, mes - 1, 1).getDay()
  const lastDay  = new Date(ano, mes, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= lastDay; d++) cells.push(d)
  return cells
}

function toDateStr(d, mes, ano) {
  return `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function whatsappUrl(telefone) {
  const num = (telefone || '').replace(/\D/g, '')
  return `https://wa.me/55${num}`
}

const FORM_VAZIO = { nome: '', telefone: '', servico_id: '', hora: '', notas: '' }
const DIAS_31 = Array.from({ length: 31 }, (_, i) => i + 1)

export default function AdminSchedule() {
  const navigate = useNavigate()
  const hojeDate = new Date()

  const [mesCal, setMesCal]           = useState(hojeDate.getMonth() + 1)
  const [anoCal, setAnoCal]           = useState(hojeDate.getFullYear())
  const [datasComBriefings, setDatas] = useState(new Set())
  const [dataSel, setDataSel]         = useState(HOJE)
  const [ags, setAgs]                 = useState([])
  const [servicos, setServicos]       = useState([])
  const [carregando, setCarregando]   = useState(false)
  const [novaForm, setNovaForm]       = useState(false)
  const [form, setForm]               = useState(FORM_VAZIO)
  const [salvando, setSalvando]       = useState(false)
  const [erro, setErro]               = useState('')

  // modal concluir sessão
  const [modalConcluir, setModalConcluir]   = useState(null)
  const [produtosEstoque, setProdutosEstoque] = useState([])

  // modal cancelar sessão (briefing mode)
  const [modalCancelar, setModalCancelar]   = useState(null)
  const [cancelando, setCancelando]         = useState(false)
  const [erroCancelar, setErroCancelar]     = useState('')

  // modal informar valor (briefing mode)
  const [modalValorS, setModalValorS]       = useState(null)
  const [valorInputS, setValorInputS]       = useState('')
  const [erroValorS, setErroValorS]         = useState('')
  const [salvandoValorS, setSalvandoValorS] = useState(false)

  // modal reagendar (briefing mode)
  const [modalReagendar, setModalReagendar] = useState(null)
  const [formDiaRe, setFormDiaRe]           = useState('')
  const [formMesRe, setFormMesRe]           = useState('')
  const [formHoraRe, setFormHoraRe]         = useState('')
  const [formNotasRe, setFormNotasRe]       = useState('')
  const [salvandoRe, setSalvandoRe]         = useState(false)
  const [erroRe, setErroRe]                 = useState('')

  useEffect(() => {
    console.log('[AdminSchedule] isBriefingMode:', config.camposExtras)
    servicesAPI.list()
      .then(({ data }) => setServicos(data))
      .catch(() => {})
    productsAPI.list()
      .then(({ data }) => { console.log('[AdminSchedule] produtos carregados:', data?.length); setProdutosEstoque(data || []) })
      .catch((e) => console.warn('[AdminSchedule] erro ao carregar produtos:', e.message))
  }, [])

  useEffect(() => {
    if (!isBriefingMode()) { setDatas(new Set()); return }
    let cancelado = false
    setDatas(new Set())
    briefingsAPI.agendaMes(mesCal, anoCal)
      .then(({ data }) => { if (!cancelado) setDatas(new Set(data.datas || [])) })
      .catch(() => { if (!cancelado) setDatas(new Set()) })
    return () => { cancelado = true }
  }, [mesCal, anoCal])

  function recarregarDia(data) {
    setCarregando(true)
    const fn = isBriefingMode()
      ? briefingsAPI.agendaDia(data).then(r => r.data)
      : appointmentsAPI.byDay(data).then(r => (r.data || []).filter(a => a.status === 'confirmado'))
    fn
      .then(d => { setAgs(d); setCarregando(false) })
      .catch(() => { setAgs([]); setCarregando(false) })
  }

  function recarregarDots() {
    if (!isBriefingMode()) return
    briefingsAPI.agendaMes(mesCal, anoCal)
      .then(({ data }) => setDatas(new Set(data.datas || [])))
      .catch(() => {})
  }

  useEffect(() => {
    let cancelado = false
    setCarregando(true)
    const fn = isBriefingMode()
      ? briefingsAPI.agendaDia(dataSel).then(r => r.data)
      : appointmentsAPI.byDay(dataSel).then(r => (r.data || []).filter(a => a.status === 'confirmado'))
    fn
      .then(d => { if (!cancelado) { setAgs(d); setCarregando(false) } })
      .catch(() => { if (!cancelado) { setAgs([]); setCarregando(false) } })
    return () => { cancelado = true }
  }, [dataSel])

  function navMes(delta) {
    let m = mesCal + delta
    let a = anoCal
    if (m > 12) { m = 1; a++ }
    if (m < 1)  { m = 12; a-- }
    setMesCal(m)
    setAnoCal(a)
  }

  async function mudarStatus(id, status) {
    try {
      await appointmentsAPI.updateStatus(id, status)
      recarregarDia(dataSel)
    } catch (err) {
      alert(err.message)
    }
  }

  async function registrarValorAgenda(e) {
    e.preventDefault()
    const valor = parseFloat((valorInputS || '').replace(',', '.'))
    if (!valor || valor <= 0) { setErroValorS('Informe um valor válido.'); return }
    setSalvandoValorS(true)
    setErroValorS('')
    try {
      await briefingsAPI.registrarValor(modalValorS.id, valor)
      setAgs(prev => prev.map(b => b.id === modalValorS.id ? { ...b, valor_combinado: valor } : b))
      setModalValorS(null)
      setValorInputS('')
    } catch (e) {
      setErroValorS(e.message)
    } finally {
      setSalvandoValorS(false)
    }
  }

  async function executarCancelar() {
    setCancelando(true)
    setErroCancelar('')
    try {
      await briefingsAPI.cancelar(modalCancelar.id)
      setModalCancelar(null)
      setAgs(prev => prev.filter(b => b.id !== modalCancelar.id))
      recarregarDots()
    } catch (e) {
      setErroCancelar(e.message)
    } finally {
      setCancelando(false)
    }
  }

  function abrirReagendar(b) {
    const parts = (b.data_proposta || dataSel).split('-')
    setFormMesRe(parts[1] ? String(parseInt(parts[1], 10)) : '')
    setFormDiaRe(parts[2] ? String(parseInt(parts[2], 10)) : '')
    setFormHoraRe(b.hora_proposta?.slice(0, 5) || '')
    setFormNotasRe(b.notas_admin || '')
    setErroRe('')
    setModalReagendar(b)
  }

  async function salvarReagendar(e) {
    e.preventDefault()
    if (!formDiaRe || !formMesRe) { setErroRe('Selecione o dia e o mês.'); return }
    setSalvandoRe(true)
    setErroRe('')
    try {
      const data_proposta = `${anoCal}-${String(formMesRe).padStart(2, '0')}-${String(formDiaRe).padStart(2, '0')}`
      await briefingsAPI.reagendar(modalReagendar.id, {
        data_proposta,
        hora_proposta: formHoraRe,
        notas_admin:   formNotasRe,
      })
      setModalReagendar(null)
      recarregarDia(dataSel)
      recarregarDots()
    } catch (err) {
      setErroRe(err.message)
    } finally {
      setSalvandoRe(false)
    }
  }

  async function criarSessao(e) {
    e.preventDefault()
    setSalvando(true)
    setErro('')
    try {
      await appointmentsAPI.adminCreate({ ...form, data: dataSel })
      setNovaForm(false)
      setForm(FORM_VAZIO)
      recarregarDia(dataSel)
    } catch (err) {
      setErro(err.message)
    } finally {
      setSalvando(false)
    }
  }

  const cells = buildCalendar(mesCal, anoCal)

  return (
    <div className="pagina admin-pagina">
      <header className="pagina-titulo">
        <button className="auth-voltar" onClick={() => navigate('/admin')}>← Painel</button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2>Agenda</h2>
            <HelpBox texto="Calendário de sessões confirmadas. Pontos roxos indicam dias ocupados. Clique num dia para ver quem está agendado." />
          </div>
          {!isBriefingMode() && (
            <button
              className="btn btn-primario"
              style={{ width: 'auto', padding: '8px 16px' }}
              onClick={() => { setForm(FORM_VAZIO); setErro(''); setNovaForm(true) }}
            >
              + Nova sessão
            </button>
          )}
        </div>
      </header>

      {/* Formulário nova sessão (modo não-tattoo) */}
      {novaForm && !isBriefingMode() && (
        <form className="card stack animar-entrada" onSubmit={criarSessao} style={{ marginBottom: 'var(--espaco-lg)' }}>
          <p className="admin-secao-label">NOVA {config.termos.Servico.toUpperCase()}</p>
          <div className="grid-2">
            <div className="input-grupo">
              <label>Nome do cliente</label>
              <input className="input-campo" placeholder="Nome completo" value={form.nome}
                onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} required />
            </div>
            <div className="input-grupo">
              <label>Telefone</label>
              <input className="input-campo" placeholder="+55 11 99999-9999" value={form.telefone}
                onChange={e => setForm(p => ({ ...p, telefone: e.target.value }))} required />
            </div>
          </div>
          <div className="input-grupo">
            <label>{config.termos.Servico}</label>
            <select className="input-campo" value={form.servico_id}
              onChange={e => setForm(p => ({ ...p, servico_id: e.target.value }))} required>
              <option value="">Selecione...</option>
              {servicos.map(s => (
                <option key={s.id} value={s.id}>{s.nome} — R$ {Number(s.preco).toFixed(2)}</option>
              ))}
            </select>
          </div>
          <div className="input-grupo">
            <label>Horário em {new Date(dataSel + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</label>
            <select className="input-campo" value={form.hora}
              onChange={e => setForm(p => ({ ...p, hora: e.target.value }))} required>
              <option value="">Selecione...</option>
              {HORARIOS.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div className="input-grupo">
            <label>Notas (opcional)</label>
            <textarea className="input-campo" rows={2} value={form.notas}
              onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} />
          </div>
          {erro && <div className="alerta alerta-erro">{erro}</div>}
          <div className="grid-2">
            <button type="submit" className="btn btn-primario" disabled={salvando}>
              {salvando ? '...' : 'Salvar'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setNovaForm(false)}>Cancelar</button>
          </div>
        </form>
      )}

      {/* Calendário mensal */}
      <div className="card" style={{ marginBottom: 'var(--espaco-lg)', padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button className="btn btn-ghost" style={{ padding: '4px 14px', width: 'auto', fontSize: '1.3rem', lineHeight: 1 }}
            onClick={() => navMes(-1)}>‹</button>
          <p style={{ fontWeight: 700, fontSize: '0.88rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {MESES[mesCal - 1]} {anoCal}
          </p>
          <button className="btn btn-ghost" style={{ padding: '4px 14px', width: 'auto', fontSize: '1.3rem', lineHeight: 1 }}
            onClick={() => navMes(1)}>›</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
          {DIAS_SEMANA.map(d => (
            <div key={d} style={{
              textAlign: 'center', fontSize: '0.6rem', fontWeight: 700,
              letterSpacing: '0.04em', color: 'var(--cor-texto-fraco)', padding: '2px 0',
            }}>
              {d}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
          {cells.map((d, i) => {
            if (d === null) return <div key={`e-${i}`} />
            const dateStr = toDateStr(d, mesCal, anoCal)
            const hasDot  = datasComBriefings.has(dateStr)
            const isSel   = dataSel === dateStr
            const isHoje  = dateStr === HOJE
            return (
              <button
                key={dateStr}
                onClick={() => setDataSel(dateStr)}
                style={{
                  position: 'relative',
                  paddingTop: '100%',
                  borderRadius: 8,
                  border: isSel
                    ? '2px solid var(--cor-acento)'
                    : isHoje
                    ? '1px solid color-mix(in srgb, var(--cor-acento) 50%, transparent)'
                    : '1px solid transparent',
                  background: isSel
                    ? 'color-mix(in srgb, var(--cor-acento) 18%, var(--cor-fundo-input))'
                    : 'var(--cor-fundo-input)',
                  cursor: 'pointer',
                  overflow: 'hidden',
                }}
              >
                <span style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 2,
                  fontSize: '0.85rem',
                  fontWeight: isSel || isHoje ? 700 : 400,
                  color: isSel ? 'var(--cor-acento)' : 'var(--cor-texto)',
                }}>
                  {d}
                  {hasDot && (
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      backgroundColor: 'var(--cor-acento)',
                      margin: '2px auto 0',
                      display: 'block', flexShrink: 0,
                    }} />
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <p style={{ fontSize: '0.75rem', color: 'var(--cor-texto-fraco)', marginBottom: 12, fontWeight: 600, letterSpacing: '0.06em' }}>
        {new Date(dataSel + 'T00:00:00').toLocaleDateString('pt-BR', {
          weekday: 'long', day: '2-digit', month: 'long',
        }).toUpperCase()}
      </p>

      {carregando && <p className="carregando" style={{ color: 'var(--cor-texto-fraco)' }}>Carregando...</p>}

      {!carregando && (
        <div className="stack">
          {ags.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--espaco-xl)' }}>
              <p style={{ color: 'var(--cor-texto-fraco)' }}>Nenhuma sessão confirmada neste dia.</p>
            </div>
          )}

          {isBriefingMode()
            ? ags.map(b => (
                <div key={b.id} className="card admin-ag-detalhe">
                  <div className="admin-ag-detalhe-topo">
                    <span className="admin-ag-hora-grande">
                      {b.hora_proposta?.slice(0, 5) || '--:--'}
                    </span>
                    <span className="badge badge-concluido">Confirmado</span>
                  </div>

                  <p style={{ fontWeight: 700, fontSize: '1rem' }}>{b.clientes?.nome}</p>

                  {(b.estilo || b.local_corpo) && (
                    <p style={{ fontSize: '0.82rem', color: 'var(--cor-texto-fraco)' }}>
                      {[b.estilo, b.local_corpo].filter(Boolean).join(' · ')}
                    </p>
                  )}

                  {b.clientes?.telefone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <p style={{ fontSize: '0.8rem', color: 'var(--cor-texto-fraco)' }}>{b.clientes.telefone}</p>
                      <a href={whatsappUrl(b.clientes.telefone)} target="_blank" rel="noreferrer"
                        style={{ fontSize: '0.72rem', fontWeight: 700, color: '#25D366', border: '1px solid #25D366', borderRadius: 6, padding: '2px 8px', textDecoration: 'none' }}>
                        WhatsApp
                      </a>
                    </div>
                  )}

                  {b.notas_admin && (
                    <p style={{ fontSize: '0.8rem', background: 'var(--cor-fundo-input)', padding: '8px', borderRadius: 'var(--raio-sm)', marginTop: 'var(--espaco-sm)' }}>
                      {b.notas_admin}
                    </p>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginTop: 'var(--espaco-sm)', flexWrap: 'wrap' }}>
                    <button className="btn btn-secundario" style={{ flex: '1 1 100%', padding: '10px' }}
                      onClick={() => setModalConcluir(b)}>
                      ✓ Concluir sessão
                    </button>
                    <button className="btn btn-ghost" style={{ flex: 1, padding: '10px' }}
                      onClick={() => abrirReagendar(b)}>
                      Reagendar
                    </button>
                    <button
                      style={{
                        flex: 1, padding: '10px',
                        background: 'transparent',
                        border: '1px solid var(--cor-erro)',
                        borderRadius: 'var(--raio-md)',
                        color: 'var(--cor-erro)',
                        fontSize: '0.88rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                      onClick={() => { setErroCancelar(''); setModalCancelar(b) }}
                    >
                      Cancelar
                    </button>
                  </div>
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--cor-borda)' }}>
                    {b.valor_combinado ? (
                      <p style={{ fontSize: '0.82rem', color: 'var(--cor-texto-fraco)' }}>
                        Valor: <strong style={{ color: 'var(--cor-acento)' }}>R$ {Number(b.valor_combinado).toFixed(2)}</strong>
                      </p>
                    ) : (
                      <button
                        className="btn btn-ghost"
                        style={{ width: '100%', padding: '8px', fontSize: '0.82rem' }}
                        onClick={() => { setValorInputS(''); setErroValorS(''); setModalValorS(b) }}
                      >
                        Informar valor
                      </button>
                    )}
                  </div>
                </div>
              ))
            : ags.map(ag => (
                <div key={ag.id} className="card admin-ag-detalhe">
                  <div className="admin-ag-detalhe-topo">
                    <span className="admin-ag-hora-grande">{ag.hora?.slice(0, 5)}</span>
                    <span className="badge badge-concluido">Confirmado</span>
                  </div>
                  <p style={{ fontWeight: 700 }}>{ag.clientes?.nome}</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--cor-texto-fraco)' }}>
                    {ag.servicos?.nome} · R$ {Number(ag.servicos?.preco || 0).toFixed(2)}
                  </p>

                  {ag.clientes?.telefone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <p style={{ fontSize: '0.8rem', color: 'var(--cor-texto-fraco)' }}>{ag.clientes.telefone}</p>
                      <a href={whatsappUrl(ag.clientes.telefone)} target="_blank" rel="noreferrer"
                        style={{ fontSize: '0.72rem', fontWeight: 700, color: '#25D366', border: '1px solid #25D366', borderRadius: 6, padding: '2px 8px', textDecoration: 'none' }}>
                        WhatsApp
                      </a>
                    </div>
                  )}

                  {ag.notas && (
                    <p style={{ fontSize: '0.8rem', background: 'var(--cor-fundo-input)', padding: '8px', borderRadius: 'var(--raio-sm)', whiteSpace: 'pre-line', marginTop: 'var(--espaco-sm)' }}>
                      {ag.notas}
                    </p>
                  )}

                  <button className="btn btn-secundario" style={{ marginTop: 'var(--espaco-sm)', padding: '10px' }}
                    onClick={() => mudarStatus(ag.id, 'concluido')}>
                    ✓ Marcar concluída
                  </button>
                </div>
              ))
          }
        </div>
      )}

      {/* Modal concluir sessão */}
      {modalConcluir && (
        <ModalConcluirSessao
          briefing={modalConcluir}
          produtos={produtosEstoque}
          onConcluir={() => {
            setModalConcluir(null)
            recarregarDia(dataSel)
            recarregarDots()
            productsAPI.list().then(({ data }) => setProdutosEstoque(data || [])).catch(() => {})
          }}
          onFechar={() => setModalConcluir(null)}
        />
      )}

      {/* Modal cancelar sessão (briefing mode) */}
      {modalCancelar && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
          onClick={e => e.target === e.currentTarget && !cancelando && setModalCancelar(null)}
        >
          <div style={{ position: 'relative', background: 'var(--cor-fundo-card)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 360 }}>
            <button type="button" onClick={() => setModalCancelar(null)} disabled={cancelando}
              style={{ position: 'absolute', top: 12, right: 12, width: 28, height: 28, borderRadius: '50%', background: 'var(--cor-fundo-input)', border: '1px solid var(--cor-borda)', color: 'var(--cor-texto-fraco)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', lineHeight: 1 }}>×</button>
            <p style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.28em', color: 'var(--cor-texto-fraco)', marginBottom: 10 }}>
              CANCELAR SESSÃO
            </p>
            <p style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 6 }}>
              Cancelar sessão de{' '}
              <span style={{ color: 'var(--cor-acento)' }}>{modalCancelar.clientes?.nome}</span>?
            </p>
            <p style={{ fontSize: '0.82rem', color: 'var(--cor-texto-fraco)', marginBottom: 20 }}>
              Esta ação não pode ser desfeita.
            </p>
            {erroCancelar && (
              <div className="alerta alerta-erro" style={{ marginBottom: 16 }}>{erroCancelar}</div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-ghost"
                style={{ flex: 1 }}
                onClick={() => setModalCancelar(null)}
                disabled={cancelando}
              >
                Voltar
              </button>
              <button
                style={{
                  flex: 1, padding: '12px',
                  background: 'var(--cor-erro)',
                  border: 'none',
                  borderRadius: 'var(--raio-md)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: cancelando ? 'not-allowed' : 'pointer',
                  opacity: cancelando ? 0.7 : 1,
                }}
                onClick={executarCancelar}
                disabled={cancelando}
              >
                {cancelando ? '...' : 'Confirmar cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal informar valor (briefing mode) */}
      {modalValorS && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
          onClick={e => e.target === e.currentTarget && !salvandoValorS && setModalValorS(null)}
        >
          <div style={{ position: 'relative', background: 'var(--cor-fundo-card)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 360 }}>
            <button type="button" onClick={() => setModalValorS(null)} disabled={salvandoValorS}
              style={{ position: 'absolute', top: 12, right: 12, width: 28, height: 28, borderRadius: '50%', background: 'var(--cor-fundo-input)', border: '1px solid var(--cor-borda)', color: 'var(--cor-texto-fraco)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', lineHeight: 1 }}>×</button>
            <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--cor-texto-fraco)', marginBottom: 4 }}>
              VALOR COMBINADO
            </p>
            <h3 style={{ marginBottom: 20 }}>{modalValorS.clientes?.nome}</h3>
            <form onSubmit={registrarValorAgenda} className="stack">
              <div className="input-grupo">
                <label>Valor (R$)</label>
                <input
                  className="input-campo"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={valorInputS}
                  onChange={e => { setValorInputS(e.target.value.replace(/[^0-9.,]/g, '')); setErroValorS('') }}
                  autoFocus
                  style={{ fontSize: '1.1rem', textAlign: 'center', letterSpacing: '0.05em' }}
                />
              </div>
              {erroValorS && <div className="alerta alerta-erro">{erroValorS}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setModalValorS(null)} disabled={salvandoValorS}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primario" style={{ flex: 1 }} disabled={salvandoValorS}>
                  {salvandoValorS ? '...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal reagendar (briefing mode) */}
      {modalReagendar && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
          onClick={e => e.target === e.currentTarget && setModalReagendar(null)}
        >
          <div style={{ position: 'relative', background: 'var(--cor-fundo-card)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420 }}>
            <button type="button" onClick={() => setModalReagendar(null)} disabled={salvandoRe}
              style={{ position: 'absolute', top: 12, right: 12, width: 28, height: 28, borderRadius: '50%', background: 'var(--cor-fundo-input)', border: '1px solid var(--cor-borda)', color: 'var(--cor-texto-fraco)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', lineHeight: 1 }}>×</button>
            <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--cor-texto-fraco)', marginBottom: 4 }}>
              REAGENDAR
            </p>
            <h3 style={{ marginBottom: 20 }}>{modalReagendar.clientes?.nome}</h3>
            <form onSubmit={salvarReagendar} className="stack">
              <div className="input-grupo">
                <label>Dia e mês *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <select className="input-campo" value={formDiaRe} onChange={e => setFormDiaRe(e.target.value)} autoFocus>
                    <option value="">Dia</option>
                    {DIAS_31.map(d => <option key={d} value={String(d)}>{d}</option>)}
                  </select>
                  <select className="input-campo" value={formMesRe} onChange={e => setFormMesRe(e.target.value)}>
                    <option value="">Mês</option>
                    {MESES.map((m, i) => <option key={i} value={String(i + 1)}>{m}</option>)}
                  </select>
                </div>
                <p style={{ fontSize: '0.7rem', color: 'var(--cor-texto-fraco)', marginTop: 4 }}>Ano {anoCal}</p>
              </div>
              <div className="input-grupo">
                <label>Horário</label>
                <select className="input-campo" value={formHoraRe} onChange={e => setFormHoraRe(e.target.value)}>
                  <option value="">A combinar</option>
                  {HORARIOS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div className="input-grupo">
                <label>Observações</label>
                <textarea className="input-campo" rows={2} value={formNotasRe}
                  onChange={e => setFormNotasRe(e.target.value)} />
              </div>
              {erroRe && <div className="alerta alerta-erro">{erroRe}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primario" disabled={salvandoRe} style={{ flex: 1 }}>
                  {salvandoRe ? '...' : 'Salvar'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setModalReagendar(null)} style={{ flex: 1 }}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
