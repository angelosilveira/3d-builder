/**
 * Valores mutáveis compartilhados entre componentes da cena a cada frame
 * (fora do React de propósito: mudam 60x/s e não devem causar renders).
 */
export const runtime = {
  /** Altura (m) do topo da estrutura exibida — usada por andaimes e elevador. */
  alturaEstrutura: 0,
}
