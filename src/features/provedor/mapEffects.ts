import { accessPoints, type AccessPoint, type Client, type IncidentKind } from './data'
import { pointTop, type Projection } from './landscape'

export function towerSignals(ctx: CanvasRenderingContext2D, camera: Projection, time: number, still: boolean) {
  for (const [i, site] of accessPoints.entries()) {
    if (site.technology !== 'radio') continue
    const [x, y] = camera.project(site.x, pointTop(site), site.z)
    if (x < -40 || x > camera.width + 40 || y < -40 || y > camera.height + 40) continue
    const phase = still ? 0.45 : (time / 2350 + i * 0.27) % 1
    const radius = Math.max(5, Math.min(23, camera.scale * 0.64))
    ctx.save()
    ctx.fillStyle = '#8ff2ff'
    ctx.shadowColor = '#62d9ed'
    ctx.shadowBlur = 5
    ctx.beginPath()
    ctx.arc(x, y, 2.1, 0, 2 * Math.PI)
    ctx.fill()
    ctx.shadowBlur = 0
    for (const side of [-1, 1]) {
      ctx.strokeStyle = 'rgba(65,190,212,' + (1 - phase) * 0.85 + ')'
      ctx.lineWidth = 1.55
      ctx.beginPath()
      const angle = side < 0 ? Math.PI : 0
      ctx.arc(x, y, radius * (0.4 + phase), angle - 0.68, angle + 0.68)
      ctx.stroke()
    }
    ctx.restore()
  }
}

export function selectionBeacon(
  ctx: CanvasRenderingContext2D,
  camera: Projection,
  home: Client | null,
  site: AccessPoint | null,
  time: number,
  still: boolean,
  incident?: IncidentKind,
) {
  const subject = home ?? site
  if (!subject) return
  const [x, base] = camera.project(subject.x, 0.88, subject.z)
  const [, top] = camera.project(subject.x, home ? 1.64 : pointTop(site!), subject.z)
  const radius = Math.max(9, Math.min(72, camera.scale * (home ? 0.46 : 0.65)))
  const height = Math.max(40, Math.min(138, base - top + 38))
  const rgb = incident === 'offline' ? '255,137,126' : incident === 'unstable' || !home ? '255,205,112' : '104,255,216'
  ctx.save()
  const beam = ctx.createLinearGradient(0, base, 0, top - height * 0.45)
  beam.addColorStop(0, 'rgba(' + rgb + ',.28)')
  beam.addColorStop(0.56, 'rgba(' + rgb + ',.12)')
  beam.addColorStop(1, 'rgba(' + rgb + ',0)')
  ctx.fillStyle = beam
  ctx.fillRect(x - radius, top - height * 0.45, radius * 2, base - top + height * 0.45)
  const phase = still ? 0.35 : (time / 1550) % 1
  ctx.strokeStyle = 'rgb(' + rgb + ')'
  ctx.lineWidth = 2.4
  ctx.shadowColor = 'rgb(' + rgb + ')'
  ctx.shadowBlur = 7
  ctx.beginPath()
  ctx.ellipse(x, base, radius, radius * 0.55, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.shadowBlur = 0
  ctx.lineWidth = 1.6
  ctx.globalAlpha = still ? 0.67 : 0.85 * (1 - phase)
  ctx.beginPath()
  ctx.ellipse(x, base, radius * (1.12 + 0.48 * phase), radius * (1.12 + 0.48 * phase) * 0.55, 0, 0, 2 * Math.PI)
  ctx.stroke()
  ctx.globalAlpha = 1
  // A fixed downward chevron remains legible with animations paused or reduced.
  const cy = top - 5 - (still ? 0 : Math.sin(time / 275) * 2.5)
  ctx.lineWidth = 3
  ctx.strokeStyle = '#183c45'
  ctx.fillStyle = 'rgb(' + rgb + ')'
  ctx.beginPath()
  ctx.moveTo(x - 5, cy - 6)
  ctx.lineTo(x + 5, cy - 6)
  ctx.lineTo(x, cy)
  ctx.closePath()
  ctx.stroke()
  ctx.fill()
  if (!still) {
    for (let i = 0; i < 5; i++) {
      const t = (phase + i * 0.2) % 1
      ctx.globalAlpha = 0.7 * (1 - t)
      ctx.beginPath()
      ctx.arc(x + Math.sin(i * 7.1) * radius * 0.74, base - (base - top + height * 0.3) * t, 1.6, 0, 2 * Math.PI)
      ctx.fill()
    }
  }
  ctx.restore()
}
