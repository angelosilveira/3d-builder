import { useCallback } from 'react'
import { conquistas, nivelDe, pontuacao } from '../data/gamificacao'
import { useAppSecData } from '../data/store'
import { useEfeitos } from './efeitos'

/**
 * Executa uma ação e transforma o efeito real na postura em recompensa:
 * mede a pontuação antes e depois, detecta conquistas desbloqueadas no
 * projeto e mudança de nível, e emite os efeitos correspondentes.
 */
export function useAcaoGamificada() {
  const emitir = useEfeitos((s) => s.emitir)
  return useCallback(
    (acao: () => void, ativoId: string, mensagem: string) => {
      const antes = useAppSecData.getState()
      const ativo = antes.indice.ativoPorId.get(ativoId)
      const doProjeto = ativo ? (antes.indice.ativosPorProjeto.get(ativo.projetoId) ?? []) : []
      const pontosAntes = pontuacao(antes.data, antes.indice).total
      const projetoAntes = pontuacao(antes.data, antes.indice, doProjeto).total
      const conquistasAntes = new Set(conquistas(antes.indice, doProjeto).filter((c) => c.obtida).map((c) => c.id))

      acao()

      const depois = useAppSecData.getState()
      const pontosDepois = pontuacao(depois.data, depois.indice).total
      // A recompensa é medida no projeto: no total (3.000+ ativos) uma ação mexe pouco.
      const delta = pontuacao(depois.data, depois.indice, doProjeto).total - projetoAntes
      const projeto = ativo ? depois.data.projetos.find((p) => p.id === ativo.projetoId) : undefined
      emitir({
        ativoId,
        flutuante: delta > 0 ? `+${delta} pts` : '✓',
        mensagem: delta > 0 ? `${mensagem} · ${projeto?.nome ?? 'projeto'} +${delta} pts de postura` : mensagem,
        tipo: 'acao',
      })

      const novas = conquistas(depois.indice, doProjeto).filter((c) => c.obtida && !conquistasAntes.has(c.id))
      for (const c of novas) {
        emitir({ ativoId, flutuante: null, mensagem: `Conquista desbloqueada em ${projeto?.nome}: ${c.nome}`, tipo: 'conquista' })
      }
      const nivelAntes = nivelDe(pontosAntes).atual
      const nivelDepois = nivelDe(pontosDepois).atual
      if (nivelDepois.ordem > nivelAntes.ordem) {
        emitir({ ativoId, flutuante: null, mensagem: `Novo nível de postura: ${nivelDepois.nome}!`, tipo: 'nivel' })
      }
    },
    [emitir],
  )
}
