import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
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
    console.error('Falha na vista 3D do canteiro', erro, info.componentStack)
  }

  render() {
    if (!this.state.erro) return this.props.children
    return (
      <div className="cnt-scene-fallback" role="alert">
        <p className="cnt-scene-fallback-titulo">Não foi possível carregar a vista 3D do canteiro.</p>
        <p>
          Os painéis, a tabela e os alertas continuam atualizando ao vivo. Se o navegador estiver com aceleração gráfica
          desativada, ative-a e tente de novo.
        </p>
        <button type="button" className="cnt-btn" onClick={() => this.setState({ erro: null })}>
          Tentar carregar a vista 3D
        </button>
      </div>
    )
  }
}
