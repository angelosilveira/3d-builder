import type { StatusConcretagem, StatusElemento, StatusEquipamento, StatusMaterial } from '../data/types'

type Tom = 'neutro' | 'azul' | 'verde' | 'amarelo' | 'vermelho'

const ROTULOS: Record<string, [string, Tom]> = {
  // Elementos estruturais
  planejado: ['Planejado', 'neutro'],
  em_execucao: ['Em execução', 'azul'],
  concluido: ['Concluído', 'verde'],
  nao_conforme: ['Não conforme', 'vermelho'],
  // Equipamentos
  operando: ['Operando', 'verde'],
  parado: ['Parado', 'vermelho'],
  manutencao: ['Em manutenção', 'amarelo'],
  em_transito: ['Em trânsito', 'azul'],
  aguardando: ['Aguardando na obra', 'amarelo'],
  descarregando: ['Descarregando', 'azul'],
  liberado: ['Liberado', 'neutro'],
  // Concretagens
  programada: ['Programada', 'neutro'],
  em_andamento: ['Em andamento', 'azul'],
  concluida: ['Concluída', 'verde'],
  atrasada: ['Atrasada', 'vermelho'],
  // Materiais
  em_estoque: ['Em estoque', 'verde'],
  estoque_baixo: ['Estoque baixo', 'amarelo'],
  em_falta: ['Em falta', 'vermelho'],
  // FVS
  aberta: ['FVS aberta', 'neutro'],
  em_verificacao: ['Em verificação', 'amarelo'],
  aprovada: ['Aprovada', 'verde'],
}

export type StatusQualquer =
  | StatusElemento
  | StatusEquipamento
  | StatusConcretagem
  | StatusMaterial
  | 'aberta'
  | 'em_verificacao'
  | 'aprovada'

export function rotuloStatus(status: StatusQualquer): string {
  return ROTULOS[status]?.[0] ?? status
}

export function StatusPill({ status, rotulo }: { status: StatusQualquer; rotulo?: string }) {
  const [texto, tom] = ROTULOS[status] ?? [status, 'neutro']
  return (
    <span className={`cnt-pill cnt-pill-${tom}`}>
      <i aria-hidden />
      {rotulo ?? texto}
    </span>
  )
}
