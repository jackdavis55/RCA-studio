import {Activity,AlertTriangle,Building2,CheckCircle,ClipboardList,CloudLightning,Monitor,Network,OctagonAlert,Settings,ShieldAlert,Users} from 'lucide-react'
import type {CSSProperties,ReactNode} from 'react'
import {label,formatTime} from '../lib/selectors'
import type {Category,Event,Selection} from '../lib/schema'

export const categoryStyle = {
  procedural:['#A855F7',ClipboardList], equipment:['#EF4444',Settings], environmental:['#0D9488',CloudLightning],
  human:['#D97706',Users], external:['#2563EB',Network], organisational:['#64748B',Building2],
  software:['#0891B2',Monitor], design:['#DB2777',ShieldAlert], process:['#D97706',Activity], consequence:['#64748B',Activity],
} satisfies Record<Category,[string,typeof Activity]>
export const barrierColor = {effective:'#16A34A',degraded:'#D97706',failed:'#EF4444',missing:'#EF4444',unknown:'#64748B'}
export const tint = (color:string) => ({'--accent':color} as CSSProperties)
export function eventStyle(event:Event) {
  if (event.role==='top-event') return ['#EF4444',OctagonAlert] as const
  if (event.category==='process') return event.occurrence==='observed'&&/normal/i.test(event.title)?['#16A34A',CheckCircle] as const:['#D97706',AlertTriangle] as const
  return categoryStyle[event.category]
}
export function Badge({value}:{value:string}) {return <span className={'badge badge-'+value}>{label(value)}</span>}
export function Empty({children}:{children:ReactNode}) {return <div className="empty">{children}</div>}
export function EventCard({event,zone,selected,onSelect,compact=false}:{event:Event;zone:string;selected?:boolean;onSelect:(selection:Selection)=>void;compact?:boolean}) {
  const [color,Icon]=eventStyle(event)
  return <button type="button" className={'event-card '+(selected?'selected ':'')+(compact?'compact':'')} style={tint(color)} onClick={()=>onSelect({kind:'events',id:event.id})} aria-pressed={selected}>
    <span className="card-time">{event.timePrecision==='approximate'?'≈ ':''}{formatTime(event.time,zone)}{event.endTime?' – '+formatTime(event.endTime,zone):''}</span>
    <span className="event-title"><Icon size={15}/><strong>{event.title}</strong></span>
    <span className="card-meta">{label(event.role==='event'?event.category:event.role)} <span aria-hidden="true">·</span> {label(event.status)}</span>
  </button>
}
