import { useEffect, useRef } from 'react'
import { STATUS_LABEL, TIPO_LABEL } from '../data/catalogo'
import { useAppSecData } from '../data/store'
import { useAppSecUi } from '../state/uiStore'

/** Dica junto ao cursor para o ativo/projeto sob o mouse na cena. */
export function Tooltip() {
  const hoverId = useAppSecUi((s) => s.hoverId)
  const indice = useAppSecData((s) => s.indice)
  const data = useAppSecData((s) => s.data)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mover = (e: PointerEvent) => {
      if (ref.current) ref.current.style.transform = `translate3d(${e.clientX + 14}px, ${e.clientY + 16}px, 0)`
    }
    window.addEventListener('pointermove', mover)
    return () => window.removeEventListener('pointermove', mover)
  }, [])

  const ativo = hoverId ? indice.ativoPorId.get(hoverId) : undefined
  const projeto = !ativo && hoverId ? data.projetos.find((p) => p.id === hoverId) : undefined
  const i = ativo ? indice.posAtivo.get(ativo.id)! : -1

  return (
    <div ref={ref} className="aps-tooltip" hidden={!ativo && !projeto} role="status" aria-live="off">
      {ativo && (
        <>
          <strong>{ativo.nome}</strong>
          <span>
            {TIPO_LABEL[ativo.tipo]} · <b className={`aps-txt-${ativo.qualificacao.status}`}>{STATUS_LABEL[ativo.qualificacao.status]}</b>
          </span>
          {indice.abertas[i] > 0 && <span>{indice.abertas[i]} vulnerabilidade(s) aberta(s)</span>}
        </>
      )}
      {projeto && (
        <>
          <strong>{projeto.nome}</strong>
          <span>
            Projeto · {indice.ativosPorProjeto.get(projeto.id)?.length ?? 0} ativos
          </span>
        </>
      )}
    </div>
  )
}
