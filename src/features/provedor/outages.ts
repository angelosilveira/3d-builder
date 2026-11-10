import { clientById, type Incident } from './data'

export const reportWindowMinutes=15
export const minimumReports=3
export interface OutageGroup {
  id:string
  pointId:string
  first:string
  last:string
  reports:Incident[]
}
export function groupOpenOutages(open:readonly Incident[]):OutageGroup[]{
  const byPoint=new Map<string,Incident[]>()
  for(const item of new Map(open.map(i=>[i.clientId,i])).values()){
    const client=clientById.get(item.clientId)
    if(item.kind!=='offline'||!client||!Number.isFinite(Date.parse(item.opened)))continue
    const list=byPoint.get(client.pointId)??[]
    list.push(item);byPoint.set(client.pointId,list)
  }
  const groups:OutageGroup[]=[]
  for(const [pointId,reports] of byPoint){
    reports.sort((a,b)=>Date.parse(a.opened)-Date.parse(b.opened)||a.clientId.localeCompare(b.clientId))
    let start=0,end=0
    while(start<reports.length){
      const first=reports[start].opened
      const limit=Date.parse(first)+reportWindowMinutes*60000
      while(end<reports.length&&Date.parse(reports[end].opened)<=limit)end++
      if(end-start<minimumReports){start++;continue}
      const batch=reports.slice(start,end)
      groups.push({id:pointId+'/'+first+'/'+batch[0].clientId,pointId,first,last:batch[batch.length-1].opened,reports:batch})
      start=end
    }
  }
  return groups.sort((a,b)=>Date.parse(b.last)-Date.parse(a.last))
}
export const reportTime=(iso:string)=>new Date(iso).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Bahia'})
export const reportDay=(iso:string)=>new Date(iso).toLocaleDateString('pt-BR',{timeZone:'America/Bahia'})
