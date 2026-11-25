import {useEffect,useRef,useState} from 'react'
import {Minus,Pause,Play,Plus,RotateCcw,Scan} from 'lucide-react'
import {categories,type Case,type Event,type Link,type Selection} from '../lib/schema'
import {formatTime,label,stackEvents,timeScale} from '../lib/selectors'
import {Badge,Empty,EventCard,categoryStyle,eventStyle,tint} from './shared'

type Props = {data:Case;events:Event[];links:Link[];selection:Selection|null;onSelect:(selection:Selection)=>void;lanes?:boolean;overview?:boolean;from?:string;to?:string}
export function Timeline({data,events,links,selection,onSelect,lanes=false,overview=false,from,to}:Props) {
  const [zoom,setZoom]=useState(1)
  const [fitWidth,setFitWidth]=useState(850)
  const [group,setGroup]=useState('category')
  const [hideEmpty,setHideEmpty]=useState(true)
  const [progress,setProgress]=useState(1000)
  const [playing,setPlaying]=useState(false)
  const [focus,setFocus]=useState(false)
  const scroller=useRef<HTMLDivElement>(null)
  const pan=useRef<{x:number;y:number;left:number;top:number}|null>(null)
  const width=Math.round(fitWidth*zoom)
  const dated=events.filter(event=>event.time)
  const undated=events.filter(event=>!event.time)
  const allDates=dated.length?dated:data.events.filter(event=>event.time)
  const top=data.events.find(event=>event.id===data.topEventId)
  const starts=allDates.map(event=>Date.parse(event.time!))
  const ends=allDates.map(event=>Date.parse(event.endTime??event.time!))
  const defaultStart=starts.length?Math.min(...starts):0
  const defaultEnd=ends.length?Math.max(...ends):defaultStart+1000
  const anchor=top?.time?Date.parse(top.time):defaultEnd
  const start=Math.max(from?Date.parse(from):defaultStart,focus?anchor-30*60000:-Infinity)
  const end=Math.max(start+1000,Math.min(to?Date.parse(to):defaultEnd,focus?anchor+30*60000:Infinity))
  const scale=timeScale(start,end,width)
  const current=start+(end-start)*progress/1000
  const inWindow=dated.filter(event=>Date.parse(event.endTime??event.time!)>=start&&Date.parse(event.time!)<=end)
  const shown=inWindow.filter(event=>!lanes||overview||progress===1000||Date.parse(event.time!)<=current)
  const groupKey=(event:Event)=>group==='asset'?event.asset||'Unassigned':group==='source'?event.source||data.evidence.find(item=>event.evidenceIds.includes(item.id))?.source||'Unassigned':event.category
  const names=lanes?(group==='category'?categories:[...new Set(inWindow.map(groupKey))].sort()):['Event sequence']
  const laneNames=lanes&&hideEmpty?names.filter(name=>inWindow.some(event=>groupKey(event)===name)):names
  const points=new Map<string,{x:number;y:number}>()
  let height=0
  const rows=[]
  for (const name of laneNames) {
    const placements=stackEvents(shown.filter(event=>!lanes||groupKey(event)===name),event=>scale(Math.max(start,Date.parse(event.time!))))
    const rowHeight=Math.max(44,...placements.map(({row})=>55+(row+1)*93))
    const offset=height
    height+=rowHeight
    for (const {event,x,row} of placements) points.set(event.id,{x,y:offset+27+row*93})
    rows.push({name,placements,rowHeight})
  }
  const hasDated=inWindow.length>0
  const hiddenSelection=selection?.kind==='events'&&dated.some(event=>event.id===selection.id)&&!shown.some(event=>event.id===selection.id)
  useEffect(()=>{
    if (!hasDated) return
    const node=scroller.current
    if (!node) return
    const observer=new ResizeObserver(([entry])=>setFitWidth(Math.max(700,entry.contentRect.width-(lanes?124:0))))
    observer.observe(node)
    return ()=>observer.disconnect()
  },[lanes,hasDated])
  useEffect(()=>{
    if (!playing) return
    const timer=window.setInterval(()=>setProgress(value=>Math.min(1000,value+10)),100)
    return ()=>clearInterval(timer)
  },[playing])
  const ticks=scale.ticks(Math.max(4,Math.floor(width/130))).filter(tick=>+tick>=start&&+tick<=end)
  return <section className="timeline">
    {!overview&&<div className="view-toolbar">
      <div><strong>{lanes?'Swimlanes':'Linear timeline'}</strong><small>{data.timezone} · {starts.length?formatTime(start,data.timezone,true):'No dated events'}</small></div>
      <div className="toolbar-actions">
        {lanes&&<><label className="inline-field">Group by <select value={group} onChange={event=>setGroup(event.target.value)}><option value="category">Category</option><option value="asset">Asset</option><option value="source">Source</option></select></label><label className="check"><input type="checkbox" checked={hideEmpty} onChange={event=>setHideEmpty(event.target.checked)}/> Collapse empty lanes</label></>}
        <button onClick={()=>setFocus(!focus)} aria-pressed={focus}>Top event ±30 min</button>
        <button className="icon-button" aria-label="Zoom out" onClick={()=>setZoom(value=>Math.max(1,value/1.35))}><Minus size={16}/></button>
        <button className="icon-button" aria-label="Zoom in" onClick={()=>setZoom(value=>Math.min(12,value*1.35))}><Plus size={16}/></button>
        <button className="icon-button" aria-label="Fit timeline" onClick={()=>{setZoom(1);if(scroller.current)scroller.current.scrollLeft=0}}><Scan size={16}/></button>
      </div>
    </div>}
    {lanes&&!overview&&<div className="playback">
      <button className="icon-button" aria-label={playing&&progress<1000?'Pause playback':'Play playback'} onClick={()=>{if(playing&&progress<1000){setPlaying(false);return}if(progress===1000)setProgress(0);setPlaying(true)}}>{playing&&progress<1000?<Pause size={16}/>:<Play size={16}/>}</button>
      <button className="icon-button" aria-label="Reset playback" onClick={()=>{setPlaying(false);setProgress(0)}}><RotateCcw size={16}/></button>
      <input type="range" min={0} max={1000} value={progress} aria-label="Playback position" onChange={event=>{setPlaying(false);setProgress(+event.target.value)}}/>
      <output>{formatTime(current,data.timezone,true)}</output>
    </div>}
    {hiddenSelection&&<p className="notice" role="status">The selected event is outside the current timeline window.</p>}
    {inWindow.length? <div className="timeline-scroll" ref={scroller} tabIndex={0} aria-label="Scrollable chronological canvas"
      onPointerDown={event=>{
        if(event.pointerType!=='mouse'||event.button!==0||(event.target instanceof Element&&event.target.closest('button,[role=button]')))return
        const node=event.currentTarget
        pan.current={x:event.clientX,y:event.clientY,left:node.scrollLeft,top:node.scrollTop}
        node.setPointerCapture(event.pointerId)
      }}
      onPointerMove={event=>{
        if(!pan.current)return
        event.currentTarget.scrollLeft=pan.current.left+pan.current.x-event.clientX
        event.currentTarget.scrollTop=pan.current.top+pan.current.y-event.clientY
      }}
      onLostPointerCapture={()=>{pan.current=null}}>
      <div className={'timeline-grid '+(lanes?'with-labels':'')} style={{width:width+(lanes?124:0)}}>
        {lanes&&<div className="lane-label ruler-label">LANE / {data.timezone}</div>}
        <div className="time-ruler" aria-label="Time ruler">{ticks.map(tick=><span key={+tick} style={{left:scale(tick)}}>{formatTime(+tick,data.timezone,end-start>86400000)}</span>)}</div>
        {rows.map(({name,placements,rowHeight})=>{
          const [color,Icon]=categoryStyle[name as keyof typeof categoryStyle]??['#64748B',null]
          return <div className="timeline-row-group" key={name}>
            {lanes&&<div className="lane-label" style={tint(color)}>{Icon&&<Icon size={15}/>} {label(name)}</div>}
            <div className="time-row" style={{height:rowHeight}}>
              {ticks.map(tick=><span key={+tick} className="time-guide" style={{left:scale(tick)}}/>)}
              {top?.time&&Date.parse(top.time)>=start&&Date.parse(top.time)<=end&&<span className="top-guide" style={{left:scale(Date.parse(top.time))}} title="Top event"/>}
              {lanes&&!overview&&progress<1000&&<span className="play-guide" style={{left:scale(current)}}/>}
              {placements.map(({event,x,row})=><div className="time-anchor" key={event.id} style={{left:x,top:27+row*93,...tint(eventStyle(event)[0])}}>
                {event.endTime&&<span className="duration" style={{width:Math.max(3,scale(Math.min(end,Date.parse(event.endTime)))-x)}} title="Documented time range"/>}
                <EventCard event={event} zone={data.timezone} selected={selection?.id===event.id} onSelect={onSelect} compact/>
              </div>)}
            </div>
          </div>
        })}
        {lanes&&<svg className="lane-edges" width={width} height={height} aria-label="Cross-lane relationships">
          <defs><marker id={overview?'arrow-overview':'arrow-lane'} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7z" fill="#64748B"/></marker></defs>
          {links.map(link=>{
            const a=points.get(link.source),b=points.get(link.target)
            if(!a||!b||a.y===b.y)return null
            const mid=(a.y+b.y)/2
            return <g key={link.id} className="lane-link" role="button" tabIndex={0} aria-label={link.type+' · '+link.status} onClick={()=>onSelect({kind:'links',id:link.id})} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect({kind:'links',id:link.id})}}}>
              <path className="lane-hit" d={`M ${a.x} ${a.y-6} V ${mid} H ${b.x} V ${b.y-6}`}/>
              <path d={`M ${a.x} ${a.y-6} V ${mid} H ${b.x} V ${b.y-6}`} fill="none" stroke="#64748B" strokeWidth="1.5" opacity={link.status==='ruled-out'?0.5:0.85} strokeDasharray={['confirmed','supported'].includes(link.status)?undefined:'5 4'} markerEnd={link.status==='ruled-out'?undefined:`url(#${overview?'arrow-overview':'arrow-lane'})`}/>
              {['supported','ruled-out'].includes(link.status)&&<text x={(a.x+b.x)/2} y={mid-4} textAnchor="middle">{link.status==='ruled-out'?'×':'Supported'}</text>}
            </g>
          })}
        </svg>}
      </div>
    </div>:<Empty>No dated events in this window.</Empty>}
    {!!undated.length&&<div className="undated"><h3>Undated events</h3><div>{undated.map(event=><EventCard key={event.id} event={event} zone={data.timezone} selected={selection?.id===event.id} onSelect={onSelect}/>)}</div></div>}
  </section>
}

export function Overview({data,events,links,selection,onSelect,category,onCategory,onAssessment,onTimeline}:{data:Case;events:Event[];links:Link[];selection:Selection|null;onSelect:(selection:Selection)=>void;category:string;onCategory:(category:Event['category'])=>void;onAssessment:()=>void;onTimeline:()=>void}) {
  const sequence=events.filter(event=>['process','consequence'].includes(event.category)&&event.time).sort((a,b)=>Date.parse(a.time!)-Date.parse(b.time!))
  return <>
    <section className="panel"><div className="section-head"><div><h2>Initiating triggers</h2><p>Investigator assessments across eight initiation categories</p></div><button onClick={onAssessment}>Edit assessments</button></div>
      <div className="trigger-grid">{categories.slice(0,8).map(key=>{
        const [color,Icon]=categoryStyle[key]
        const count=data.events.filter(event=>event.category===key).length
        return <button key={key} style={tint(color)} className={'trigger-card '+(category===key?'selected':'')} aria-pressed={category===key} onClick={()=>onCategory(key)}><span className="trigger-name"><Icon size={18}/><strong>{label(key)}</strong></span><span className="trigger-meta"><Badge value={data.categoryAssessments[key]??'unassessed'}/><small>{count} {count===1?'event':'events'}</small></span></button>
      })}</div>
    </section>
    <section className="panel"><div className="section-head"><div><h2>Central event sequence</h2><p>Process events and consequences in chronological order · {data.timezone}</p></div><button onClick={onTimeline}>Open full timeline</button></div>
      {sequence.length?<div className="sequence" tabIndex={0} aria-label="Central event sequence">{sequence.map(event=><EventCard key={event.id} event={event} zone={data.timezone} selected={selection?.id===event.id} onSelect={onSelect}/>)}</div>:<Empty>No process or consequence events match the filters.</Empty>}
    </section>
    <section className="panel"><div className="section-head"><div><h2>Aligned trigger swimlanes</h2><p>Shared time axis and recorded relationships</p></div></div>
      <Timeline data={data} events={events} links={links} selection={selection} onSelect={onSelect} lanes overview/>
    </section>
  </>
}
