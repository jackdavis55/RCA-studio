import {useState} from 'react'
import {ArrowRight,Plus,Printer,Shield} from 'lucide-react'
import {actionStatuses,type Case,type Event,type Selection} from '../lib/schema'
import {formatTime,label,localDate} from '../lib/selectors'
import {Badge,Empty,EventCard,barrierColor,tint} from './shared'
import {itemTitle,type EditRequest} from './Inspector'

export function BowTie({data,events,selection,onSelect,openEditor}:{data:Case;events:Event[];selection:Selection|null;onSelect:(selection:Selection)=>void;openEditor:(request:EditRequest)=>void}) {
  const top=data.events.find(event=>event.id===data.topEventId)!
  const ids=new Set(events.map(event=>event.id))
  const paths=data.pathways.filter(path=>ids.has(path.threatId??path.consequenceId??''))
  function side(direction:'left'|'right') {
    return <div className={'bow-side '+direction}>{paths.filter(path=>path.side===direction).map(path=>{
      const endpoint=data.events.find(event=>event.id===(path.threatId??path.consequenceId))!
      const barriers=path.barrierIds.map(id=>data.barriers.find(barrier=>barrier.id===id)!)
      return <div className="bow-path" key={path.id}>
        {direction==='left'&&<EventCard event={endpoint} zone={data.timezone} selected={selection?.id===endpoint.id} onSelect={onSelect}/>}
        <div className="barrier-chain">{barriers.length?barriers.map(barrier=><button key={barrier.id} className={`barrier-card ${barrier.status} ${selection?.id===barrier.id?'selected':''}`} style={tint(barrierColor[barrier.status])} onClick={()=>onSelect({kind:'barriers',id:barrier.id})}><strong><Shield size={15}/>{barrier.title}</strong><Badge value={barrier.status}/><small>{barrier.owner||'Unassigned'} · {barrier.evidenceIds.length} evidence</small></button>):<span className="muted">No barrier recorded</span>}</div>
        {direction==='right'&&<div className="bow-outcome"><EventCard event={endpoint} zone={data.timezone} selected={selection?.id===endpoint.id} onSelect={onSelect}/><Badge value={endpoint.occurrence==='observed'?'occurred':endpoint.occurrence==='possible'?'potential':endpoint.occurrence}/></div>}
        <button className="path-arrow" aria-label={'Inspect pathway '+endpoint.title} onClick={()=>onSelect({kind:'pathways',id:path.id})}><ArrowRight size={17}/></button>
      </div>
    })}</div>
  }
  return <section className="panel">
    <div className="view-toolbar"><div><strong>Bow-tie</strong><small>Preventive and mitigative barrier pathways</small></div><div className="toolbar-actions"><button onClick={()=>openEditor({kind:'barriers'})}><Plus size={15}/> Barrier</button><button onClick={()=>openEditor({kind:'pathways'})}><Plus size={15}/> Pathway</button></div></div>
    {paths.length?<div className="bow-scroll" tabIndex={0} aria-label="Bow-tie pathways"><div className="bow-grid">
      <h3>Threats & preventive barriers</h3><h3>Top event</h3><h3>Mitigative barriers & consequences</h3>
      {side('left')}<div className="bow-center"><EventCard event={top} zone={data.timezone} selected={selection?.id===top.id} onSelect={onSelect}/></div>{side('right')}
    </div></div>:<Empty>No pathways match the filters.</Empty>}
    <div className="barrier-list"><h3>Barrier register</h3>{data.barriers.length?data.barriers.map(barrier=><button key={barrier.id} onClick={()=>onSelect({kind:'barriers',id:barrier.id})}>{barrier.title} <Badge value={barrier.status}/></button>):<p className="muted">No barriers recorded.</p>}</div>
  </section>
}

function targetKind(type:string) {return type==='event'?'events':type==='link'?'links':'barriers'}
export function Findings({data,onSelect,openEditor}:{data:Case;onSelect:(selection:Selection)=>void;openEditor:(request:EditRequest)=>void}) {
  const [status,setStatus]=useState('')
  const [query,setQuery]=useState('')
  const [overdue,setOverdue]=useState(false)
  const today=localDate()
  const late=(action:Case['actions'][number])=>!!action.dueDate&&action.dueDate<today&&action.status!=='complete'
  const visible=data.actions.filter(action=>(!status||action.status===status)&&(!overdue||late(action))&&[action.title,action.rationale,action.owner,itemTitle(data,targetKind(action.targetType),action.targetId)].join(' ').toLowerCase().includes(query.toLowerCase()))
  return <section className="panel">
    <div className="view-toolbar"><div><strong>Findings & actions</strong><small>{data.actions.length} actions · {data.actions.filter(late).length} overdue</small></div><div className="toolbar-actions"><button onClick={()=>window.print()}><Printer size={15}/> Print report</button><button className="primary" onClick={()=>openEditor({kind:'actions'})}><Plus size={15}/> Action</button></div></div>
    <div className="findings-summary"><h3>Case summary</h3><p>{data.description}</p><p>{data.events.length} events · {data.links.length} relationships · {data.barriers.length} barriers · {data.evidence.length} evidence records</p></div>
    <div className="findings-filters"><input aria-label="Search actions" placeholder="Search actions or owners" value={query} onChange={event=>setQuery(event.target.value)}/><select aria-label="Action status" value={status} onChange={event=>setStatus(event.target.value)}><option value="">All statuses</option>{actionStatuses.map(status=><option key={status} value={status}>{label(status)}</option>)}</select><label className="check"><input type="checkbox" checked={overdue} onChange={event=>setOverdue(event.target.checked)}/> Overdue only</label></div>
    {visible.length?<div className="table-scroll"><table><thead><tr>{['Finding','Evidence','Causal factor','Confidence','Corrective action','Owner','Due date','Status'].map(title=><th key={title} scope="col">{title}</th>)}</tr></thead><tbody>
    {visible.map(action=>{
      const kind=targetKind(action.targetType)
      const target=data[kind].find(item=>item.id===action.targetId)
      return <tr key={action.id}><td>{action.rationale||'—'}</td><td>{target?.evidenceIds.length?target.evidenceIds.map(id=><button className="text-button" key={id} onClick={()=>onSelect({kind:'evidence',id})}>{itemTitle(data,'evidence',id)}</button>):'—'}</td><td><button className="text-button" onClick={()=>onSelect({kind,id:action.targetId})}>{itemTitle(data,kind,action.targetId)}</button></td><td><Badge value={action.confidence??'unassessed'}/></td><td><button className="text-button" onClick={()=>onSelect({kind:'actions',id:action.id})}>{action.title}</button></td><td>{action.owner||'—'}</td><td>{action.dueDate??'—'}{late(action)&&<Badge value="overdue"/>}</td><td><Badge value={action.status}/></td></tr>
    })}</tbody></table></div>:<Empty>No actions match the current filters.</Empty>}
  </section>
}

export function PrintReport({data}:{data:Case}) {
  return <article className="print-report">
    <h1>{data.id} · {data.title}</h1><p>RCA Studio · Fictional investigation · {data.timezone}</p><p>{data.description}</p>
    <h2>Initiation assessments</h2><ul>{Object.entries(data.categoryAssessments).map(([category,status])=><li key={category}>{label(category)} — {label(status)}</li>)}</ul>
    <h2>Events</h2><ul>{[...data.events].sort((a,b)=>(a.time?Date.parse(a.time):Infinity)-(b.time?Date.parse(b.time):Infinity)).map(event=><li key={event.id}><strong>{event.title}</strong> · {formatTime(event.time,data.timezone,true)}{event.endTime?' – '+formatTime(event.endTime,data.timezone,true):''} · {label(event.status)} · {label(event.occurrence)}<br/>{event.description}</li>)}</ul>
    <h2>Relationships</h2><ul>{data.links.map(link=><li key={link.id}>{itemTitle(data,'links',link.id)} · {label(link.type)} · {label(link.status)}. {link.rationale}</li>)}</ul>
    <h2>Barriers</h2><ul>{data.barriers.map(barrier=><li key={barrier.id}>{barrier.title} · {label(barrier.role)} · {label(barrier.status)} · {barrier.owner}</li>)}</ul>
    <h2>Evidence</h2><ul>{data.evidence.map(item=><li key={item.id}><strong>{item.title}</strong> · {item.source} · {formatTime(item.time,data.timezone,true)}<br/>{item.observation} · {item.reliability}</li>)}</ul>
    <h2>Findings & actions</h2><ul>{data.actions.map(action=><li key={action.id}><strong>{action.title}</strong> · {label(action.status)} · {action.owner} · {action.dueDate??'No due date'}<br/>{itemTitle(data,targetKind(action.targetType),action.targetId)} · {action.rationale}</li>)}</ul>
  </article>
}
