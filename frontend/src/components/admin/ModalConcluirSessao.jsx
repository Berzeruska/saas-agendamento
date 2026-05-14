import { useState } from 'react'
import { createPortal } from 'react-dom'
import { productsAPI, adminAPI, briefingsAPI } from '../../services/api'

export default function ModalConcluirSessao({ briefing, produtos, onConcluir, onFechar }) {
  const temValor   = Boolean(briefing.valor_combinado)
  const estaPago   = Boolean(briefing.pago)

  const [etapa, setEtapa]           = useState(temValor ? 'materiais' : 'valor')
  const [valorInput, setValorInput] = useState(temValor ? String(briefing.valor_combinado) : '')
  const [erroValor, setErroValor]   = useState('')
  const [qtdUsada, setQtdUsada]     = useState({})
  const [salvando, setSalvando]     = useState(false)
  const [erro, setErro]             = useState('')

  function avancar(e) {
    e.preventDefault()
    const v = parseFloat(valorInput.replace(',', '.'))
    if (!valorInput.trim() || isNaN(v) || v <= 0) {
      setErroValor('Informe um valor válido para a sessão.')
      return
    }
    setErroValor('')
    setEtapa('materiais')
  }

  async function finalizar(registrarMat) {
    setSalvando(true)
    setErro('')
    try {
      if (registrarMat) {
        const itens = produtos.filter(p => (qtdUsada[p.id] || 0) > 0)
        for (const prod of itens) {
          const qty     = qtdUsada[prod.id]
          const novaQtd = Math.max(0, prod.quantidade - qty)
          await productsAPI.updateStock(prod.id, novaQtd)
          await adminAPI.registrarGasto({
            valor:       qty * Number(prod.preco),
            descricao:   prod.nome,
            briefing_id: briefing.id,
          })
        }
      }

      if (!temValor) {
        // Caso 1: sem valor — concluir já salva valor_combinado + status=concluido
        const v = parseFloat(valorInput.replace(',', '.'))
        await briefingsAPI.concluir(briefing.id, { valor_sessao: v })
      } else if (!estaPago) {
        // Caso 2: tem valor mas não está pago — marcar pago + concluir
        await briefingsAPI.confirmarPagamento(briefing.id)
        await briefingsAPI.concluir(briefing.id)
      } else {
        // Caso 3: já está pago — só concluir
        await briefingsAPI.concluir(briefing.id)
      }

      onConcluir()
    } catch (e) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, padding: 16,
      }}
      onClick={e => e.target === e.currentTarget && !salvando && onFechar()}
    >
      <div style={{
        background: 'var(--cor-fundo-card)',
        borderRadius: 20,
        width: '100%', maxWidth: 440,
        maxHeight: '80vh',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* Cabeçalho */}
        <div style={{ position: 'relative', padding: '24px 24px 20px' }}>
          <button type="button" onClick={() => !salvando && onFechar()}
            style={{ position: 'absolute', top: 12, right: 12, width: 28, height: 28, borderRadius: '50%', background: 'var(--cor-fundo-input)', border: '1px solid var(--cor-borda)', color: 'var(--cor-texto-fraco)', cursor: salvando ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', lineHeight: 1, opacity: salvando ? 0.5 : 1 }}>×</button>
          <p style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.28em', color: 'var(--cor-texto-fraco)', marginBottom: 10 }}>
            CONCLUIR SESSÃO{etapa === 'materiais' ? ' · MATERIAIS' : ''}
          </p>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.02em', color: 'var(--cor-acento)', lineHeight: 1.15, marginBottom: 6, fontFamily: 'var(--fonte-display)' }}>
            {briefing.clientes?.nome}
          </p>
          {(briefing.estilo || briefing.local_corpo) && (
            <p style={{ fontSize: '0.82rem', color: 'var(--cor-texto-fraco)' }}>
              {briefing.estilo || 'Tattoo'}{briefing.local_corpo ? ` · ${briefing.local_corpo}` : ''}
            </p>
          )}
        </div>

        <div style={{ height: 1, background: 'var(--cor-borda)' }} />

        {/* Etapa 1: valor */}
        {etapa === 'valor' && (
          <form onSubmit={avancar} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, padding: '28px 24px 0' }}>
              <p style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.22em', color: 'var(--cor-texto-fraco)', marginBottom: 16 }}>
                VALOR DA SESSÃO
              </p>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--cor-texto-fraco)', fontSize: '1rem', pointerEvents: 'none' }}>R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={valorInput}
                  onChange={e => {
                    setErroValor('')
                    setValorInput(e.target.value.replace(/[^0-9,\.]/g, ''))
                  }}
                  autoFocus
                  style={{
                    width: '100%', padding: '18px 16px 18px 44px',
                    background: 'var(--cor-fundo-input)',
                    border: `1px solid ${erroValor ? 'var(--cor-erro)' : 'var(--cor-borda)'}`,
                    borderRadius: 12, color: 'var(--cor-texto)',
                    fontSize: '1.5rem', fontWeight: 700,
                    outline: 'none', boxSizing: 'border-box',
                    fontFamily: 'var(--fonte-display)',
                  }}
                />
              </div>
              {erroValor && (
                <p style={{ fontSize: '0.78rem', color: 'var(--cor-erro)', marginTop: 8 }}>{erroValor}</p>
              )}
            </div>
            <div style={{ padding: '20px 24px 24px', borderTop: '1px solid var(--cor-borda)', marginTop: 'auto' }}>
              <button type="submit" className="btn btn-primario" style={{ width: '100%', fontSize: '0.82rem', letterSpacing: '0.12em', padding: '14px' }}>
                PRÓXIMO →
              </button>
            </div>
          </form>
        )}

        {/* Etapa 2: materiais */}
        {etapa === 'materiais' && (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 0' }}>
              <p style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.22em', color: 'var(--cor-texto-fraco)', marginBottom: 16 }}>
                MATERIAIS UTILIZADOS{' '}
                <span style={{ fontWeight: 400, letterSpacing: 0, fontSize: '0.7rem' }}>(opcional)</span>
              </p>

              {produtos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '12px 0 20px' }}>
                  <p style={{ fontSize: '0.9rem', color: 'var(--cor-texto-fraco)', marginBottom: 4 }}>
                    Nenhum material cadastrado.
                  </p>
                  <p style={{ fontSize: '0.82rem', color: 'var(--cor-texto-fraco)' }}>
                    Adicione itens em{' '}
                    <span style={{ color: 'var(--cor-acento)', fontWeight: 600 }}>Materiais</span>.
                  </p>
                </div>
              ) : (
                <div style={{ marginBottom: 8 }}>
                  {produtos.map((prod, i) => (
                    <div key={prod.id}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 3 }}>{prod.nome}</p>
                          <p style={{ fontSize: '0.68rem', color: 'var(--cor-texto-fraco)' }}>
                            Em estoque: {prod.quantidade} · R$ {Number(prod.preco).toFixed(2)}/un
                          </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <button type="button"
                            onClick={() => setQtdUsada(prev => ({ ...prev, [prod.id]: Math.max(0, (prev[prod.id] || 0) - 1) }))}
                            style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, background: 'var(--cor-fundo-input)', border: '1px solid var(--cor-borda)', color: 'var(--cor-texto)', fontSize: '1.2rem', lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >−</button>
                          <input
                            type="text" inputMode="numeric" pattern="[0-9]*"
                            value={qtdUsada[prod.id] ?? 0}
                            onChange={e => {
                              const raw = e.target.value.replace(/\D/g, '')
                              const v   = parseInt(raw, 10)
                              setQtdUsada(prev => ({ ...prev, [prod.id]: isNaN(v) ? 0 : Math.min(prod.quantidade, v) }))
                            }}
                            style={{ width: 52, height: 34, textAlign: 'center', background: 'var(--cor-fundo-input)', border: '1px solid var(--cor-borda)', borderRadius: 8, color: 'var(--cor-texto)', fontSize: '1rem', fontWeight: 700, outline: 'none' }}
                          />
                          <button type="button"
                            onClick={() => setQtdUsada(prev => ({ ...prev, [prod.id]: Math.min(prod.quantidade, (prev[prod.id] || 0) + 1) }))}
                            style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, background: 'var(--cor-acento)', border: 'none', color: '#fff', fontSize: '1.2rem', lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >+</button>
                        </div>
                      </div>
                      {i < produtos.length - 1 && <div style={{ height: 1, background: 'var(--cor-borda)' }} />}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: '16px 24px 24px', borderTop: '1px solid var(--cor-borda)' }}>
              {erro && <div className="alerta alerta-erro" style={{ marginBottom: 12 }}>{erro}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {produtos.length > 0 && (
                  <button
                    className="btn btn-primario"
                    style={{ fontSize: '0.78rem', letterSpacing: '0.12em', padding: '14px' }}
                    onClick={() => finalizar(true)}
                    disabled={salvando}
                  >
                    {salvando ? '...' : 'REGISTRAR USO'}
                  </button>
                )}
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: '0.78rem', letterSpacing: '0.12em', padding: '14px' }}
                  onClick={() => finalizar(false)}
                  disabled={salvando}
                >
                  {salvando ? '...' : 'PULAR'}
                </button>
              </div>
            </div>
          </>
        )}

      </div>
    </div>,
    document.body
  )
}
