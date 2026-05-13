import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { briefingsAPI, adminAPI, productsAPI } from '../../services/api'
import HelpBox from '../../components/HelpBox'
import ModalConcluirSessao from '../../components/admin/ModalConcluirSessao'
import './Admin.css'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const DIAS = Array.from({ length: 31 }, (_, i) => i + 1)
const HORARIOS = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00']

const STATUS_LABEL = {
  aguardando:       'Aguardando',
  proposta_enviada: 'Proposta enviada',
  confirmado:       'Confirmado',
  recusado:         'Recusado',
  cancelado:        'Cancelado',
  concluido:        'Concluído',
}

const STATUS_CLASS = {
  aguardando:       'badge-pendente',
  proposta_enviada: 'badge-confirmado',
  confirmado:       'badge-concluido',
  recusado:         'badge-cancelado',
  cancelado:        'badge-cancelado',
  concluido:        'badge-cancelado',
}

function whatsappUrl(telefone) {
  const num = (telefone || '').replace(/\D/g, '')
  return `https://wa.me/55${num}`
}

function formatarData(dataStr) {
  if (!dataStr) return ''
  return new Date(dataStr + 'T00:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long',
  })
}

const FILTROS = ['aguardando', 'confirmado']

export default function AdminSolicitacoes() {
  const navigate = useNavigate()
  const [briefings, setBriefings]         = useState([])
  const [filtroStatus, setFiltroStatus]   = useState('aguardando')
  const [carregando, setCarregando]       = useState(true)
  const [erro, setErro]                   = useState('')

  // modal reagendar / definir data
  const [modalB, setModalB]               = useState(null)
  const [formDia, setFormDia]             = useState('')
  const [formMes, setFormMes]             = useState('')
  const [formHora, setFormHora]           = useState('')
  const [formNotas, setFormNotas]         = useState('')
  const [salvando, setSalvando]           = useState(false)
  const [confirmando, setConfirmando]     = useState(null)
  const [erroModal, setErroModal]         = useState('')

  // modal de valor combinado
  const [modalValorB, setModalValorB]         = useState(null)
  const [valorModalInput, setValorModalInput] = useState('')
  const [erroValorModal, setErroValorModal]   = useState('')
  const [salvandoValor, setSalvandoValor]     = useState(false)

  // modal de cancelamento
  const [modalCancelarId, setModalCancelarId] = useState(null)
  const [cancelando, setCancelando]           = useState(false)

  // modal de confirmação de data
  const [modalConfirmarB, setModalConfirmarB] = useState(null)
  const [confirmandoData, setConfirmandoData] = useState(false)

  // modal de confirmação de pagamento
  const [modalPagB, setModalPagB]             = useState(null)
  const [confirmandoPag, setConfirmandoPag]   = useState(false)

  // segunda etapa: materiais
  const [etapaMateriais, setEtapaMateriais]   = useState(false)
  const [valorMateriais, setValorMateriais]   = useState('')
  const [erroPagMateriais, setErroPagMat]     = useState('')
  const [salvandoMat, setSalvandoMat]         = useState(false)

  // modal concluir sessão com abate no estoque
  const [modalConcluirB, setModalConcluirB]   = useState(null)
  const [produtosEstoque, setProdutosEstoque] = useState([])

  // perfil do cliente
  const [perfilAberto, setPerfilAberto]   = useState(null)
  const [perfilCache, setPerfilCache]     = useState({})
  const [loadingPerfil, setLoadingPerfil] = useState(false)

  useEffect(() => { carregar() }, [filtroStatus])

  useEffect(() => {
    productsAPI.list()
      .then(({ data }) => { console.log('[AdminSolicitacoes] produtos carregados:', data?.length); setProdutosEstoque(data || []) })
      .catch((e) => console.warn('[AdminSolicitacoes] erro ao carregar produtos:', e.message))
  }, [])

  async function carregar() {
    setCarregando(true)
    setErro('')
    try {
      const { data } = await briefingsAPI.list(filtroStatus)
      setBriefings(data)
    } catch (e) {
      setErro(e.message)
    } finally {
      setCarregando(false)
    }
  }

  function abrirModal(b) {
    const parts = (b.data_proposta || '').split('-')
    setFormMes(parts[1] ? String(parseInt(parts[1], 10)) : '')
    setFormDia(parts[2] ? String(parseInt(parts[2], 10)) : '')
    setFormHora(b.hora_proposta?.slice(0, 5) || '')
    setFormNotas(b.notas_admin || '')
    setErroModal('')
    setModalB(b)
  }

  function confirmarDireto(b) {
    setModalConfirmarB(b)
  }

  async function executarConfirmar() {
    setConfirmandoData(true)
    try {
      await briefingsAPI.confirmar(modalConfirmarB.id, { data_proposta: modalConfirmarB.data_proposta, hora_proposta: modalConfirmarB.hora_proposta || '', notas_admin: '' })
      setBriefings(prev => prev.map(b =>
        b.id === modalConfirmarB.id ? { ...b, status: 'confirmado' } : b
      ))
      setModalConfirmarB(null)
    } catch (e) {
      setModalConfirmarB(prev => ({ ...prev, _erro: e.message }))
    } finally {
      setConfirmandoData(false)
    }
  }

  async function salvarData(e) {
    e.preventDefault()
    if (!formDia || !formMes) { setErroModal('Selecione o dia e o mês.'); return }
    setSalvando(true)
    setErroModal('')
    try {
      const ano = new Date().getFullYear()
      const data_proposta = `${ano}-${String(formMes).padStart(2, '0')}-${String(formDia).padStart(2, '0')}`
      const fn = modalB.status === 'aguardando' && !modalB.data_proposta
        ? briefingsAPI.confirmar
        : briefingsAPI.reagendar
      await fn(modalB.id, { data_proposta, hora_proposta: formHora, notas_admin: formNotas })
      setModalB(null)
      carregar()
    } catch (e) {
      setErroModal(e.message)
    } finally {
      setSalvando(false)
    }
  }

  async function registrarValor(e) {
    e.preventDefault()
    const valor = parseFloat((valorModalInput || '').replace(',', '.'))
    if (!valor || valor <= 0) { setErroValorModal('Informe um valor válido.'); return }
    setSalvandoValor(true)
    setErroValorModal('')
    try {
      const { data } = await briefingsAPI.registrarValor(modalValorB.id, valor)
      setBriefings(prev => prev.map(b => b.id === modalValorB.id ? { ...b, valor_combinado: data.valor_combinado } : b))
      setModalValorB(null)
      setValorModalInput('')
    } catch (e) { setErroValorModal(e.message) }
    finally { setSalvandoValor(false) }
  }

  async function executarPagamento() {
    setConfirmandoPag(true)
    try {
      const { data } = await briefingsAPI.confirmarPagamento(modalPagB.id)
      setBriefings(prev => prev.map(b =>
        b.id === modalPagB.id ? { ...b, pago: data.pago, data_pagamento: data.data_pagamento } : b
      ))
      setEtapaMateriais(true)
    } catch (e) {
      setModalPagB(prev => ({ ...prev, _erro: e.message }))
    } finally {
      setConfirmandoPag(false)
    }
  }

  function fecharPagModal() {
    setModalPagB(null)
    setEtapaMateriais(false)
    setValorMateriais('')
    setErroPagMat('')
  }

  async function registrarMateriais() {
    const valor = parseFloat((valorMateriais || '').replace(',', '.'))
    if (!valor || valor <= 0) { setErroPagMat('Informe um valor válido.'); return }
    setSalvandoMat(true)
    setErroPagMat('')
    try {
      await adminAPI.registrarGasto({ valor, briefing_id: modalPagB.id, descricao: 'Materiais sessão' })
      fecharPagModal()
    } catch (e) {
      setErroPagMat(e.message)
    } finally {
      setSalvandoMat(false)
    }
  }

  async function executarCancelar() {
    setCancelando(true)
    try {
      await briefingsAPI.cancelar(modalCancelarId)
      setBriefings(prev => prev.map(b => b.id === modalCancelarId ? { ...b, status: 'cancelado' } : b))
      setModalCancelarId(null)
    } catch (e) {
      setModalCancelarId(prev => ({ id: prev, _erro: e.message }))
    } finally {
      setCancelando(false)
    }
  }

  function abrirConcluir(b) {
    setModalConcluirB(b)
  }

  async function togglePerfil(b) {
    if (perfilAberto === b.id) {
      setPerfilAberto(null)
      return
    }
    setPerfilAberto(b.id)
    const clienteId = b.clientes?.id || b.cliente_id
    if (!clienteId || perfilCache[b.id]) return
    setLoadingPerfil(true)
    try {
      const { data } = await adminAPI.clientProfile(clienteId)
      setPerfilCache(prev => ({ ...prev, [b.id]: data }))
    } catch {
      // silently fail
    } finally {
      setLoadingPerfil(false)
    }
  }

  return (
    <div className="pagina admin-pagina">
      <header className="pagina-titulo">
        <button className="auth-voltar" onClick={() => navigate('/admin')}>← Painel</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2>Solicitações</h2>
          <HelpBox texto="Clientes que pediram sessão. Aguardando: novos pedidos para confirmar. Confirmado: sessões agendadas — use o WhatsApp para combinar detalhes e registre o pagamento ao concluir." />
        </div>
        <p style={{ color: 'var(--cor-texto-fraco)', fontSize: '0.85rem' }}>{briefings.length} resultados</p>
      </header>

      <div className="admin-filtros">
        {FILTROS.map(s => (
          <button
            key={s}
            className={`admin-filtro-btn ${filtroStatus === s ? 'ativo' : ''}`}
            onClick={() => setFiltroStatus(s)}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {erro && <div className="alerta alerta-erro">{erro}</div>}

      {carregando ? (
        <p className="carregando" style={{ color: 'var(--cor-texto-fraco)' }}>Carregando...</p>
      ) : briefings.length === 0 ? (
        <div className="alerta alerta-info">
          Nenhuma solicitação{filtroStatus ? ` com status "${STATUS_LABEL[filtroStatus]}"` : ''}.
        </div>
      ) : (
        <div className="stack">
          {briefings.map(b => (
            <div key={b.id} className="card animar-entrada" style={{ padding: 16 }}>

              {/* Cabeçalho: avatar + nome + telefone + WhatsApp + status */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                <button
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}
                  onClick={() => togglePerfil(b)}
                  title="Ver perfil do cliente"
                >
                  <div className="admin-cliente-avatar">
                    {(b.clientes?.nome || 'C').charAt(0).toUpperCase()}
                  </div>
                </button>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <button
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', width: '100%' }}
                    onClick={() => togglePerfil(b)}
                  >
                    <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--cor-texto)', marginBottom: 2 }}>
                      {b.clientes?.nome || 'Cliente'}
                    </p>
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--cor-texto-fraco)' }}>
                      {b.clientes?.telefone}
                    </span>
                    {b.clientes?.telefone && (
                      <a
                        href={whatsappUrl(b.clientes.telefone)}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          letterSpacing: '0.05em',
                          color: '#25D366',
                          border: '1px solid #25D366',
                          borderRadius: 6,
                          padding: '2px 8px',
                          textDecoration: 'none',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        WhatsApp
                      </a>
                    )}
                  </div>
                </div>

                <span className={`badge ${STATUS_CLASS[b.status] || ''}`} style={{ flexShrink: 0 }}>
                  {STATUS_LABEL[b.status] || b.status}
                </span>
              </div>

              {/* Perfil expandido */}
              {perfilAberto === b.id && (
                <div style={{
                  background: 'var(--cor-fundo-input)',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 12,
                  fontSize: '0.82rem',
                }}>
                  {loadingPerfil && !perfilCache[b.id] ? (
                    <p style={{ color: 'var(--cor-texto-fraco)' }}>Carregando perfil...</p>
                  ) : perfilCache[b.id] ? (
                    <>
                      <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', color: 'var(--cor-texto-fraco)', marginBottom: 8 }}>
                        PERFIL DO CLIENTE
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                        <div>
                          <p style={{ fontSize: '0.65rem', color: 'var(--cor-texto-fraco)', letterSpacing: '0.1em' }}>SESSÕES FEITAS</p>
                          <p style={{ fontWeight: 700, color: 'var(--cor-acento)', fontSize: '1.1rem' }}>
                            {perfilCache[b.id].sessoes_feitas}
                          </p>
                        </div>
                        <div>
                          <p style={{ fontSize: '0.65rem', color: 'var(--cor-texto-fraco)', letterSpacing: '0.1em' }}>TOTAL GASTO</p>
                          <p style={{ fontWeight: 700, color: 'var(--cor-acento)', fontSize: '1.1rem' }}>
                            R$ {Number(perfilCache[b.id].total_gasto || 0).toFixed(0)}
                          </p>
                        </div>
                      </div>
                      {perfilCache[b.id].estilos?.length > 0 && (
                        <p style={{ color: 'var(--cor-texto-fraco)' }}>
                          Estilos: {perfilCache[b.id].estilos.join(', ')}
                        </p>
                      )}
                    </>
                  ) : (
                    <p style={{ color: 'var(--cor-texto-fraco)' }}>Perfil não disponível</p>
                  )}
                </div>
              )}

              {/* Tags: estilo, local, tamanho */}
              {(b.estilo || b.local_corpo || b.tamanho_aprox) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {b.estilo && (
                    <span style={{
                      background: 'color-mix(in srgb, var(--cor-acento) 12%, var(--cor-fundo-input))',
                      border: '1px solid color-mix(in srgb, var(--cor-acento) 30%, transparent)',
                      color: 'var(--cor-acento-claro)',
                      padding: '3px 10px',
                      borderRadius: 20,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}>
                      {b.estilo}
                    </span>
                  )}
                  {b.local_corpo && (
                    <span style={{
                      background: 'var(--cor-fundo-input)',
                      border: '1px solid var(--cor-borda)',
                      padding: '3px 10px',
                      borderRadius: 20,
                      fontSize: '0.75rem',
                      color: 'var(--cor-texto-fraco)',
                    }}>
                      {b.local_corpo}
                    </span>
                  )}
                  {b.tamanho_aprox && (
                    <span style={{
                      background: 'var(--cor-fundo-input)',
                      border: '1px solid var(--cor-borda)',
                      padding: '3px 10px',
                      borderRadius: 20,
                      fontSize: '0.75rem',
                      color: 'var(--cor-texto-fraco)',
                    }}>
                      {b.tamanho_aprox}
                    </span>
                  )}
                </div>
              )}

              {b.periodo_sugerido && (
                <p style={{ fontSize: '0.82rem', color: 'var(--cor-texto-fraco)', marginBottom: 8 }}>
                  Período preferido: <strong style={{ color: 'var(--cor-texto)' }}>{b.periodo_sugerido}</strong>
                </p>
              )}

              {b.descricao && (
                <p style={{ fontSize: '0.85rem', marginBottom: 10, whiteSpace: 'pre-line', lineHeight: 1.5 }}>
                  {b.descricao}
                </p>
              )}

              {b.foto_url ? (
                <a href={b.foto_url} target="_blank" rel="noreferrer" style={{ display: 'block', marginBottom: 10 }}>
                  <img
                    src={b.foto_url}
                    alt="Referência"
                    style={{ maxWidth: '100%', borderRadius: 8, marginTop: 8, marginBottom: 0, display: 'block', cursor: 'pointer' }}
                  />
                </a>
              ) : (
                <p style={{ fontSize: '0.8rem', color: 'var(--cor-texto-fraco)', marginBottom: 10 }}>Sem foto</p>
              )}

              {/* Data sugerida / confirmada */}
              {b.data_proposta && (
                <div style={{
                  background: 'color-mix(in srgb, var(--cor-acento) 8%, var(--cor-fundo-input))',
                  border: '1px solid color-mix(in srgb, var(--cor-acento) 25%, transparent)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  marginBottom: 10,
                }}>
                  <p style={{ fontSize: '0.72rem', letterSpacing: '0.12em', color: 'var(--cor-texto-fraco)', fontWeight: 700, marginBottom: 2 }}>
                    {b.status === 'confirmado' ? 'DATA CONFIRMADA' : 'DATA SUGERIDA PELO CLIENTE'}
                  </p>
                  <p style={{ fontWeight: 700, color: 'var(--cor-acento)', fontSize: '0.9rem' }}>
                    {formatarData(b.data_proposta)}
                    {b.hora_proposta && (
                      <span style={{ fontWeight: 400, fontSize: '0.85rem' }}> às {b.hora_proposta.slice(0, 5)}</span>
                    )}
                  </p>
                  {b.notas_admin && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--cor-texto-fraco)', marginTop: 4 }}>{b.notas_admin}</p>
                  )}
                </div>
              )}

              <p style={{ fontSize: '0.7rem', color: 'var(--cor-texto-fraco)', marginBottom: 12 }}>
                {new Date(b.criado_em).toLocaleString('pt-BR')}
              </p>

              {/* Ações */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {b.status === 'aguardando' && b.data_proposta && (
                  <>
                    <button
                      className="btn btn-primario"
                      style={{ flex: 1, minWidth: 110 }}
                      onClick={() => confirmarDireto(b)}
                    >
                      Confirmar
                    </button>
                    <button
                      className="btn btn-secundario"
                      style={{ flex: 1, minWidth: 100 }}
                      onClick={() => abrirModal(b)}
                    >
                      Reagendar
                    </button>
                    <button
                      className="btn btn-perigo"
                      style={{ flex: 1, minWidth: 90 }}
                      onClick={() => setModalCancelarId(b.id)}
                    >
                      Cancelar
                    </button>
                  </>
                )}
                {b.status === 'aguardando' && !b.data_proposta && (
                  <>
                    <button
                      className="btn btn-primario"
                      style={{ flex: 1, minWidth: 120 }}
                      onClick={() => abrirModal(b)}
                    >
                      Definir data
                    </button>
                    <button
                      className="btn btn-perigo"
                      style={{ flex: 1, minWidth: 100 }}
                      onClick={() => setModalCancelarId(b.id)}
                    >
                      Cancelar
                    </button>
                  </>
                )}
                {b.status === 'confirmado' && (
                  <>
                    <button
                      className="btn btn-secundario"
                      style={{ flex: 1, minWidth: 130, fontSize: '0.85rem' }}
                      onClick={() => abrirConcluir(b)}
                    >
                      ✓ Concluir sessão
                    </button>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                      onClick={() => abrirModal(b)}
                    >
                      Reagendar
                    </button>
                  </>
                )}
              </div>

              {/* Seção financeira — apenas confirmados */}
              {b.status === 'confirmado' && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--cor-borda)' }}>
                  {b.pago ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span className="badge badge-concluido">PAGO</span>
                      <span style={{ fontWeight: 700, color: 'var(--cor-sucesso)', fontSize: '0.95rem' }}>
                        R$ {Number(b.valor_combinado).toFixed(2)}
                      </span>
                      {b.data_pagamento && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--cor-texto-fraco)' }}>
                          {new Date(b.data_pagamento + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                  ) : b.valor_combinado ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--cor-acento)' }}>
                        R$ {Number(b.valor_combinado).toFixed(2)}
                      </span>
                      <button
                        className="btn btn-primario"
                        style={{ flex: 1, minWidth: 160, fontSize: '0.85rem', padding: '8px 12px', background: '#22c55e', border: 'none' }}
                        onClick={() => setModalPagB(b)}
                      >
                        ✓ Confirmar pagamento
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn btn-secundario"
                      style={{ fontSize: '0.85rem', padding: '8px 16px' }}
                      onClick={() => { setModalValorB(b); setValorModalInput('') }}
                    >
                      Informar valor
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal cancelar solicitação */}
      {modalCancelarId && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.78)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 16,
          }}
          onClick={e => e.target === e.currentTarget && !cancelando && setModalCancelarId(null)}
        >
          <div style={{ background: 'var(--cor-fundo-card)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 360 }}>
            <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--cor-texto-fraco)', marginBottom: 4 }}>
              CANCELAR SOLICITAÇÃO
            </p>
            <p style={{ marginBottom: 20, color: 'var(--cor-texto-fraco)', fontSize: '0.9rem' }}>
              Esta ação marcará a solicitação como cancelada. Deseja continuar?
            </p>
            {modalCancelarId._erro && (
              <div className="alerta alerta-erro" style={{ marginBottom: 16 }}>{modalCancelarId._erro}</div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-ghost"
                style={{ flex: 1 }}
                onClick={() => setModalCancelarId(null)}
                disabled={cancelando}
              >
                Voltar
              </button>
              <button
                className="btn btn-perigo"
                style={{ flex: 1 }}
                onClick={executarCancelar}
                disabled={cancelando}
              >
                {cancelando ? '...' : 'Cancelar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmação de data */}
      {modalConfirmarB && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.78)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 16,
          }}
          onClick={e => e.target === e.currentTarget && !confirmandoData && setModalConfirmarB(null)}
        >
          <div style={{ background: 'var(--cor-fundo-card)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 360 }}>
            <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--cor-texto-fraco)', marginBottom: 4 }}>
              CONFIRMAR SESSÃO
            </p>
            <h3 style={{ marginBottom: 4 }}>{modalConfirmarB.clientes?.nome}</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--cor-texto-fraco)', marginBottom: 20 }}>
              {modalConfirmarB.estilo || 'Tattoo'}{modalConfirmarB.local_corpo ? ` · ${modalConfirmarB.local_corpo}` : ''}
            </p>
            <div style={{
              background: 'var(--cor-fundo-input)',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 20,
            }}>
              <p style={{ fontSize: '0.7rem', color: 'var(--cor-texto-fraco)', letterSpacing: '0.1em', marginBottom: 4 }}>DATA SUGERIDA</p>
              <p style={{ fontWeight: 700, color: 'var(--cor-acento)' }}>
                {formatarData(modalConfirmarB.data_proposta)}
              </p>
            </div>
            {modalConfirmarB._erro && (
              <div className="alerta alerta-erro" style={{ marginBottom: 16 }}>{modalConfirmarB._erro}</div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-ghost"
                style={{ flex: 1 }}
                onClick={() => setModalConfirmarB(null)}
                disabled={confirmandoData}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primario"
                style={{ flex: 1 }}
                onClick={executarConfirmar}
                disabled={confirmandoData}
              >
                {confirmandoData ? '...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmação de pagamento */}
      {modalPagB && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.78)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 16,
          }}
          onClick={e => e.target === e.currentTarget && !confirmandoPag && !salvandoMat && fecharPagModal()}
        >
          <div style={{ background: 'var(--cor-fundo-card)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 360 }}>

            {!etapaMateriais ? (
              <>
                <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--cor-texto-fraco)', marginBottom: 4 }}>
                  CONFIRMAR PAGAMENTO
                </p>
                <h3 style={{ marginBottom: 4 }}>{modalPagB.clientes?.nome}</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--cor-texto-fraco)', marginBottom: 20 }}>
                  {modalPagB.estilo || 'Tattoo'}{modalPagB.local_corpo ? ` · ${modalPagB.local_corpo}` : ''}
                </p>
                <div style={{
                  background: 'var(--cor-fundo-input)',
                  borderRadius: 8, padding: '12px 16px', marginBottom: 20,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--cor-texto-fraco)' }}>Valor combinado</span>
                  <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--cor-acento)' }}>
                    R$ {Number(modalPagB.valor_combinado).toFixed(2)}
                  </span>
                </div>
                {modalPagB._erro && (
                  <div className="alerta alerta-erro" style={{ marginBottom: 16 }}>{modalPagB._erro}</div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={fecharPagModal} disabled={confirmandoPag}>
                    Cancelar
                  </button>
                  <button
                    className="btn btn-primario"
                    style={{ flex: 1, background: '#22c55e', border: 'none' }}
                    onClick={executarPagamento}
                    disabled={confirmandoPag}
                  >
                    {confirmandoPag ? '...' : '✓ Confirmar'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--cor-texto-fraco)', marginBottom: 4 }}>
                  REGISTRAR MATERIAIS
                </p>
                <h3 style={{ marginBottom: 4 }}>Registrar materiais usados?</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--cor-texto-fraco)', marginBottom: 20 }}>
                  Informe o custo dos materiais desta sessão (opcional)
                </p>
                <div className="input-grupo" style={{ marginBottom: 16 }}>
                  <input
                    className="input-campo"
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={valorMateriais}
                    onChange={e => { setValorMateriais(e.target.value.replace(/[^0-9.,]/g, '')); setErroPagMat('') }}
                    autoFocus
                    style={{ fontSize: '1.1rem', textAlign: 'center', letterSpacing: '0.05em' }}
                  />
                </div>
                {erroPagMateriais && (
                  <div className="alerta alerta-erro" style={{ marginBottom: 16 }}>{erroPagMateriais}</div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={fecharPagModal} disabled={salvandoMat}>
                    Pular
                  </button>
                  <button className="btn btn-primario" style={{ flex: 1 }} onClick={registrarMateriais} disabled={salvandoMat}>
                    {salvandoMat ? '...' : 'Registrar'}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}

      {/* Modal valor combinado */}
      {modalValorB && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.78)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 16,
          }}
          onClick={e => e.target === e.currentTarget && setModalValorB(null)}
        >
          <div style={{ background: 'var(--cor-fundo-card)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 360 }}>
            <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--cor-texto-fraco)', marginBottom: 4 }}>
              VALOR COMBINADO
            </p>
            <h3 style={{ marginBottom: 20 }}>{modalValorB.clientes?.nome}</h3>
            <form onSubmit={registrarValor} className="stack">
              <div className="input-grupo">
                <label>Valor (R$)</label>
                <input
                  className="input-campo"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={valorModalInput}
                  onChange={e => { setValorModalInput(e.target.value.replace(/[^0-9.,]/g, '')); setErroValorModal('') }}
                  autoFocus
                  style={{ fontSize: '1.1rem', textAlign: 'center', letterSpacing: '0.05em' }}
                />
              </div>
              {erroValorModal && <div className="alerta alerta-erro">{erroValorModal}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setModalValorB(null); setErroValorModal('') }}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primario" style={{ flex: 1 }} disabled={salvandoValor}>
                  {salvandoValor ? '...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal concluir sessão com abate no estoque */}
      {modalConcluirB && (
        <ModalConcluirSessao
          briefing={modalConcluirB}
          produtos={produtosEstoque}
          onConcluir={() => {
            setBriefings(prev => prev.filter(b => b.id !== modalConcluirB.id))
            setModalConcluirB(null)
            productsAPI.list().then(({ data }) => setProdutosEstoque(data || [])).catch(() => {})
          }}
          onFechar={() => setModalConcluirB(null)}
        />
      )}

      {/* Modal reagendar / definir data */}
      {modalB && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.78)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 16,
          }}
          onClick={e => e.target === e.currentTarget && setModalB(null)}
        >
          <div style={{
            background: 'var(--cor-fundo-card)',
            borderRadius: 16, padding: 24,
            width: '100%', maxWidth: 420,
          }}>
            <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--cor-texto-fraco)', marginBottom: 4 }}>
              {!modalB.data_proposta && modalB.status === 'aguardando' ? 'DEFINIR DATA' : 'REAGENDAR'}
            </p>
            <h3 style={{ marginBottom: 4 }}>{modalB.clientes?.nome}</h3>
            {(modalB.estilo || modalB.local_corpo) && (
              <p style={{ fontSize: '0.82rem', color: 'var(--cor-texto-fraco)', marginBottom: 20 }}>
                {[modalB.estilo, modalB.local_corpo].filter(Boolean).join(' · ')}
              </p>
            )}
            <form onSubmit={salvarData} className="stack">
              <div className="input-grupo">
                <label>Dia e mês *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <select
                    className="input-campo"
                    value={formDia}
                    onChange={e => setFormDia(e.target.value)}
                    autoFocus
                  >
                    <option value="">Dia</option>
                    {DIAS.map(d => <option key={d} value={String(d)}>{d}</option>)}
                  </select>
                  <select
                    className="input-campo"
                    value={formMes}
                    onChange={e => setFormMes(e.target.value)}
                  >
                    <option value="">Mês</option>
                    {MESES.map((m, i) => <option key={i} value={String(i + 1)}>{m}</option>)}
                  </select>
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--cor-texto-fraco)', marginTop: 4 }}>
                  Ano {new Date().getFullYear()}
                </p>
              </div>
              <div className="input-grupo">
                <label>Horário</label>
                <select className="input-campo" value={formHora} onChange={e => setFormHora(e.target.value)}>
                  <option value="">A combinar via WhatsApp</option>
                  {HORARIOS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div className="input-grupo">
                <label>Observações (opcional)</label>
                <textarea
                  className="input-campo"
                  rows={2}
                  placeholder="Informações adicionais..."
                  value={formNotas}
                  onChange={e => setFormNotas(e.target.value)}
                />
              </div>
              {erroModal && <div className="alerta alerta-erro">{erroModal}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primario" disabled={salvando} style={{ flex: 1 }}>
                  {salvando ? '...' : 'Confirmar data'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setModalB(null)} style={{ flex: 1 }}>
                  Fechar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
