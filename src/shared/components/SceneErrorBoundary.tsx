import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Prefixo das classes CSS da tela que usa o componente (ex.: "cnt", "aps"). */
  prefixo?: string
}
interface State {
  erro: Error | null
}

/** Protege o HUD caso o WebGL falhe: os painéis continuam funcionando. */
export class SceneErrorBoundary extends Component<Props, State> {
  state: State = { erro: null }

  static getDerivedStateFromError(erro: Error): State {
    return { erro }
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error('Falha na vista 3D', erro, info.componentStack)
  }

  render() {
    if (!this.state.erro) return this.props.children
    const p = this.props.prefixo ?? 'cnt'
    return (
      <div className={`${p}-scene-fallback`} role="alert">
        <p className={`${p}-scene-fallback-titulo`}>Não foi possível carregar a vista 3D.</p>
        <p>
          Os painéis e as listas continuam funcionando. Se o navegador estiver com aceleração gráfica desativada, ative-a
          e tente de novo.
        </p>
        <button type="button" className={`${p}-btn`} onClick={() => this.setState({ erro: null })}>
          Tentar carregar a vista 3D
        </button>
      </div>
    )
  }
}
