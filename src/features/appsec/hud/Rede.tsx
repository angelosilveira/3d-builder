import { memo, useCallback, useMemo } from 'react'
import { AUTENTICACAO_LABEL, DADOS_LABEL, PROTOCOLO_LABEL } from '../data/catalogo'
import { conexaoArriscada } from '../data/derived'
import { useAppSecData } from '../data/store'
import type { Ativo, Conexao } from '../data/types'
import { arcoDaConexao, pontoNoArco } from '../scene/arcos'
import { cenaAnimada } from '../scene/Ecossistema'
import { registrarAncora, ZOOM_PROJETOS } from '../scene/rotulos'
import { ativoDaSelecao, redeDaSelecao } from '../state/rede'
import { useAppSecUi } from '../state/uiStore'
import { IconeTipo } from './ui'

/** Texto curto de uma conexão: "gRPC · mTLS", "HTTPS · Sem autenticação · sem TLS". */
export function resumoConexao(c: Conexao) {
  return [PROTOCOLO_LABEL[c.protocolo], AUTENTICACAO_LABEL[c.autenticacao], c.criptografada ? null : 'sem TLS'].filter(Boolean).join(' · ')
}

/* ---------------- Botão da barra de câmera ---------------- */

export function BotaoRede() {
  const visivel = useAppSecUi((s) => s.redeVisivel)
  const alternar = useAppSecUi((s) => s.alternarRede)
  const rotulo = visivel ? 'Ocultar as conexões do mapa' : 'Mostrar todas as conexões entre ativos'
  return (
    <button type="button" className={`aps-icon-btn aps-btn-rede${visivel ? ' is-ativo' : ''}`} aria-pressed={visivel} aria-label={rotulo} title={rotulo} onClick={alternar}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
        <circle cx="5" cy="18" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="19" cy="18" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="5.5" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M6.3 16.1C7 11 9 8.5 10.6 7.2M17.7 16.1C17 11 15 8.5 13.4 7.2M7.2 18h9.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </button>
  )
}

/* ---------------- Rótulos de protocolo sobre os arcos ---------------- */

const RotuloConexao = memo(function RotuloConexao({ c, pos }: { c: Conexao; pos: [number, number, number] }) {
  const ref = useCallback((el: HTMLSpanElement | null) => registrarAncora(`cnx:${c.id}`, el, pos, ZOOM_PROJETOS), [c.id, pos])
  return (
    <span ref={ref} className={`aps-rotulo-cnx${conexaoArriscada(c) ? ' is-risco' : ''}`} aria-hidden>
      {resumoConexao(c)}
    </span>
  )
})

/** Protocolo e autenticação no meio de cada ligação direta do ativo selecionado. */
export function RotulosRede() {
  const selecao = useAppSecUi((s) => s.selecao)
  const indice = useAppSecData((s) => s.indice)
  const layout = useAppSecData((s) => s.layout)
  const itens = useMemo(() => {
    if (!selecao || selecao.tipo === 'projeto' || selecao.tipo === 'analista') return []
    const rede = redeDaSelecao(selecao)
    if (!rede) return []
    const centro = ativoDaSelecao(selecao)
    // O rótulo fica perto do vizinho (e não no meio do arco): assim as várias
    // ligações de um mesmo ativo não se empilham no mesmo ponto.
    return rede.conexoes
      .filter((r) => r.salto === 1)
      .slice(0, 16)
      .flatMap(({ conexao }) => {
        const arco = arcoDaConexao(layout, indice.posAtivo, cenaAnimada.topo, conexao.origemId, conexao.destinoId)
        return arco ? [{ c: conexao, pos: pontoNoArco(arco, conexao.origemId === centro ? 0.78 : 0.22) }] : []
      })
  }, [selecao, indice, layout])
  return (
    <div className="aps-rotulos aps-rotulos-rede">
      {itens.map(({ c, pos }) => (
        <RotuloConexao key={c.id} c={c} pos={pos} />
      ))}
    </div>
  )
}

/* ---------------- Aba "Conexões" do card ---------------- */

function ItemConexao({ c, outro, sentido }: { c: Conexao; outro: Ativo; sentido: 'saida' | 'entrada' }) {
  const selecionar = useAppSecUi((s) => s.selecionar)
  const indice = useAppSecData((s) => s.indice)
  const projetoDe = indice.ativoPorId.get(sentido === 'saida' ? c.origemId : c.destinoId)?.projetoId
  const outroProjeto = outro.projetoId !== projetoDe
  const risco = conexaoArriscada(c)
  return (
    <li className={risco ? 'is-risco' : undefined}>
      <button type="button" className="aps-ir aps-cnx-btn" onClick={() => selecionar({ tipo: 'ativo', id: outro.id })}>
        <span className="aps-cnx-seta" aria-hidden>
          {sentido === 'saida' ? '→' : '←'}
        </span>
        <IconeTipo tipo={outro.tipo} />
        <span className="aps-lista-nome aps-mono">{outro.nome}</span>
        {outroProjeto && <span className="aps-cnx-ext">outro projeto</span>}
      </button>
      <span className="aps-cnx-meta">
        <span className="aps-cnx-chip">{PROTOCOLO_LABEL[c.protocolo]}</span>
        <span className={`aps-cnx-chip${c.autenticacao === 'nenhuma' ? ' is-risco' : ''}`}>{AUTENTICACAO_LABEL[c.autenticacao]}</span>
        {!c.criptografada && <span className="aps-cnx-chip is-risco">Sem TLS</span>}
        <span className="aps-muted">{DADOS_LABEL[c.dados]}</span>
      </span>
    </li>
  )
}

export function ConexoesDoAtivo({ ativo }: { ativo: Ativo }) {
  const indice = useAppSecData((s) => s.indice)
  const saida = indice.conexoesSaida.get(ativo.id) ?? []
  const entrada = indice.conexoesEntrada.get(ativo.id) ?? []
  const arriscadas = [...saida, ...entrada].filter(conexaoArriscada).length
  if (!saida.length && !entrada.length) return <p className="aps-muted aps-pequeno">Nenhuma conexão registrada para este ativo.</p>
  return (
    <div className="aps-cnx">
      {arriscadas > 0 && (
        <p className="aps-aviso aps-aviso-ruim">
          {arriscadas} {arriscadas === 1 ? 'conexão sem autenticação ou sem TLS' : 'conexões sem autenticação ou sem TLS'}.
        </p>
      )}
      {[
        { titulo: `Consome (${saida.length})`, lista: saida, sentido: 'saida' as const },
        { titulo: `Consumido por (${entrada.length})`, lista: entrada, sentido: 'entrada' as const },
      ].map(
        (g) =>
          g.lista.length > 0 && (
            <div key={g.sentido}>
              <h4 className="aps-cnx-titulo">{g.titulo}</h4>
              <ul className="aps-cnx-lista" aria-label={g.titulo}>
                {g.lista.map((c) => {
                  const outro = indice.ativoPorId.get(g.sentido === 'saida' ? c.destinoId : c.origemId)
                  return outro ? <ItemConexao key={c.id} c={c} outro={outro} sentido={g.sentido} /> : null
                })}
              </ul>
            </div>
          ),
      )}
    </div>
  )
}

/** Resumo da rede de um projeto (para o card do projeto). */
export function useResumoRedeProjeto(projetoId: string) {
  const data = useAppSecData((s) => s.data)
  const indice = useAppSecData((s) => s.indice)
  return useMemo(() => {
    let internas = 0
    let saem = 0
    let chegam = 0
    let arriscadas = 0
    for (const c of data.conexoes) {
      const o = indice.ativoPorId.get(c.origemId)?.projetoId
      const d = indice.ativoPorId.get(c.destinoId)?.projetoId
      if (o !== projetoId && d !== projetoId) continue
      if (o === d) internas++
      else if (o === projetoId) saem++
      else chegam++
      if (conexaoArriscada(c)) arriscadas++
    }
    return { internas, saem, chegam, arriscadas }
  }, [data, indice, projetoId])
}
