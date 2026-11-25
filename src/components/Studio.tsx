'use client'

import {useEffect,useMemo,useState,type FormEvent} from 'react'
import {Activity,ArrowDownToLine,ArrowUpFromLine,CalendarDays,ChevronDown,ClipboardList,Columns3,Database,GitBranch,LayoutDashboard,Menu,Moon,PanelRightOpen,Plus,Redo2,RotateCcw,Search,Shield,SlidersHorizontal,Sun,Undo2,Workflow,X} from 'lucide-react'
import {categories,roles,statuses,type Category,type Case,type Status} from '../lib/schema'
import {emptyFilters,filterEvents,filterLinks,label,statusVisible} from '../lib/selectors'
import {downloadJson,importFile} from '../lib/storage'
import {useStudio} from '../store/investigation'
import {Overview,Timeline} from './Timeline'
import {Graph} from './Graph'
import {BowTie,Findings,PrintReport} from './OtherViews'
import {Editor,Inspector,type EditRequest} from './Inspector'

const workspace=[
  {id:'linear',label:'Linear Timeline',icon:Activity},{id:'lanes',label:'Swimlanes',icon:Columns3},
  {id:'map',label:'Causal Map',icon:Workflow},{id:'bow',label:'Bow-tie',icon:Shield},{id:'tree',label:'Fault Tree',icon:GitBranch},
] as const
const navigation=[
  {id:'overview',label:'Overview',icon:LayoutDashboard},{id:'linear',label:'Events & Timeline',icon:CalendarDays},
  {id:'map',label:'Cause Analysis',icon:Workflow},{id:'bow',label:'Barriers',icon:Shield},{id:'findings',label:'Findings & Actions',icon:ClipboardList},
] as const
type View = typeof workspace[number]['id']|typeof navigation[number]['id']
const viewTitle:Record<View,string>={overview:'Investigation overview',linear:'Linear timeline',lanes:'Swimlanes',map:'Causal map',bow:'Bow-tie analysis',tree:'Fault tree',findings:'Findings & actions'}
const viewNav:Record<View,string>={overview:'overview',linear:'linear',lanes:'linear',map:'map',bow:'bow',tree:'map',findings:'findings'}

function ImportDialog({close}:{close:()=>void}) {
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form=new FormData(event.currentTarget)
    const file=form.get('file')
    const mode=form.get('mode')==='replace'?'replace':'merge'
    if (!(file instanceof File)||!file.size) {setError('Select a JSON file.');return}
    setBusy(true)
    try {
      const text=await file.text()
      const state=useStudio.getState()
      const imported=importFile(state.file,text,mode)
      state.commit(imported)
      state.select(null)
      close()
    } catch(err){setError((err as Error).message)}
    finally{setBusy(false)}
  }
  return <dialog className="modal" ref={node=>{if(node&&!node.open)node.showModal()}} onCancel={close}>
    <div className="modal-head"><h2>Import JSON</h2><button className="icon-button" aria-label="Close import" onClick={close}><X size={18}/></button></div>
    <form onSubmit={submit}>
      <label className="field">Investigation file<input type="file" name="file" accept=".json,application/json" required/></label>
      <fieldset><legend>Import mode</legend><label className="check"><input type="radio" name="mode" value="merge" required/> Merge cases and replace matching case IDs</label><label className="check"><input type="radio" name="mode" value="replace" required/> Replace the entire collection</label></fieldset>
      {error&&<p className="notice error" role="alert">{error}</p>}
      <div className="modal-actions"><button type="button" onClick={close}>Cancel</button><button className="primary" disabled={busy}>{busy?'Validating…':'Import cases'}</button></div>
    </form>
  </dialog>
}

function AssessmentDialog({data,close}:{data:Case;close:()=>void}) {
  const edit=useStudio(state=>state.edit)
  function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values=new FormData(event.currentTarget)
    const assessments={...data.categoryAssessments}
    for(const category of categories.slice(0,8)) assessments[category]=values.get(category) as Status
    edit({...data,categoryAssessments:assessments})
    close()
  }
  return <dialog className="modal" ref={node=>{if(node&&!node.open)node.showModal()}} onCancel={close}>
    <div className="modal-head"><h2>Initiation assessments</h2><button className="icon-button" aria-label="Close assessments" onClick={close}><X size={18}/></button></div>
    <form onSubmit={submit}><div className="form-grid">{categories.slice(0,8).map(category=><label className="field" key={category}>{label(category)}<select name={category} defaultValue={data.categoryAssessments[category]??'unassessed'}>{statuses.map(status=><option key={status} value={status}>{label(status)}</option>)}</select></label>)}</div><div className="modal-actions"><button type="button" onClick={close}>Cancel</button><button className="primary">Save assessments</button></div></form>
  </dialog>
}

export default function Studio() {
  const state=useStudio()
  const {init,prefs,prefsUpdate,file,selection,filters,filter,select}=state
  const [view,setView]=useState<View>('overview')
  const [editing,setEditing]=useState<EditRequest|null>(null)
  const [dialog,setDialog]=useState<'import'|'assessment'|null>(null)
  const [advanced,setAdvanced]=useState(false)
  const [mobileNav,setMobileNav]=useState(false)
  const [mobileInspector,setMobileInspector]=useState(false)
  const data=file.cases.find(data=>data.id===prefs.caseId)??file.cases[0]
  const invalidRange=Boolean(filters.from&&filters.to&&Date.parse(filters.from)>Date.parse(filters.to))
  const events=useMemo(()=>filterEvents(data,invalidRange?{...filters,from:'',to:''}:filters),[data,filters,invalidRange])
  const links=useMemo(()=>filterLinks(data.links,events,filters),[data.links,events,filters])
  const graphEvents=useMemo(()=>events.filter(event=>statusVisible(event.status,filters)),[events,filters])
  const graphLinks=useMemo(()=>filterLinks(data.links,graphEvents,filters),[data.links,graphEvents,filters])
  const selectedVisible=selection?.kind==='events'?(view==='map'||view==='tree'?graphEvents:events).some(event=>event.id===selection.id):selection?.kind==='links'?(view==='map'||view==='tree'?graphLinks:links).some(link=>link.id===selection.id):true
  useEffect(()=>init(),[init])
  useEffect(()=>{
    function history(event:KeyboardEvent) {
      if (!(event.ctrlKey||event.metaKey)||event.altKey||event.key.toLowerCase()!=='z'||(event.target instanceof HTMLElement&&event.target.closest('input,textarea,select,[contenteditable]'))) return
      event.preventDefault()
      const state=useStudio.getState()
      if(event.shiftKey)state.redo()
      else state.undo()
    }
    document.addEventListener('keydown',history)
    return ()=>document.removeEventListener('keydown',history)
  },[])
  function chooseView(next:View) {setView(next);setMobileNav(false)}
  function toggleSidebar() {
    if(window.matchMedia('(max-width: 850px)').matches)setMobileNav(!mobileNav)
    else prefsUpdate({sidebar:!prefs.sidebar})
  }
  function exportData(all:boolean) {downloadJson(all?file:{schemaVersion:1,cases:[data]},all?'rca-studio-cases':data.id)}
  const onSelect:typeof select = value=>{select(value);if(value)setMobileInspector(true)}
  const shared={data,selection,onSelect}
  const displayFilters=invalidRange?{...filters,from:'',to:''}:filters
  return <div className={'studio '+(prefs.dark?'dark ':'')+(prefs.sidebar?'':'sidebar-collapsed ')}>
    <a className="skip-link" href="#workspace">Skip to workspace</a>
    <header className="topbar">
      <div className="brand"><button className="icon-button" aria-label="Toggle navigation" onClick={toggleSidebar}><Menu size={19}/></button><span className="brand-icon"><Activity size={21}/></span><strong>RCA Studio</strong></div>
      <div className="case-picker"><label htmlFor="case-picker">Investigation</label><select id="case-picker" value={data.id} onChange={event=>{state.choose(event.target.value);setMobileInspector(false)}}>{file.cases.map(item=><option key={item.id} value={item.id}>{item.id} · {item.title}</option>)}</select></div>
      <div className="header-actions">
        <button aria-label="Import" onClick={()=>setDialog('import')}><ArrowUpFromLine size={15}/> <span>Import</span></button>
        <details className="export-menu"><summary aria-label="Export options"><ArrowDownToLine size={15}/> <span>Export</span> <ChevronDown size={13}/></summary><div><button onClick={event=>{exportData(false);event.currentTarget.closest('details')?.removeAttribute('open')}}>Export current case</button><button onClick={event=>{exportData(true);event.currentTarget.closest('details')?.removeAttribute('open')}}>Export all cases</button></div></details>
        <button className="icon-button" aria-label="Reset to seed" title="Reset to seed" onClick={()=>{if(window.confirm('Restore all fictional seed cases and clear saved graph positions? You can undo case changes this session.'))state.reset()}}><RotateCcw size={17}/></button>
        <button className="icon-button" aria-label={prefs.dark?'Use light theme':'Use dark theme'} onClick={()=>prefsUpdate({dark:!prefs.dark})}>{prefs.dark?<Sun size={17}/>:<Moon size={17}/>}</button>
      </div>
    </header>
    <div className="studio-body">
      {mobileNav&&<button className="drawer-scrim" aria-label="Dismiss navigation" onClick={()=>setMobileNav(false)}/>}
      <nav className={'sidebar '+(mobileNav?'drawer-open':'')} aria-label="Main navigation">
        <span className="sidebar-label">INVESTIGATION</span>
        {navigation.map(({id,label,icon:Icon})=><button key={id} title={label} aria-current={viewNav[view]===id?'page':undefined} onClick={()=>chooseView(id)}><Icon size={18}/><span>{label}</span></button>)}
        <div className="sidebar-footer"><Database size={17}/><span>Local workspace</span></div>
      </nav>
      <main className="workspace" id="workspace">
        <div className="case-header">
          <div><div className="case-kicker"><span>{data.id}</span><span className="fictional">Fictional data</span></div><h1>{data.title}</h1><p>{data.description}</p></div>
          <div className="case-actions"><button className="icon-button" aria-label="Undo change" onClick={state.undo} disabled={!state.past.length}><Undo2 size={17}/></button><button className="icon-button" aria-label="Redo change" onClick={state.redo} disabled={!state.future.length}><Redo2 size={17}/></button><button className="icon-button inspector-toggle" aria-label="Open inspector" onClick={()=>{prefsUpdate({inspector:true});setMobileInspector(true)}}><PanelRightOpen size={17}/></button><button className="primary" onClick={()=>setEditing({kind:'events'})}><Plus size={17}/> Add event</button></div>
        </div>
        <nav className="view-tabs" aria-label="Visualisation modes">{workspace.map(({id,label,icon:Icon})=><button key={id} aria-current={view===id?'page':undefined} onClick={()=>chooseView(id)}><Icon size={16}/>{label}</button>)}</nav>
        <div className="filter-bar">
          <label className="search-box"><Search size={16}/><input aria-label="Search events and evidence" placeholder="Search events and evidence" value={filters.query} onChange={event=>filter({query:event.target.value})}/></label>
          <select aria-label="Category filter" value={filters.category} onChange={event=>filter({category:event.target.value as Category|''})}><option value="">All categories</option>{categories.map(category=><option key={category} value={category}>{label(category)}</option>)}</select>
          <select aria-label="Evidence status filter" value={filters.status} onChange={event=>filter({status:event.target.value as Status|''})}><option value="">All statuses</option>{statuses.map(status=><option key={status} value={status}>{label(status)}</option>)}</select>
          <button aria-expanded={advanced} onClick={()=>setAdvanced(!advanced)}><SlidersHorizontal size={15}/> Filters</button>
        </div>
        {advanced&&<div className="advanced-filters">
          <label className="inline-field">Role <select value={filters.role} onChange={event=>filter({role:event.target.value as typeof filters.role})}><option value="">All roles</option>{roles.map(role=><option key={role} value={role}>{label(role)}</option>)}</select></label>
          <label className="inline-field">From (local) <input type="datetime-local" value={filters.from} onChange={event=>filter({from:event.target.value})}/></label>
          <label className="inline-field">To (local) <input type="datetime-local" value={filters.to} onChange={event=>filter({to:event.target.value})}/></label>
          <label className="check"><input type="checkbox" checked={filters.hypotheses} onChange={event=>filter({hypotheses:event.target.checked})}/> Hypotheses & unassessed</label>
          <label className="check"><input type="checkbox" checked={filters.ruledOut} onChange={event=>filter({ruledOut:event.target.checked})}/> Ruled-out relationships</label>
          <button onClick={()=>filter(emptyFilters)}>Clear filters</button>
          {invalidRange&&<p className="notice error" role="alert">The end of the filter range precedes its start.</p>}
        </div>}
        <div className="workspace-content">
          <div className="workspace-heading"><h2>{viewTitle[view]}</h2><span>{events.length} of {data.events.length} events</span></div>
          {!state.ready?<p role="status">Loading investigation…</p>:<>
          {view==='overview'&&<Overview {...shared} events={events} links={links} category={filters.category} onCategory={category=>filter({category:filters.category===category?'':category})} onAssessment={()=>setDialog('assessment')} onTimeline={()=>chooseView('linear')}/>}
          {(view==='linear'||view==='lanes')&&<div className="panel"><Timeline key={data.id+view} {...shared} events={events} links={links} lanes={view==='lanes'} from={displayFilters.from} to={displayFilters.to}/></div>}
          {(view==='map'||view==='tree')&&<Graph key={data.id+view} {...shared} events={graphEvents} links={graphLinks} filters={filters} openEditor={setEditing} tree={view==='tree'}/>}
          {view==='bow'&&<BowTie {...shared} events={events} openEditor={setEditing}/>}
          {view==='findings'&&<Findings key={data.id} {...shared} openEditor={setEditing}/>}
          </>}
        </div>
        <footer className={'statusbar '+(state.storageError?'error':'')} role="status"><span className="status-dot"/>{state.message}</footer>
      </main>
      {prefs.inspector&&<div className={'inspector-wrap '+(mobileInspector?'drawer-open':'')}><Inspector key={data.id} data={data} selection={selection} filters={filters} visible={selectedVisible} openEditor={setEditing}/></div>}
      {prefs.inspector&&mobileInspector&&<button className="drawer-scrim right-scrim" aria-label="Dismiss inspector" onClick={()=>setMobileInspector(false)}/>}
    </div>
    {editing&&<Editor data={data} request={editing} close={()=>setEditing(null)}/>}
    {dialog==='import'&&<ImportDialog close={()=>setDialog(null)}/>}
    {dialog==='assessment'&&<AssessmentDialog data={data} close={()=>setDialog(null)}/>}
    <PrintReport data={data}/>
  </div>
}
