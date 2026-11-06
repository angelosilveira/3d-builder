import { Outlines } from '@react-three/drei'
import type { ThreeElements, ThreeEvent } from '@react-three/fiber'
import { createContext, forwardRef, useContext, useEffect, useMemo, type ReactNode } from 'react'
import type * as THREE from 'three'
import { useCanteiroStore } from '../state/canteiroStore'
import { useSelecionar } from '../state/useSelecionar'
import { COR } from './palette'

type Realce = 'nenhum' | 'hover' | 'selecionado'

const RealceContext = createContext<Realce>('nenhum')

/** Estado de realce de um id — re-renderiza só quando muda para este id. */
export function useRealce(id: string): Realce {
  return useCanteiroStore((s) => (s.selecionadoId === id ? 'selecionado' : s.hoverId === id ? 'hover' : 'nenhum'))
}

/** Handlers de ponteiro padrão para qualquer objeto selecionável. */
export function useHandlersSelecao(id: string) {
  const setHover = useCanteiroStore((s) => s.setHover)
  const selecionar = useSelecionar()
  return useMemo(
    () => ({
      onPointerOver: (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation()
        setHover(id)
      },
      onPointerOut: (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation()
        if (useCanteiroStore.getState().hoverId === id) setHover(null)
      },
      onClick: (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation()
        selecionar(id)
      },
    }),
    [id, setHover, selecionar],
  )
}

interface GroupProps {
  id: string
  children: ReactNode
  position?: [number, number, number]
  rotation?: [number, number, number]
}

/** Grupo clicável: todas as peças (<Part>) dentro dele ganham contorno juntas. */
export const SelectableGroup = forwardRef<THREE.Group, GroupProps>(function SelectableGroup(
  { id, children, position, rotation },
  ref,
) {
  const realce = useRealce(id)
  const handlers = useHandlersSelecao(id)
  return (
    <group ref={ref} position={position} rotation={rotation} {...handlers} userData={{ selId: id }}>
      <RealceContext.Provider value={realce}>{children}</RealceContext.Provider>
    </group>
  )
})

/** Contorno conforme o realce do grupo pai. */
export function Contorno({ forcar }: { forcar?: Realce }) {
  const ctx = useContext(RealceContext)
  const realce = forcar ?? ctx
  if (realce === 'nenhum') return null
  return (
    // Sem `screenspace`: neste drei a espessura fica em pixels nesse ramo do shader
    // (o ramo screenspace desloca no espaço do objeto e explode com primitivas escaladas).
    <Outlines
      thickness={realce === 'selecionado' ? 2.5 : 2}
      color={realce === 'selecionado' ? COR.prancha : COR.grafite}
      opacity={realce === 'selecionado' ? 1 : 0.8}
      transparent
    />
  )
}

type PartProps = ThreeElements['mesh'] & { semContorno?: boolean }

/** Malha de um objeto selecionável, com sombra e contorno. */
export function Part({ children, semContorno, ...props }: PartProps) {
  return (
    <mesh castShadow receiveShadow {...props}>
      {children}
      {!semContorno && <Contorno />}
    </mesh>
  )
}

/** Cursor de ponteiro enquanto houver algo sob o mouse na cena. */
export function CursorDaCena() {
  const temHover = useCanteiroStore((s) => s.hoverId !== null)
  useEffect(() => {
    document.body.style.cursor = temHover ? 'pointer' : ''
    return () => {
      document.body.style.cursor = ''
    }
  }, [temHover])
  return null
}
