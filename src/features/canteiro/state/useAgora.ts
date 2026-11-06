import { useEffect, useState } from 'react'

/** Relógio compartilhado por componente; re-renderiza só quem o usa. */
export function useAgora(intervaloMs = 1000): Date {
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setAgora(new Date()), intervaloMs)
    return () => window.clearInterval(id)
  }, [intervaloMs])
  return agora
}
