import {cityStreets,districts,urbanAreas,type UrbanArea} from './city'
import {clientById,clients,pointById} from './data'
import {Icon} from './icons'
import {minimumReports,reportWindowMinutes,reportTime,reportDay,type OutageGroup} from './outages'

const totals=new Map<string,number>()
for(const c of clients)for(const id of [c.districtId,c.streetId])if(id)totals.set(id,(totals.get(id)??0)+1)

export function CityDirectory({area,choose,match,searching}:{area:UrbanArea|null;choose:(a:UrbanArea)=>void;match:(s:string)=>boolean;searching:boolean}){
  if(area?.kind==='street')return null
  const neighborhoods=area?[]:districts.filter(d=>match(d.name))
  const streets=area||searching?cityStreets.filter(s=>(!area||s.districtId===area.id)&&match(s.name+' '+urbanAreas.get(s.districtId)!.name)):[]
  return <>{[[neighborhoods,'Bairros'],[streets,'Ruas']].map(([list,title])=>{
    const entries=list as UrbanArea[]
    if(!entries.length)return null
    return <section key={String(title)}><div className="pv-section-title"><h3>{String(title)}</h3><b>{entries.length}</b></div>
      {entries.map(a=><button key={a.id} className="pv-row" onClick={()=>choose(a)}><span className="pv-region-icon"><Icon name={a.kind==='district'?'layers':'pin'}/></span><span className="pv-row-label"><strong>{a.name}</strong><small>{a.kind==='district'?'8 ruas':urbanAreas.get(a.districtId)!.name} · {totals.get(a.id)} clientes</small></span><Icon name="arrow"/></button>)}</section>
  })}</>
}

export function OutageCards({groups,inspect}:{groups:OutageGroup[];inspect:(g:OutageGroup)=>void}){
  return <section className="pv-outages"><div className="pv-section-title"><h3>Possíveis falhas compartilhadas</h3><b>{groups.length}</b></div>
    <p className="pv-empty">{minimumReports} ou mais clientes sem conexão no mesmo ponto em até {reportWindowMinutes} minutos.</p>
    {!groups.length&&<p className="pv-empty">Nenhum conjunto de relatos atende a esse critério.</p>}
    {groups.map(g=><button key={g.id} className="pv-outage-card" onClick={()=>inspect(g)}><span><Icon name="alert"/><strong>{g.pointId} · {g.reports.length} quedas</strong></span>
      <small>{pointById.get(g.pointId)!.name} · {reportDay(g.last)}</small><small>{reportTime(g.first)}–{reportTime(g.last)}</small><b>Investigar no mapa →</b></button>)}
    </section>
}

export function Investigation({group,openClient,openPoint}:{group:OutageGroup;openClient:(id:string)=>void;openPoint:()=>void}){
  return <section><span className="pv-kicker">TRIAGEM DE REDE</span><h2>Possível falha compartilhada</h2>
    <button className="pv-row" onClick={openPoint}><Icon name="tower"/><span className="pv-row-label"><strong>{pointById.get(group.pointId)!.name}</strong><small>{group.pointId} · Ver ficha técnica</small></span><Icon name="arrow"/></button>
    <div className="pv-section-title"><h3>Relatos de queda</h3><b>{group.reports.length}</b></div><p className="pv-empty">{reportDay(group.first)} · {reportTime(group.first)} a {reportTime(group.last)}{reportDay(group.last)!==reportDay(group.first)?' de '+reportDay(group.last):''}</p>
    {group.reports.map(r=>{const c=clientById.get(r.clientId)!;return <button className="pv-row" onClick={()=>openClient(c.id)} key={c.id}>
      <time>{reportTime(r.opened)}</time><span className="pv-row-label"><strong>{c.name}</strong><small>{c.id} · {c.address}</small><small>{r.note||'Perda de conexão relatada.'}</small></span><Icon name="arrow"/></button>})}</section>
}
