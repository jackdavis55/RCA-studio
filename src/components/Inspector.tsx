import {useState,useRef,type FormEvent} from 'react'
import {PanelRightClose,Pencil,Plus,Trash2,X} from 'lucide-react'
import {ActionSchema,BarrierSchema,EventSchema,EvidenceSchema,GateSchema,LinkSchema,PathwaySchema,actionStatuses,barrierStatuses,categories,linkTypes,occurrences,precisions,roles,statuses,targetTypes,type Case,type Collection,type Selection} from '../lib/schema'
import {label,formatTime,type Filters,statusVisible} from '../lib/selectors'
import {timingConflict} from '../lib/validation'
import {useStudio} from '../store/investigation'
import {Badge,Empty,eventStyle,tint} from './shared'

export type EditRequest = {kind:Collection; id?:string; defaults?:Record<string,string>; attachTo?:Selection}
const schemas = {events:EventSchema,links:LinkSchema,evidence:EvidenceSchema,barriers:BarrierSchema,gates:GateSchema,pathways:PathwaySchema,actions:ActionSchema}
export const kindLabel = {events:'Event',links:'Relationship',evidence:'Evidence',barriers:'Barrier',gates:'Gate',pathways:'Pathway',actions:'Action'}
export function itemTitle(data:Case,kind:Collection,id:string):string {
  const item=data[kind].find(item=>item.id===id)
  if (!item) return id
  if ('title' in item) return item.title
  if ('source' in item) return itemTitle(data,'events',item.source)+' → '+itemTitle(data,'events',item.target)
  if ('operator' in item) return item.operator+' gate · '+itemTitle(data,'events',item.outputId)
  return itemTitle(data,'events',item.threatId??item.consequenceId??id)
}

function Field({name,value,options,optional=false,multiple=false,area=false,type='text'}:{name:string;value?:unknown;options?:readonly (string|{id:string;title:string})[];optional?:boolean;multiple?:boolean;area?:boolean;type?:string}) {
  const caption=name.replace(/Ids?$/,'').replace(/([a-z])([A-Z])/g,'$1 $2')
  return <label className={'field '+(area||multiple?'field-wide':'')}><span>{label(caption)}{optional?' (optional)':''}</span>
    {options ? <select name={name} multiple={multiple} defaultValue={multiple?(value as string[]??[]):String(value??'')} required={!optional&&!multiple}>
      {!multiple&&<option value="">Select…</option>}
      {options.map(option=>typeof option==='string'?<option key={option} value={option}>{label(option)}</option>:<option key={option.id} value={option.id}>{option.title}</option>)}
    </select> : area ? <textarea name={name} defaultValue={String(value??'')} rows={3}/> : <input name={name} type={type} defaultValue={String(value??'')} placeholder={name==='time'||name==='endTime'?'2026-05-10T08:00:00Z':undefined} required={name==='title'}/>}
  </label>
}

export function Editor({data,request,close}:{data:Case;request:EditRequest;close:()=>void}) {
  const edit=useStudio(state=>state.edit)
  const select=useStudio(state=>state.select)
  const [error,setError]=useState('')
  const [targetType,setTargetType]=useState(request.defaults?.targetType??data.actions.find(action=>action.id===request.id)?.targetType??'event')
  const [side,setSide]=useState(data.pathways.find(path=>path.id===request.id)?.side??'left')
  const form=useRef<HTMLFormElement>(null)
  const {kind,id}=request
  const item:Record<string,unknown> = {...request.defaults,...data[kind].find(item=>item.id===id)}
  const field=(name:string,options?:Parameters<typeof Field>[0]['options'],optional=false,multiple=false)=><Field name={name} value={item[name]??({status:kind==='actions'?'open':kind==='barriers'?'unknown':'unassessed',category:'process',role:kind==='barriers'?'preventive':'event',timePrecision:'unknown',occurrence:'unknown',type:'contributes',operator:'AND'} as Record<string,string>)[name]} options={options} optional={optional} multiple={multiple} area={['description','rationale','observation','reliability','timeException'].includes(name)} type={name==='dueDate'?'date':'text'}/>
  const options=(collection:Collection)=>data[collection].map(item=>({id:item.id,title:itemTitle(data,collection,item.id)}))
  function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const values=new FormData(event.currentTarget)
    const record:Record<string,unknown> = {id:id??crypto.randomUUID()}
    for (const [key,value] of values) record[key]=value
    for (const key of ['evidenceIds','inputIds','barrierIds']) if (['events','links','barriers'].includes(kind)&&key==='evidenceIds'||kind==='gates'&&key==='inputIds'||kind==='pathways'&&key==='barrierIds') record[key]=values.getAll(key)
    for (const key of ['time','dueDate']) if (record[key]==='') record[key]=null
    for (const key of ['endTime','asset','source','timeException','confidence']) if (record[key]===''&&(key!=='source'||kind!=='evidence')) delete record[key]
    try {
      const checked=schemas[kind].safeParse(record)
      if (!checked.success) throw new Error(checked.error.issues.map(issue=>issue.path.join('.')+' — '+issue.message).join('\n'))
      if (kind==='links') {
        const link=LinkSchema.parse(checked.data)
        if (timingConflict(data,link)) {
          const uncertain=data.events.some(event=>[link.source,link.target].includes(event.id)&&event.timePrecision!=='exact')
          if (!uncertain||!link.timeException) throw new Error(uncertain?'The source starts after the target ends. Correct the time or document the uncertainty.':'The source starts after the target ends. Correct the timestamps before saving this relationship.')
        }
      }
      const next:Case={...data,[kind]:id?data[kind].map(item=>item.id===id?checked.data:item):[...data[kind],checked.data]}
      if (kind==='events' && EventSchema.parse(checked.data).role==='top-event' && data.topEventId!==checked.data.id) {
        next.topEventId=checked.data.id
        next.events=next.events.map(item=>item.id===data.topEventId?{...item,role:'event'}:item)
      }
      const attachment=request.attachTo
      if (kind==='evidence'&&attachment) {
        switch (attachment.kind) {
          case 'events': next.events=next.events.map(item=>item.id===attachment.id?{...item,evidenceIds:[...item.evidenceIds,checked.data.id]}:item); break
          case 'links': next.links=next.links.map(item=>item.id===attachment.id?{...item,evidenceIds:[...item.evidenceIds,checked.data.id]}:item); break
          case 'barriers': next.barriers=next.barriers.map(item=>item.id===attachment.id?{...item,evidenceIds:[...item.evidenceIds,checked.data.id]}:item); break
        }
      }
      edit(next)
      select({kind,id:checked.data.id})
      close()
    } catch (err) {setError((err as Error).message)}
  }
  return <dialog ref={node=>{if(node&&!node.open)node.showModal()}} onCancel={close} className="modal">
    <div className="modal-head"><h2>{id?'Edit':'Add'} {kindLabel[kind].toLowerCase()}</h2><button className="icon-button" aria-label="Close editor" onClick={close}><X size={18}/></button></div>
    <form ref={form} onSubmit={submit}>
      <div className="form-grid">
        {['events','evidence','barriers','actions'].includes(kind)&&field('title')}
        {kind==='events'&&<>{field('category',categories)}{field('role',roles)}{field('status',statuses)}{field('occurrence',occurrences)}{field('time',undefined,true)}{field('endTime',undefined,true)}{field('timePrecision',precisions)}{field('asset',undefined,true)}{field('source',undefined,true)}{field('description')}</>}
        {kind==='links'&&<>{field('source',options('events'))}{field('target',options('events'))}{field('type',linkTypes)}{field('status',statuses)}{field('rationale')}{field('timeException',undefined,true)}</>}
        {kind==='evidence'&&<>{field('source')}{field('time',undefined,true)}{field('observation')}{field('reliability')}</>}
        {kind==='barriers'&&<>{field('role',['preventive','mitigative'])}{field('status',barrierStatuses)}{field('owner')}</>}
        {kind==='gates'&&<>{field('operator',['AND','OR'])}{field('status',statuses)}{field('outputId',options('events'))}{field('inputIds',[...options('events'),...options('gates')],false,true)}{field('rationale')}</>}
        {kind==='pathways'&&<><label className="field">Side<select name="side" value={side} onChange={event=>setSide(event.target.value==='right'?'right':'left')}><option value="left">Prevention</option><option value="right">Mitigation</option></select></label>{field(side==='left'?'threatId':'consequenceId',options('events').filter(option=>data.events.find(event=>event.id===option.id)?.role===(side==='left'?'trigger':'consequence')))}{field('barrierIds',options('barriers').filter(option=>data.barriers.find(barrier=>barrier.id===option.id)?.role===(side==='left'?'preventive':'mitigative')),true,true)}</>}
        {kind==='actions'&&<><label className="field">Target type<select name="targetType" value={targetType} onChange={event=>setTargetType(event.target.value)}>{targetTypes.map(type=><option key={type} value={type}>{label(type)}</option>)}</select></label>{field('targetId',options(targetType==='event'?'events':targetType==='link'?'links':'barriers'))}{field('owner')}{field('dueDate',undefined,true)}{field('status',actionStatuses)}{field('confidence',statuses,true)}{field('rationale')}</>}
        {['events','links','barriers'].includes(kind)&&field('evidenceIds',options('evidence'),true,true)}
      </div>
      {error&&<p role="alert" className="notice error">{error}</p>}
      <div className="modal-actions"><button type="button" onClick={close}>Cancel</button><button className="primary" type="submit">Save changes</button></div>
    </form>
  </dialog>
}

export function Inspector({data,selection,visible,filters,openEditor}:{data:Case;selection:Selection|null;visible:boolean;filters:Filters;openEditor:(request:EditRequest)=>void}) {
  const [tab,setTab]=useState('Details')
  const [library,setLibrary]=useState(false)
  const {select,edit,prefsUpdate}=useStudio()
  const current=selection&&data[selection.kind].find(item=>item.id===selection.id)
  const event=data.events.find(event=>event.id===current?.id)
  const links=data.links.filter(link=>(link.source===current?.id||link.target===current?.id||link.id===current?.id)&&statusVisible(link.status,filters))
  const paths=data.pathways.filter(path=>path.id===current?.id||path.threatId===current?.id||path.consequenceId===current?.id||current?.id===data.topEventId||path.barrierIds.includes(current?.id??''))
  const barriers=data.barriers.filter(barrier=>paths.some(path=>path.barrierIds.includes(barrier.id)))
  const evidence=data.evidence.filter(item=>current&&(('evidenceIds' in current&&current.evidenceIds.includes(item.id))||item.id===current.id))
  const actions=data.actions.filter(action=>action.targetId===current?.id||action.id===current?.id)
  function remove() {
    if (!selection) return
    if (!window.confirm('Delete '+itemTitle(data,selection.kind,selection.id)+'? Records with references cannot be deleted.')) return
    try {edit({...data,[selection.kind]:data[selection.kind].filter(item=>item.id!==selection.id)});select(null)}
    catch(err){window.alert((err as Error).message)}
  }
  function related(kind:Collection,id:string,detail?:string) {
    return <button className="related" key={id} onClick={()=>{select({kind,id});setTab('Details')}}><strong>{itemTitle(data,kind,id)}</strong>{detail&&<small>{detail}</small>}</button>
  }
  return <aside className="inspector" aria-label="Inspector">
    <div className="inspector-head"><strong>Inspector</strong><button className="small-button" aria-pressed={library} onClick={()=>setLibrary(!library)}>Evidence library</button><button className="icon-button" aria-label="Close inspector" onClick={()=>prefsUpdate({inspector:false})}><PanelRightClose size={17}/></button></div>
    {library?<div className="inspector-body"><h3>Evidence records</h3>{data.evidence.length?data.evidence.map(item=><button className="related" key={item.id} onClick={()=>{select({kind:'evidence',id:item.id});setLibrary(false);setTab('Details')}}><strong>{item.title}</strong><small>{item.source}</small></button>):<Empty>No evidence records.</Empty>}<button onClick={()=>{setLibrary(false);openEditor({kind:'evidence'})}}><Plus size={15}/> Add evidence</button></div>:!current||!selection?<Empty>Select a record to inspect its details and evidence.</Empty>:<>
      <div className="inspector-title" style={event?tint(eventStyle(event)[0]):undefined}>
        <span className="eyebrow">{kindLabel[selection.kind]} · {current.id}</span>
        <h2>{itemTitle(data,selection.kind,selection.id)}</h2>
        {'status' in current&&<Badge value={current.status}/>}
      </div>
      {!visible&&<p className="notice">This selection is hidden by the current filters.</p>}
      <div className="inspector-tabs" aria-label="Inspector sections">{['Details','Evidence','Causal links','Barriers','Actions'].map(name=><button key={name} aria-pressed={tab===name} onClick={()=>setTab(name)}>{name}</button>)}</div>
      <div className="inspector-body">
      {tab==='Details'&&<>
        {event&&<><p>{event.description}</p><dl><dt>Category</dt><dd>{label(event.category)}</dd><dt>Role</dt><dd>{label(event.role)}</dd><dt>Occurrence</dt><dd>{label(event.occurrence)}</dd><dt>Time</dt><dd>{formatTime(event.time,data.timezone,true)} {event.endTime&&'– '+formatTime(event.endTime,data.timezone,true)} · {label(event.timePrecision)}</dd>{event.asset&&<><dt>Asset</dt><dd>{event.asset}</dd></>}</dl><h3>Causal summary</h3><p>{links.filter(link=>link.target===event.id).length} incoming · {links.filter(link=>link.source===event.id).length} outgoing relationships</p></>}
        {!event&&<dl>{Object.entries(current).filter(([key])=>!['id','title','status','evidenceIds'].includes(key)).map(([key,value])=><div className="detail-pair" key={key}><dt>{label(key.replace(/([a-z])([A-Z])/g,'$1 $2'))}</dt><dd>{key==='time'?formatTime(typeof value==='string'?value:null,data.timezone,true):Array.isArray(value)?value.join(', '):value??'—'}</dd></div>)}</dl>}
        {selection.kind==='links'&&data.links.some(link=>link.id===selection.id&&timingConflict(data,link))&&<p className="notice">Known times conflict with the relationship direction.</p>}
        {evidence.length>0&&selection.kind!=='evidence'&&<><h3>Evidence</h3>{evidence.map(item=>related('evidence',item.id,item.source))}</>}
      </>}
      {tab==='Evidence'&&<>{evidence.length?evidence.map(item=><article className="evidence-block" key={item.id}>{related('evidence',item.id,item.source)}<p>{item.observation}</p><small>{formatTime(item.time,data.timezone,true)} · {item.reliability}</small></article>):<Empty>No evidence attached.</Empty>}<button className="small-button" onClick={()=>openEditor({kind:'evidence',attachTo:'evidenceIds' in current?selection:undefined})}><Plus size={14}/> Add evidence</button></>}
      {tab==='Causal links'&&<>{links.length?links.map(link=>related('links',link.id,label(link.type)+' · '+label(link.status))):<Empty>No visible relationships.</Empty>}<button className="small-button" onClick={()=>openEditor({kind:'links',defaults:event?{source:event.id}:{}})}><Plus size={14}/> Add relationship</button></>}
      {tab==='Barriers'&&(barriers.length?barriers.map(barrier=>related('barriers',barrier.id,label(barrier.status))):<Empty>No barrier pathway for this selection.</Empty>)}
      {tab==='Actions'&&<>{actions.length?actions.map(action=>related('actions',action.id,label(action.status))):<Empty>No linked actions.</Empty>}{['events','links','barriers'].includes(selection.kind)&&<button className="small-button" onClick={()=>openEditor({kind:'actions',defaults:{targetType:selection.kind==='events'?'event':selection.kind==='links'?'link':'barrier',targetId:selection.id}})}><Plus size={14}/> Add action</button>}</>}
      </div>
      <div className="inspector-footer"><button onClick={()=>openEditor({kind:selection.kind,id:selection.id})}><Pencil size={15}/> Edit {kindLabel[selection.kind].toLowerCase()}</button><button className="icon-button danger" aria-label="Delete selected record" onClick={remove}><Trash2 size={17}/></button></div>
    </>}
  </aside>
}
