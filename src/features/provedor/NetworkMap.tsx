import {districts,cityStreets,type UrbanArea} from './city'
import type { OutageGroup } from './outages'
import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../../shared/hooks/useReducedMotion'
import {
  accessPoints,
  clientById,pointById,
  clientsByPoint,
  headquarters,
  islands,
  regions,
  signalColor,
  statusText,
  type AccessPoint,
  type Client,
  type Incident,
  type Island,
} from './data'
import {
  connectionPoint,
  islandSize,
  paintTraffic,
  pickPoint,
  pointTop,
  markerHeight,
  overview,
  paintLandscape,
  pickIsland,
  projector,
  zoomLimit,
  type HomeHit,
  type View,
} from './landscape'
import { Icon } from './icons'
import { selectionBeacon, towerSignals } from './mapEffects'
import { centroObra, obras, progressoGeral, statusObra, STATUS_OBRA_LABEL, tamanhoObra, type Obra } from './obras'
import { ancoraObra, animarObras, destacarObra, montarObras, pickObra } from './obrasModel'

interface Props {
  obra: Obra | null
  dataObras: string | null
  selectObra: (obra: Obra) => void
  activeGroup:OutageGroup|null
  area:UrbanArea|null
  selectArea:(area:UrbanArea)=>void
  groups:OutageGroup[]
  investigate:(group:OutageGroup)=>void
  island: Island | null
  site: AccessPoint | null
  client: Client | null
  panelOpen: boolean
  incidents: Map<string, Incident>
  selectIsland: (island: Island | null) => void
  selectSite: (point: AccessPoint) => void
  selectClient: (client: Client) => void
}
export default function NetworkMap({
  obra,
  dataObras,
  selectObra,
  activeGroup,area,selectArea,groups,investigate,
  island,
  site,
  client,
  panelOpen,
  incidents,
  selectIsland,
  selectSite,
  selectClient,
}: Props) {
  const reduced = useReducedMotion()
  const host = useRef<HTMLDivElement>(null),
    surface = useRef<HTMLCanvasElement>(null),
    effects = useRef<HTMLCanvasElement>(null)
  const labels = useRef(new Map<string, HTMLButtonElement>())
  const target = useRef<View>({ ...overview }),
    current = useRef<View>({ ...overview })
  const wake = useRef<() => void>(() => {}),
    homes = useRef<HomeHit[]>([])
  const clock = useRef(0)
  const hint = useRef<HTMLDivElement>(null)
  function hitClient(x: number, y: number) {
    let nearest: HomeHit | undefined,
      best = Infinity
    for (const hit of homes.current) {
      const d = Math.hypot(x - hit.x, y - hit.y)
      if (d < hit.radius && d < best) {
        nearest = hit
        best = d
      }
    }
    return nearest?.client
  }
  const zoomText = useRef<HTMLOutputElement>(null)
  const drag = useRef<{ x: number; y: number; view: View; rotate: boolean; moved: boolean } | null>(null)
  const [paused, setPaused] = useState(false),
    [failed, setFailed] = useState(false),
    [reset, setReset] = useState(0)
  useEffect(() => {
    const place = client ?? site ?? area ?? island
    const el = host.current
    const baseScale = el ? projector(el.clientWidth, el.clientHeight, overview, true).scale : 10
    if (obra && !client && !site) {
      const [ox, oz] = centroObra(obra)
      target.current = { ...overview, x: ox, z: oz, zoom: zoomLimit(Math.min(8, 90 / (tamanhoObra(obra) + 6))) }
      wake.current()
      return
    }
    target.current = {
      ...overview,
      x: place?.x ?? 0,
      z: place?.z ?? 0,
      zoom: client ? zoomLimit(145 / baseScale) : site ? 11 : area?.kind==='street'?9.2:area?6.4:island===headquarters?1.7:island?4.5:1,
    }
    wake.current()
  }, [island, site, client, area,reset, obra])

  useEffect(() => {
    const el = host.current,
      canvas = surface.current,
      fx = effects.current
    if (!el || !canvas || !fx) return
    const ctx = canvas.getContext('2d'),
      anim = fx.getContext('2d')
    if (!ctx || !anim) {
      setFailed(true)
      return
    }
    let width = 1,
      height = 1,
      dirty = true,
      frame = 0,
      last = 0
    const members=activeGroup?new Set(activeGroup.reports.map(r=>r.clientId)):null
    const alerts = [...incidents.values()].map((item) => ({ client: clientById.get(item.clientId)!, kind: item.kind }))
    const still = reduced || paused
    const canteiros = montarObras(dataObras)
    function schedule() {
      if (!frame && !document.hidden) frame = requestAnimationFrame(render)
    }
    function resize() {
      if (!canvas || !fx || !el || !ctx || !anim) return
      width = el.clientWidth
      height = el.clientHeight
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      for (const layer of [canvas, fx]) {
        layer.width = Math.round(width * dpr)
        layer.height = Math.round(height * dpr)
      }
      for (const context of [ctx, anim]) context.setTransform(dpr, 0, 0, dpr, 0, 0)
      dirty = true
      schedule()
    }
    function render(now: number) {
      if (!ctx || !anim) return
      frame = 0
      const dt = last ? Math.min(60, now - last) : 16
      last = now
      if (!still) clock.current += dt
      const elapsed = clock.current
      const view = current.current
      for (const key of ['x', 'z', 'zoom', 'angle'] as const) {
        const diff = target.current[key] - view[key]
        if (!diff) continue
        view[key] = still || Math.abs(diff) < 0.0007 ? target.current[key] : view[key] + diff * (1 - Math.exp(-dt / 85))
        dirty = true
      }
      const camera = projector(width, height, view, panelOpen)
      if (dirty) {
        ctx.clearRect(0, 0, width, height)
        if (hint.current) hint.current.hidden = true
        homes.current = paintLandscape(ctx, camera, incidents, site, client, area, members, {
          ...canteiros.desenho,
          destaque: destacarObra(obra),
        })
        function label(id: string, x: number, y: number, visible: boolean) {
          const node = labels.current.get(id)
          if (!node) return
          node.hidden = !visible || x < -18 || y < 12 || x > width + 18 || y > height
          if (!node.hidden) {
            node.style.left = x + 'px'
            node.style.top = y + 'px'
          }
        }
        for (const it of islands) {
          const [x, y] = camera.project(it.x, -0.7, it.z + islandSize(it).rz * 0.94)
          label(it.id, x, y + 5, view.zoom < 4)
        }
        for(const district of districts){
          const [x,y]=camera.project(district.x,1.4,district.z)
          label(district.id,x,y,!site&&!client&&!area&&view.zoom>=1.35&&view.zoom<5)
        }
        for(const [i,street] of cityStreets.entries()){
          if(street.districtId!==area?.districtId)continue
          const [x,y]=camera.project(street.x+(area?.kind==='street'?0:i%2===0?-3.7:3.7),1.08,street.z)
          label(street.id,x,y,!site&&!client&&(area?.kind==='district'||area.id===street.id))
        }
        for(const group of groups){
          const point=pointById.get(group.pointId)!
          const [x,y]=camera.project(point.x,pointTop(point),point.z)
          label(group.id,x,y-26,!client&&!area&&!site&&groups.find(g=>g.pointId===point.id)?.id===group.id)
        }
        for (const point of accessPoints) {
          const [x, y] = camera.project(point.x, pointTop(point), point.z)
          const chosen = site?.id === point.id && !client
          label(point.id, x, y - (chosen ? 18 : 3), chosen || (view.zoom >= (point.regionId===headquarters.id?3:2.5) && view.zoom < 24))
        }
        if (client) {
          const [x, y] = camera.project(client.x, markerHeight, client.z)
          label(client.id, x, y - 19, true)
        }
        for (const o of obras) {
          const [x, y] = camera.project(...ancoraObra(o, dataObras))
          const escolhida = obra?.id === o.id
          label('obra:' + o.id, x, y, escolhida || (!client && !site && !area && (dataObras !== null || view.zoom >= 1.25) && view.zoom < 24 && !(obra && o.local.forma === 'ponto')))
        }
        if (zoomText.current) zoomText.current.value = Math.round(view.zoom * 100) + '%'
      }
      if (!still || dirty) {
        anim.clearRect(0, 0, width, height)
        paintTraffic(anim, camera, elapsed)
        towerSignals(anim, camera, elapsed, still)
        animarObras(anim, camera, elapsed, still, canteiros, dataObras)
        for (const [index, region] of regions.entries()) {
          const progress = 0.3 + ((elapsed / 2400 + index * 0.25) % 1) * 0.35
          const [x, y] = camera.project(...connectionPoint(region, progress))
          anim.fillStyle = '#a8ffda'
          anim.beginPath()
          anim.arc(x, y, 2.2, 0, Math.PI * 2)
          anim.fill()
        }
        const phase = (elapsed % 2000) / 2000
        for (const a of alerts) {
          const [x, y] = camera.project(a.client.x, markerHeight, a.client.z)
          anim.strokeStyle = signalColor[a.kind]
          anim.globalAlpha = still ? 0.8 : 0.85 * (1 - phase)
          anim.lineWidth = 1.6
          anim.beginPath()
          anim.arc(x, y, still ? 7 : 4 + phase * 10, 0, 2 * Math.PI)
          anim.stroke()
        }
        anim.globalAlpha = 1
        selectionBeacon(anim, camera, client, site, elapsed, still, client ? incidents.get(client.id)?.kind : undefined)
      }
      dirty = false
      if (!still) schedule()
    }
    function wheel(event: WheelEvent) {
      event.preventDefault()
      if (!el) return
      const bounds = el.getBoundingClientRect(),
        px = event.clientX - bounds.left,
        py = event.clientY - bounds.top
      const goal = target.current
      const before = projector(width, height, goal, panelOpen).groundAt(px, py)
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1
      goal.zoom = zoomLimit(goal.zoom * Math.exp(-Math.max(-280, Math.min(280, event.deltaY * unit)) * 0.0024))
      const after = projector(width, height, goal, panelOpen).groundAt(px, py)
      goal.x += before[0] - after[0]
      goal.z += before[1] - after[1]
      schedule()
    }
    function visibility() {
      if (document.hidden) {
        cancelAnimationFrame(frame)
        frame = 0
        last = 0
      } else {
        dirty = true
        schedule()
      }
    }
    const observer = new ResizeObserver(resize)
    wake.current = schedule
    observer.observe(el)
    resize()
    el.addEventListener('wheel', wheel, { passive: false })
    document.addEventListener('visibilitychange', visibility)
    return () => {
      wake.current = () => {}
      cancelAnimationFrame(frame)
      observer.disconnect()
      el.removeEventListener('wheel', wheel)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [incidents, site, client, activeGroup,area,groups,panelOpen, reduced, paused, obra, dataObras])
  const keep = (id: string, el: HTMLButtonElement | null) => {
    if (el) labels.current.set(id, el)
    else labels.current.delete(id)
  }
  const zoom = (factor: number) => {
    target.current.zoom = zoomLimit(target.current.zoom * factor)
    wake.current()
  }
  const resetView = () => {
    selectIsland(null)
    setReset((n) => n + 1)
  }
  return (
    <section className="pv-map" aria-label="Mapa tridimensional da rede">
      <div className="pv-map-grid" />
      <div className="pv-viewport" ref={host}>
        <canvas
          ref={surface}
          aria-label="Arraste para mover o mapa e use a roda do mouse para aproximar"
          onPointerDown={(e) => {
            if (e.button !== 0) return
            if (hint.current) hint.current.hidden = true
            drag.current = {
              x: e.clientX,
              y: e.clientY,
              view: { ...current.current },
              rotate: e.shiftKey,
              moved: false,
            }
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            const start = drag.current,
              el = host.current
            if (!el) return
            if (!start) {
              const tip = hint.current
              if (!tip || e.pointerType === 'touch') return
              const bounds = el.getBoundingClientRect(),
                x = e.clientX - bounds.left,
                y = e.clientY - bounds.top
              const cam = projector(el.clientWidth, el.clientHeight, current.current, panelOpen)
              const point = pickPoint(cam, x, y)
              const hovered = point ?? hitClient(x, y)
              const sobreObra = hovered ? undefined : pickObra(cam, x, y)
              tip.hidden = !hovered && !sobreObra
              e.currentTarget.style.cursor = hovered || sobreObra ? 'pointer' : 'grab'
              if (sobreObra) {
                tip.textContent = sobreObra.nome + ' · ' + Math.round(progressoGeral(sobreObra, dataObras) * 100) + '%'
                tip.style.left = Math.max(5, Math.min(el.clientWidth - tip.offsetWidth - 5, x + 12)) + 'px'
                tip.style.top = Math.max(5, y - 34) + 'px'
              }
              if (hovered) {
                tip.textContent =
                  hovered.name + ' · ' + (point ? point.id : statusText[incidents.get(hovered.id)?.kind ?? 'online'])
                tip.style.left = Math.max(5, Math.min(el.clientWidth - tip.offsetWidth - 5, x + 12)) + 'px'
                tip.style.top = Math.max(5, y - 34) + 'px'
              }
              return
            }
            const dx = e.clientX - start.x,
              dy = e.clientY - start.y
            if (Math.hypot(dx, dy) > 4) start.moved = true
            if (!start.moved) return
            if (start.rotate) target.current.angle = start.view.angle + dx * 0.006
            else {
              const p = projector(el.clientWidth, el.clientHeight, start.view, panelOpen)
              const a = p.groundAt(0, 0),
                b = p.groundAt(dx, dy)
              target.current = { ...start.view, x: start.view.x + a[0] - b[0], z: start.view.z + a[1] - b[1] }
            }
            wake.current()
          }}
          onPointerUp={(e) => {
            const start = drag.current,
              el = host.current
            if (!el || !start || start.moved) return
            const bounds = el.getBoundingClientRect(),
              x = e.clientX - bounds.left,
              y = e.clientY - bounds.top
            const cam = projector(el.clientWidth, el.clientHeight, current.current, panelOpen)
            const point = pickPoint(cam, x, y)
            if (point) {
              selectSite(point)
              return
            }
            for (const inc of incidents.values()) {
              const c = clientById.get(inc.clientId)!
              const [px, py] = cam.project(c.x, markerHeight, c.z)
              if (Math.hypot(x - px, y - py) < 8) {
                selectClient(c)
                return
              }
            }
            const home = hitClient(x, y)
            if (home) {
              selectClient(home)
              return
            }
            const canteiro = pickObra(cam, x, y)
            if (canteiro) {
              selectObra(canteiro)
              return
            }
            const it = pickIsland(cam, x, y)
            if (it) selectIsland(it)
          }}
          onPointerLeave={() => {
            if (hint.current) hint.current.hidden = true
          }}
          onLostPointerCapture={() => {
            drag.current = null
          }}
        />
        <div ref={hint} hidden className="pv-cursor-hint" aria-hidden="true" />
        <canvas ref={effects} className="pv-effects" aria-hidden="true" />
        {failed ? (
          <p className="pv-fallback">Vista gráfica indisponível. Acesse os clientes pelo explorador.</p>
        ) : (
          <>
            {islands.map((it) => (
              <button
                key={it.id}
                ref={(el) => keep(it.id, el)}
                className={'pv-island-label' + (it === headquarters ? ' pv-hq' : '')}
                onClick={() => selectIsland(it)}
              >
                {it === headquarters ? <Icon name="tower" /> : <i style={{ background: it.color }} />}
                <span className="pv-place-name">
                  <small>{it === headquarters ? 'Sede urbana' : 'Zona rural'}</small>
                  {it.name}
                </span>
                {it !== headquarters && (
                  <span aria-hidden="true" className="pv-coverage">
                    {accessPoints
                      .filter((p) => p.regionId === it.id)
                      .reduce((sum, p) => sum + clientsByPoint.get(p.id)!.length, 0)}
                  </span>
                )}
              </button>
            ))}
            {districts.map(d=><button key={d.id} hidden ref={el=>keep(d.id,el)} className="pv-geo-label" onClick={()=>selectArea(d)}>{d.name}</button>)}
            {area&&cityStreets.filter(st=>st.districtId===area.districtId).map(st=><button hidden key={st.id} ref={el=>keep(st.id,el)} className="pv-geo-label street" onClick={()=>selectArea(st)}>{st.name}</button>)}
            {groups.map(g=><button hidden key={g.id} ref={el=>keep(g.id,el)} className="pv-outage-pin" onClick={()=>investigate(g)} aria-label={'Investigar possível falha em '+g.pointId}><Icon name="alert"/>{g.reports.length} quedas</button>)}
            {client && (
              <button
                ref={(el) => keep(client.id, el)}
                className="pv-selected-home"
                onClick={() => selectClient(client)}
              >
                {client.name}
              </button>
            )}
            {obras.map((o) => {
              const st = statusObra(o)
              const valor = Math.round(progressoGeral(o, dataObras) * 100)
              return (
                <button
                  hidden
                  key={o.id}
                  ref={(el) => keep('obra:' + o.id, el)}
                  className={'pv-obra-pin ' + st}
                  aria-pressed={obra?.id === o.id}
                  onClick={() => selectObra(o)}
                  title={o.nome}
                  aria-label={`Obra ${o.nome}: ${valor}% ${dataObras ? 'previsto na data' : 'executado'}, ${STATUS_OBRA_LABEL[st]}`}
                >
                  <Icon name="obra" />
                  <span>{o.id}</span>
                  <b>{valor}%</b>
                </button>
              )
            })}
            {accessPoints.map((p) => (
              <button
                hidden
                key={p.id}
                ref={(el) => keep(p.id, el)}
                onClick={() => selectSite(p)}
                className={'pv-site-pin ' + p.technology}
                aria-pressed={p.id === site?.id && !client}
                title={p.name + ' · ' + p.id}
                aria-label={p.name + ' · ' + p.id}
              >
                <Icon name={p.technology === 'radio' ? 'tower' : 'network'} />
                {p.id}
              </button>
            ))}
          </>
        )}
      </div>
      <div className="pv-map-bottom">
        <div className="pv-legend">
          <span>
            <i className="online" />
            Operacional
          </span>
          <span>
            <i className="unstable" />
            Instável
          </span>
          <span>
            <i className="offline" />
            Sem conexão
          </span>
        </div>
        <span className="pv-map-tip">Role para ajustar o zoom · Arraste para mover</span>
        <div className="pv-map-controls">
          <button onClick={() => zoom(1 / 1.4)} title="Afastar" aria-label="Afastar">
            <Icon name="minus" />
          </button>
          <output ref={zoomText}>100%</output>
          <button onClick={() => zoom(1.4)} title="Aproximar" aria-label="Aproximar">
            <Icon name="plus" />
          </button>
          <button
            onClick={() => {
              target.current.angle += Math.PI / 6
              wake.current()
            }}
            title="Girar mapa"
            aria-label="Girar mapa"
          >
            <Icon name="rotate" />
          </button>
          <button onClick={resetView} title="Visão geral" aria-label="Visão geral do mapa">
            <Icon name="focus" />
          </button>
          {!reduced && (
            <button
              aria-pressed={paused}
              onClick={() => setPaused((v) => !v)}
              aria-label={paused ? 'Retomar animações' : 'Pausar animações'}
            >
              <Icon name={paused ? 'play' : 'pause'} />
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
