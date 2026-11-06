import { useGLTF } from '@react-three/drei'
import { Suspense, type ReactNode } from 'react'

/**
 * Ponto de troca para modelos GLTF. Hoje todos os objetos são procedurais;
 * para usar um modelo real, registre a URL aqui (ex.: grua: '/modelos/grua.glb').
 * O fallback procedural continua aparecendo enquanto o arquivo carrega.
 */
export type NomeModelo = 'grua' | 'betoneira' | 'bomba' | 'escavadeira' | 'retroescavadeira' | 'container' | 'trabalhador'

export const MODELOS_GLTF: Partial<Record<NomeModelo, string>> = {}

function Gltf({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  return <primitive object={scene.clone()} />
}

export function ModelSlot({ nome, children }: { nome: NomeModelo; children: ReactNode }) {
  const url = MODELOS_GLTF[nome]
  if (!url) return <>{children}</>
  return (
    <Suspense fallback={children}>
      <Gltf url={url} />
    </Suspense>
  )
}
