import {urbanAreas,type UrbanArea} from './city'
import {groupOpenOutages,type OutageGroup} from './outages'
import {OutageCards,Investigation,CityDirectory} from './OperationsPanels'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  accessPoints,
  clientsByPoint,
  clientById,
  pointById,
  type AccessPoint,
  addIncident,
  clients,
  dateLabel,
  headquarters,
  islands,
  closeIncident,isIncidentStorageKey,
  money,
  readIncidents,
  regions,
  statusText,
  type Client,
  type Connection,
  type Incident,
  type IncidentKind,
  type Island,
} from './data'
import { facilityAt } from './facility'
import { Icon } from './icons'
import NetworkMap from './NetworkMap'
import './provedor.css'

function Status({ value }: { value: Connection }) {
  return (
    <span className={'pv-status ' + value}>
      <i />
      {statusText[value]}
    </span>
  )
}
function ClientRow({ client, incident, onClick }: { client: Client; incident?: Incident; onClick: () => void }) {
  return (
    <button className="pv-row" onClick={onClick}>
      <span className={'pv-avatar ' + (incident?.kind ?? 'online')}>
        {client.name
          .split(' ')
          .map((word) => word[0])
          .join('')}
      </span>
      <span className="pv-row-label">
        <strong>{client.name}</strong>
        <small>
          {client.id} · {client.speed} Mega
        </small>
      </span>
      <Icon name="arrow" />
    </button>
  )
}
function IncidentForm({ client, onSave }: { client: Client; onSave: (items: Incident[]) => void }) {
  const [editing, setEditing] = useState(false)
  const [kind, setKind] = useState<IncidentKind>('offline')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  function submit(e: FormEvent) {
    e.preventDefault()
    try {
      const items = addIncident({ clientId: client.id, kind, note: note.trim(), opened: new Date().toISOString() })
      onSave(items)
    } catch {
      setError('Não foi possível salvar neste navegador. Tente novamente.')
    }
  }
  if (!editing)
    return (
      <button className="pv-action" onClick={() => setEditing(true)}>
        <Icon name="plus" /> Registrar incidente
      </button>
    )
  return (
    <form className="pv-form" onSubmit={submit}>
      <h3>Registrar incidente</h3>
      <label>
        Tipo de ocorrência
        <select value={kind} onChange={(e) => setKind(e.target.value as IncidentKind)}>
          <option value="offline">Sem conexão</option>
          <option value="unstable">Instabilidade</option>
        </select>
      </label>
      <label>
        Relato do cliente{' '}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={600}
          placeholder="Descrição opcional"
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <div className="pv-actions">
        <button type="submit" className="pv-action">
          Registrar
        </button>
        <button type="button" className="pv-link" onClick={() => setEditing(false)}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

function FacilityDetails({ point }: { point: AccessPoint }) {
  const details = facilityAt(point)
  return (
    <section className="pv-facility">
      <div className="pv-section-title">
        <h3>{point.technology === 'radio' ? 'Inventário da torre' : 'Inventário da estação'}</h3>
        <b>{details.materials.length}</b>
      </div>
      <ul>
        {details.materials.map((m) => (
          <li key={m.item}>
            <div>
              <strong>{m.item}</strong>
              <small>{m.specification}</small>
            </div>
            <span>
              {m.quantity} {m.unit}
            </span>
          </li>
        ))}
      </ul>
      <details className="pv-device">
        <summary>Operação e manutenção</summary>
        <dl className="pv-data">
          {[
            ['Ponto', point.id],
            ['Enlace de transporte', details.backhaul],
            ['Em operação desde', dateLabel(details.installed)],
            ['Responsável', details.team],
            ['Última vistoria', dateLabel(details.lastInspection)],
            ['Próxima vistoria', dateLabel(details.nextInspection)],
          ].map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  )
}
function ClientDetails({
  client,
  incident,
  onSave,
  onSite,
}: {
  client: Client
  incident?: Incident
  onSite: (site: AccessPoint) => void
  onSave: (items: Incident[]) => void
}) {
  const [closeError,setCloseError]=useState(false)
  const point = pointById.get(client.pointId)!
  const total = client.invoices.reduce((acc, item) => acc + item.cents, 0)
  return (
    <>
      <div className="pv-detail-title">
        <span className="pv-kicker">{client.id}</span>
        <h2>{client.name}</h2>
        <Status value={incident?.kind ?? 'online'} />
      </div>
      <dl className="pv-data">
        <div>
          <dt>Cadastro</dt>
          <dd>{dateLabel(client.since)}</dd>
        </div>
        <div>
          <dt>Plano contratado</dt>
          <dd>{client.speed} Mega</dd>
        </div>
        <div>
          <dt>Endereço</dt>
          <dd>{client.address}{client.districtId?' · '+urbanAreas.get(client.districtId)?.name:''}</dd>
        </div>
      </dl>
      <div className="pv-section-title">
        <h3>Ponto de atendimento</h3>
      </div>
      <button className="pv-row" onClick={() => onSite(point)}>
        <span className="pv-region-icon">
          <Icon name={point.technology === 'radio' ? 'tower' : 'network'} />
        </span>
        <span className="pv-row-label">
          <strong>{point.name}</strong>
          <small>
            {point.id} · {point.technology === 'radio' ? 'Rádio' : 'Fibra GPON'}
          </small>
        </span>
        <Icon name="arrow" />
      </button>
      <div className="pv-section-title">
        <h3>Equipamentos instalados</h3>
        <b>{client.equipment.length}</b>
      </div>
      {client.equipment.map((device) => (
        <details className="pv-device" key={device.serial}>
          <summary>
            {device.type}
            <small>{device.model}</small>
          </summary>
          <p>
            Série <code>{device.serial}</code>
            <br />
            Instalação em {dateLabel(device.installed)}
          </p>
        </details>
      ))}
      <div className="pv-section-title">
        <h3>Faturas em aberto</h3>
        <b>{client.invoices.length}</b>
      </div>
      {total > 0 ? (
        <div className="pv-bills">
          {client.invoices.map((item) => (
            <div key={item.due}>
              <span>Venc. {dateLabel(item.due)}</span>
              <strong>{money(item.cents)}</strong>
            </div>
          ))}
          <div className="pv-total">
            <span>Total em aberto</span>
            <strong>{money(total)}</strong>
          </div>
        </div>
      ) : (
        <p className="pv-empty">Nenhuma fatura em aberto.</p>
      )}
      {incident ? (
        <div className={'pv-report ' + incident.kind}>
          <h3>
            <Icon name="alert" />
            Incidente aberto
          </h3>
          <Status value={incident.kind} />
          <p>{incident.note || 'Ocorrência registrada sem descrição.'}</p>
          <small>
            Aberto em{' '}
            {new Date(incident.opened).toLocaleString('pt-BR', {
              timeZone: 'America/Bahia',
              dateStyle: 'short',
              timeStyle: 'short',
            })}
          </small>
          <button className="pv-action pv-close-report" onClick={()=>{try{onSave(closeIncident(incident));setCloseError(false)}catch{setCloseError(true)}}}>Encerrar ocorrência</button>
          {closeError&&<p role="alert">Não foi possível salvar o encerramento.</p>}
        </div>
      ) : (
        <IncidentForm client={client} onSave={onSave} />
      )}
    </>
  )
}
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
export default function ProvedorPage() {
  const [island, setIsland] = useState<Island | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [site, setSite] = useState<AccessPoint | null>(null)
  const [area,setArea]=useState<UrbanArea|null>(null)
  const [investigationId,setInvestigationId]=useState<string|null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [pointDirectory, setPointDirectory] = useState(false)
  const [showIncidents, setShowIncidents] = useState(false)
  const [onlyAffected, setOnlyAffected] = useState(false)
  const [items, setItems] = useState(readIncidents)
  const [announcement, setAnnouncement] = useState('')
  const [fullscreen, setFullscreen] = useState(false)
  const root = useRef<HTMLDivElement>(null),
    panel = useRef<HTMLElement>(null),
    exploreButton = useRef<HTMLButtonElement>(null)
  const incidents = useMemo(() => new Map(items.map((i) => [i.clientId, i])), [items])
  const groups=useMemo(()=>groupOpenOutages(items),[items])
  const investigation=groups.find(g=>g.id===investigationId)
  const clientGroup=client?groups.find(g=>g.reports.some(r=>r.clientId===client.id)):undefined
  const incidentClients = useMemo(
    () =>
      [...items].sort((a, b) => Date.parse(b.opened) - Date.parse(a.opened)).map((i) => clientById.get(i.clientId)!),
    [items],
  )
  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (isIncidentStorageKey(e.key)) setItems(readIncidents())
    }
    const onFull = () => setFullscreen(document.fullscreenElement === root.current)
    window.addEventListener('storage', sync)
    document.addEventListener('fullscreenchange', onFull)
    return () => {
      window.removeEventListener('storage', sync)
      document.removeEventListener('fullscreenchange', onFull)
    }
  }, [])
  function closePanel() {
    setPanelOpen(false)
    exploreButton.current?.focus()
  }
  function enter() {
    setPanelOpen(true)
    setPage(0)
    setArea(null);setInvestigationId(null)
    setQuery('')
    setOnlyAffected(false)
    setPointDirectory(false)
    setShowIncidents(false)
    setAnnouncement('')
    requestAnimationFrame(() => {
      if (panel.current) {
        panel.current.scrollTop = 0
        panel.current.focus({ preventScroll: true })
      }
    })
  }
  function chooseIsland(next: Island | null) {
    enter()
    setIsland(next)
    setSite(null)
    setClient(null)
    if (!next) setPanelOpen(false)
  }
  function chooseSite(next: AccessPoint) {
    enter()
    setSite(next)
    setIsland(islands.find((r) => r.id === next.regionId)!)
    setClient(null)
  }
  function chooseArea(next:UrbanArea){chooseIsland(headquarters);setArea(next)}
  function inspect(group:OutageGroup){chooseSite(pointById.get(group.pointId)!);setInvestigationId(group.id)}
  function chooseClient(next: Client) {
    enter()
    if(area && (area.id===next.districtId||area.id===next.streetId))setArea(area)
    if(investigation?.reports.some(r=>r.clientId===next.id))setInvestigationId(investigation.id)
    setClient(next)
    setIsland(islands.find((r) => r.id === next.regionId)!)
    setSite(pointById.get(next.pointId)!)
  }
  function openExplorer(alerts = false) {
    chooseIsland(null)
    setPanelOpen(true)
    setShowIncidents(alerts)
  }
  function back() {
    if(client&&investigation)inspect(investigation)
    else if(client&&area)chooseArea(area)
    else if(investigation)openExplorer(true)
    else if (client && site) chooseSite(site)
    else if(area?.kind==='street')chooseArea(urbanAreas.get(area.districtId)!)
    else if(area)chooseIsland(headquarters)
    else if (site) chooseIsland(island)
    else openExplorer()
  }
  const filter = normalize(query.trim())
  const match = (value: string) => normalize(value).includes(filter)
  const filteredRegions = regions.filter((r) => match('Zona rural ' + r.name))
  const filteredSites = accessPoints.filter((p) => (!island || p.regionId === island.id) && match(p.name + ' ' + p.id))
  const regionalClients = island ? clients.filter((c) => c.regionId === island.id) : clients
  const areaClients=area?regionalClients.filter(c=>c.districtId===area.id||c.streetId===area.id):regionalClients
  const pool = site ? clientsByPoint.get(site.id)! : showIncidents ? incidentClients : areaClients
  const results = pool.filter(
    (c) => (!onlyAffected || incidents.has(c.id)) && match(c.name+' '+c.id+' '+c.address+' '+(urbanAreas.get(c.districtId??'')?.name??'')),
  )
  const showClients = !!(site || island || showIncidents || filter)
  const affected = pool.filter((c) => incidents.has(c.id)).length
  const pageCount = Math.max(1, Math.ceil(results.length / 20)),
    activePage = Math.min(page, pageCount - 1)
  const localNumber = (n: number) => n.toLocaleString('pt-BR')
  const title =
    client?.name ??
    site?.name ?? area?.name ??
    island?.name ??
    (pointDirectory ? 'Pontos de acesso' : showIncidents ? 'Incidentes abertos' : 'Explorar rede')
  return (
    <div
      className={'pv pv-atlas' + (panelOpen ? ' panel-open' : '')}
      ref={root}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && panelOpen) closePanel()
      }}
    >
      <main className="pv-stage">
        <NetworkMap
          activeGroup={investigation??null} area={area} selectArea={chooseArea} groups={groups} investigate={inspect}
          island={island}
          site={site}
          client={client}
          panelOpen={panelOpen}
          incidents={incidents}
          selectIsland={chooseIsland}
          selectSite={chooseSite}
          selectClient={chooseClient}
        />
        <header className="pv-console">
          <div className="pv-brand">
            <span className="pv-logo">
              <i />
              <i />
              <i />
            </span>
            Atlas<span>Fibra</span>
          </div>
          <span className="pv-console-divider" />
          <h1>Mapa da rede</h1>
          <span className="pv-location">
            <Icon name="pin" /> Aracatu · BA
          </span>
          <div className="pv-console-actions">
            <button
              ref={exploreButton}
              className="pv-explore"
              aria-label={panelOpen ? 'Fechar explorador' : 'Explorar rede'}
              aria-expanded={panelOpen}
              aria-controls="pv-explorer"
              onClick={() => (panelOpen ? closePanel() : openExplorer())}
            >
              <Icon name="search" />
              <span>Explorar rede</span>
            </button>
            {document.fullscreenEnabled && (
              <button
                className="pv-tool"
                aria-label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia do navegador'}
                title={fullscreen ? 'Sair da tela cheia' : 'Tela cheia do navegador'}
                onClick={async () => {
                  try {
                    if (document.fullscreenElement) await document.exitFullscreen()
                    else await root.current?.requestFullscreen()
                  } catch {
                    setAnnouncement('O navegador não permitiu entrar em tela cheia.')
                  }
                }}
              >
                <Icon name="focus" />
              </button>
            )}
            <Link to="/" className="pv-tool" title="Voltar para obras" aria-label="Voltar para obras">
              <Icon name="exit" />
            </Link>
          </div>
        </header>
        <div className="pv-summary">
          <button onClick={() => openExplorer()}>
            <Icon name="people" />
            <strong>{localNumber(clients.length)}</strong> clientes
          </button>
          <button
            onClick={() => {
              openExplorer()
              setPointDirectory(true)
            }}
            title="Explorar pontos de acesso"
          >
            <Icon name="network" />
            <strong>{accessPoints.length}</strong> pontos
          </button>
          <button onClick={() => openExplorer(true)}>
            <Icon name="alert" />
            <strong>{incidents.size}</strong> incidentes
          </button>
        </div>
        <small className="pv-demo-tag">Dados de demonstração</small>
        {panelOpen && (
          <aside className="pv-panel" aria-label="Explorador da rede" id="pv-explorer" tabIndex={-1} ref={panel}>
            <div className="pv-panel-nav">
              {island || showIncidents || pointDirectory ? (
                <button className="pv-link" onClick={back}>
                  <Icon name="back" />
                  {client&&investigation?'Investigação':client?(area?.name??site?.id):investigation?'Incidentes abertos':area?.kind==='street'?urbanAreas.get(area.districtId)?.name:area?'Aracatu':site?island?.name:'Visão geral'}
                </button>
              ) : (
                <span className="pv-kicker">ARACATU · BA</span>
              )}
              <button className="pv-tool" onClick={closePanel} aria-label="Fechar painel">
                ×
              </button>
            </div>
            {clientGroup && <button className="pv-hq-link" onClick={()=>inspect(clientGroup)}><Icon name="alert"/>Investigar falha com {clientGroup.reports.length} clientes</button>}
            {client ? (
              <ClientDetails
                key={client.id}
                client={client}
                incident={incidents.get(client.id)}
                onSite={chooseSite}
                onSave={(next) => {
                  setItems(next)
                  setAnnouncement(next.some(i=>i.clientId===client.id)?'Incidente registrado no mapa.':'Ocorrência encerrada. Triagem atualizada.')
                }}
              />
            ) : investigation ? <Investigation group={investigation} openClient={id=>chooseClient(clientById.get(id)!)} openPoint={()=>chooseSite(pointById.get(investigation.pointId)!)}/> : (
              <>
                {island && <span className="pv-kicker">{island === headquarters ? 'SEDE URBANA' : 'ZONA RURAL'}</span>}
                <h2>{title}</h2>
                {island === headquarters && !site && !area && (
                  <p className="pv-empty">
                    Sede urbana · {regionalClients.length} assinantes na cidade. O provedor atende também{' '}
                    {regions.length} regiões da zona rural.
                  </p>
                )}
                {area&&!site&&<p className="pv-empty">{area.kind==='street'?urbanAreas.get(area.districtId)?.name:'Bairro de Aracatu'} · {areaClients.length} assinantes</p>}
                {site ? (
                  <>
                    <div className="pv-kicker">
                      {site.id} · {site.technology === 'radio' ? 'RÁDIO' : 'FIBRA GPON'}
                    </div>
                    <dl className="pv-data">
                      <div>
                        <dt>{island === headquarters ? 'Cidade' : 'Zona rural'}</dt>
                        <dd>{island?.name}</dd>
                      </div>
                      <div>
                        <dt>Clientes atendidos</dt>
                        <dd>
                          {pool.length} de {site.capacity}
                        </dd>
                      </div>
                      <div>
                        <dt>Capacidade disponível</dt>
                        <dd>{site.capacity - pool.length} acessos</dd>
                      </div>
                      <div>
                        <dt>Clientes com incidente</dt>
                        <dd>{affected}</dd>
                      </div>
                    </dl>
                    <progress
                      className="pv-capacity"
                      aria-label="Ocupação do ponto"
                      value={pool.length}
                      max={site.capacity}
                    />
                    {groups.some(g=>g.pointId===site.id)&&<OutageCards groups={groups.filter(g=>g.pointId===site.id)} inspect={inspect}/>}
                    <FacilityDetails point={site} />
                  </>
                ) : island && island !== headquarters ? (
                  <p className="pv-empty">
                    {regionalClients.length} clientes · {affected} com incidente
                  </p>
                ) : null}
                <label className="pv-search">
                  <Icon name="search" />
                  <input
                    aria-label="Pesquisar na rede"
                    value={query}
                    placeholder={site || showIncidents ? 'Buscar assinante…' : 'Buscar região, ponto ou cliente…'}
                    onChange={(e) => {
                      setQuery(e.target.value)
                      setPage(0)
                    }}
                  />
                </label>
                {showIncidents&&<OutageCards groups={groups.filter(g=>match(g.pointId+' '+pointById.get(g.pointId)!.name)||g.reports.some(r=>match(clientById.get(r.clientId)!.name)))} inspect={inspect}/>}
                {!site&&!showIncidents&&!pointDirectory&&(island===headquarters||!island&&filter)&&<CityDirectory area={area} choose={chooseArea} match={match} searching={!!filter}/>}
                {!island && !showIncidents && !pointDirectory && (
                  <>
                    {filteredRegions.length > 0 && (
                      <div className="pv-section-title">
                        <h3>Regiões da zona rural</h3>
                        <b>{filteredRegions.length}</b>
                      </div>
                    )}
                    {filteredRegions.map((r) => {
                      const towns = clients.filter((c) => c.regionId === r.id)
                      const alerts = towns.filter((c) => incidents.has(c.id)).length
                      return (
                        <button className="pv-row" key={r.id} onClick={() => chooseIsland(r)}>
                          <span className="pv-region-icon" style={{ color: r.color }}>
                            <Icon name="layers" />
                          </span>
                          <span className="pv-row-label">
                            <strong>{r.name}</strong>
                            <small>
                              {towns.length} clientes · {accessPoints.filter((p) => p.regionId === r.id).length} pontos
                            </small>
                          </span>
                          {alerts > 0 && (
                            <span className="pv-count">
                              <Icon name="alert" />
                              {alerts}
                            </span>
                          )}
                          <Icon name="arrow" />
                        </button>
                      )
                    })}
                    {match('Cidade de Aracatu sede urbana') && (
                      <button className="pv-hq-link" onClick={() => chooseIsland(headquarters)}>
                        <Icon name="tower" />
                        Explorar a cidade de Aracatu
                        <Icon name="arrow" />
                      </button>
                    )}
                  </>
                )}
                {!site && !area && !showIncidents && (island!==headquarters || pointDirectory) && (island || filter || pointDirectory) && filteredSites.length > 0 && (
                  <>
                    <div className="pv-section-title">
                      <h3>Pontos de acesso</h3>
                      <b>{filteredSites.length}</b>
                    </div>
                    {filteredSites.map((p) => (
                      <button className="pv-row" key={p.id} onClick={() => chooseSite(p)}>
                        <span className="pv-region-icon">
                          <Icon name={p.technology === 'radio' ? 'tower' : 'network'} />
                        </span>
                        <span className="pv-row-label">
                          <strong>{p.name}</strong>
                          <small>
                            {p.id} · {clientsByPoint.get(p.id)!.length} clientes
                          </small>
                        </span>
                        <Icon name="arrow" />
                      </button>
                    ))}
                  </>
                )}
                {showClients && (
                  <>
                    <div className="pv-section-title">
                      <h3>{showIncidents?'Todas as ocorrências':'Assinantes'}</h3>
                      <b>{localNumber(results.length)}</b>
                      {!showIncidents && (
                        <button
                          className="pv-filter"
                          aria-pressed={onlyAffected}
                          onClick={() => {
                            setOnlyAffected((v) => !v)
                            setPage(0)
                          }}
                        >
                          Com incidente
                        </button>
                      )}
                    </div>
                    {results.slice(activePage * 20, (activePage + 1) * 20).map((c) => (
                      <ClientRow key={c.id} client={c} incident={incidents.get(c.id)} onClick={() => chooseClient(c)} />
                    ))}
                    {!results.length && <p className="pv-empty">Nenhum assinante encontrado.</p>}
                    {pageCount > 1 && (
                      <div className="pv-pagination">
                        <button disabled={!activePage} onClick={() => setPage(activePage - 1)}>
                          Anterior
                        </button>
                        <span>
                          {activePage + 1} / {pageCount}
                        </span>
                        <button disabled={activePage + 1 >= pageCount} onClick={() => setPage(activePage + 1)}>
                          Próxima
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </aside>
        )}
        <span role="status" className="pv-toast">
          {announcement}
        </span>
      </main>
    </div>
  )
}
