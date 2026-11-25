import {scaleUtc} from 'd3-scale'
import type {Case, Category, Event, Link, Status} from './schema'
export type Filters = {query:string; category:Category|''; status:Status|''; role:Event['role']|''; from:string; to:string; hypotheses:boolean; ruledOut:boolean}
export const emptyFilters: Filters = {query:'',category:'',status:'',role:'',from:'',to:'',hypotheses:true,ruledOut:false}
export const label = (value:string) => value ? value[0].toUpperCase()+value.slice(1).replaceAll('-',' ') : ''
export const statusVisible = (status:Status, filters:Filters) => (status!=='ruled-out'||filters.ruledOut) && (!['hypothesis','unassessed'].includes(status)||filters.hypotheses)
export function filterEvents(data:Case, filters:Filters) {
  const query = filters.query.trim().toLowerCase()
  return data.events.filter(event=>{
    const evidence = data.evidence.filter(item=>event.evidenceIds.includes(item.id))
    const searchable = [event.title,event.description,...evidence.flatMap(item=>[item.title,item.source,item.observation,item.reliability])].join(' ').toLowerCase()
    return searchable.includes(query) && (!filters.category||event.category===filters.category)
      && (!filters.status||event.status===filters.status) && (!filters.role||event.role===filters.role)
      && (!event.time||!filters.from||Date.parse(event.endTime??event.time)>=Date.parse(filters.from))
      && (!event.time||!filters.to||Date.parse(event.time)<=Date.parse(filters.to))
  })
}
export function filterLinks(links:Link[], events:Event[], filters:Filters) {
  const ids = new Set(events.map(event=>event.id))
  return links.filter(link=>ids.has(link.source)&&ids.has(link.target)&&statusVisible(link.status,filters))
}
export function formatTime(time:string|number|null, zone:string, date=false) {
  if (time===null) return 'Undated'
  return new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',second:'2-digit',...(date?{day:'numeric',month:'short',year:'numeric'}:{})}).format(new Date(time))
}
export function timeScale(start:number,end:number,width:number) {
  return scaleUtc().domain([start,Math.max(start+1000,end)]).range([18,width-230])
}
export function stackEvents(events:Event[], position:(event:Event)=>number, gap=214) {
  const rightEdges:number[] = []
  return [...events].sort((a,b)=>position(a)-position(b)).map(event=>{
    const x = position(event)
    let row = rightEdges.findIndex(edge=>edge<=x)
    if (row<0) row=rightEdges.length
    rightEdges[row]=x+gap
    return {event,x,row}
  })
}
export function trace(start:string, edges:{source:string;target:string}[], direction:'up'|'down') {
  const seen = new Set([start])
  const queue = [start]
  const from = direction==='up'?'target':'source'
  const to = direction==='up'?'source':'target'
  for (const id of queue) for (const edge of edges) if (edge[from]===id&&!seen.has(edge[to])) {
    seen.add(edge[to])
    queue.push(edge[to])
  }
  return seen
}
export function localDate() {
  const now = new Date()
  return new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10)
}
