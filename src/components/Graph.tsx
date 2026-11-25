import {useEffect,useMemo,useState} from 'react'
import {Background,BaseEdge,Controls,EdgeLabelRenderer,Handle,MarkerType,MiniMap,Position,ReactFlow,getSmoothStepPath,useReactFlow,ReactFlowProvider,type Edge,type EdgeProps,type Node,type NodeProps,type XYPosition} from '@xyflow/react'
import {GitBranch,Plus,RotateCcw,Shield,Workflow} from 'lucide-react'
import {arrange,nodeHeight,nodeWidth} from '../lib/layout'
import {type Case,type Event,type Link,type Selection} from '../lib/schema'
import {label,statusVisible,trace,type Filters} from '../lib/selectors'
import {timingConflict} from '../lib/validation'
import {useStudio} from '../store/investigation'
import {Badge,Empty,barrierColor,eventStyle,tint} from './shared'
import {type EditRequest} from './Inspector'

type GraphNode=Node<{title:string;subtitle:string;status:string;color:string;vertical:boolean;icon:'event'|'gate'|'barrier';selection:Selection;undeveloped?:boolean}>
function InvestigationNode({data,selected}:NodeProps<GraphNode>) {
  const input=data.vertical?Position.Top:Position.Left
  const output=data.vertical?Position.Bottom:Position.Right
  const Icon=data.icon==='gate'?GitBranch:data.icon==='barrier'?Shield:Workflow
  return <div className={`graph-node ${data.icon} ${selected?'selected':''} ${data.undeveloped?'undeveloped':''}`} style={tint(data.color)}>
    <Handle id="in" type="target" position={input}/>
    {!data.vertical&&<Handle id="in-bottom" type="target" position={Position.Bottom}/>}
    <span className="eyebrow">{data.subtitle}</span><strong><Icon size={16}/>{data.title}</strong><Badge value={data.status}/>
    <Handle id="out" type="source" position={output}/>
    {!data.vertical&&<Handle id="out-top" type="source" position={Position.Top}/>}
  </div>
}
function RelationshipEdge(props:EdgeProps) {
  const [path,x,y]=getSmoothStepPath(props)
  return <><BaseEdge id={props.id} path={path} markerEnd={props.markerEnd} style={props.style}/>
    {props.label&&<EdgeLabelRenderer><span className="edge-label" style={{transform:`translate(-50%, -50%) translate(${x}px,${y}px)`}}>{props.label}</span></EdgeLabelRenderer>}
  </>
}
const nodeTypes={investigation:InvestigationNode}
const edgeTypes={relationship:RelationshipEdge}
const noPositions:Record<string,XYPosition>={}

type Props={data:Case;events:Event[];links:Link[];filters:Filters;selection:Selection|null;onSelect:(selection:Selection)=>void;openEditor:(request:EditRequest)=>void;tree?:boolean}
export function Graph(props:Props) {
  return <ReactFlowProvider><GraphCanvas {...props}/></ReactFlowProvider>
}
function GraphCanvas({data,events,links,filters,selection,onSelect,openEditor,tree=false}:Props) {
  const [editing,setEditing]=useState(false)
  const [layout,setLayout]=useState<{key:string;positions:Record<string,XYPosition>}>({key:'',positions:{}})
  const [layoutVersion,setLayoutVersion]=useState(0)
  const [layoutError,setLayoutError]=useState('')
  const [drag,setDrag]=useState<Record<string,XYPosition>>({})
  const flow=useReactFlow()
  const positionKey=data.id+(tree?':tree':':map')
  const prefsUpdate=useStudio(state=>state.prefsUpdate)
  const manual=useStudio(state=>state.prefs.positions[positionKey]??noPositions)
  const graph=useMemo(()=>{
    const nodes:GraphNode[]=[]
    const edges:Edge[]=[]
    const ids=new Set(events.map(event=>event.id))
    const gates=data.gates.filter(gate=>ids.has(gate.outputId)&&statusVisible(gate.status,filters))
    const gateIds=new Set(gates.map(gate=>gate.id))
    const gateOutputs=new Set(gates.map(gate=>gate.outputId))
    const visibleLinks=tree?links.filter(link=>!gateOutputs.has(link.target)&&['causes','contributes','enables'].includes(link.type)):links
    const treeEdges=[...visibleLinks,...gates.flatMap(gate=>[...gate.inputIds.filter(id=>ids.has(id)||gateIds.has(id)).map(source=>({source,target:gate.id})),{source:gate.id,target:gate.outputId}])]
    const connected=trace(data.topEventId,treeEdges,'up')
    function addNode(id:string,title:string,subtitle:string,status:string,color:string,icon:GraphNode['data']['icon'],kind:Selection['kind'],undeveloped=false) {
      nodes.push({id,type:'investigation',position:{x:0,y:0},data:{title,subtitle,status,color,icon,vertical:tree,selection:{kind,id},undeveloped},width:nodeWidth,height:nodeHeight,ariaLabel:title})
    }
    function addEdge(id:string,source:string,target:string,status:string,caption?:string,linkId?:string) {
      edges.push({id,source:tree?target:source,target:tree?source:target,type:'relationship',label:caption,data:{linkId},
        markerEnd:!tree&&status!=='ruled-out'?{type:MarkerType.ArrowClosed,color:'#64748B'}:undefined,
        style:{stroke:'#64748B',strokeWidth:1.6,strokeDasharray:['hypothesis','unassessed','ruled-out'].includes(status)?'6 4':undefined,opacity:status==='ruled-out'?0.55:1}})
    }
    for (const event of events) {
      if(tree&&!connected.has(event.id))continue
      const undeveloped=tree&&event.id!==data.topEventId&&!treeEdges.some(edge=>edge.target===event.id)&&['event','condition'].includes(event.role)
      addNode(event.id,event.title,undeveloped?'Undeveloped event':tree&&event.role==='trigger'?'Basic event':label(event.role==='event'?event.category:event.role),event.status,eventStyle(event)[0],'event','events',undeveloped)
    }
    for (const link of visibleLinks) {
      if(tree&&(!connected.has(link.source)||!connected.has(link.target)))continue
      const caption=link.status==='ruled-out'?'× Ruled out':link.status==='supported'?'Supported':undefined
      addEdge('link:'+link.id,link.source,link.target,link.status,[caption,timingConflict(data,link)?'Time conflict':undefined].filter(Boolean).join(' · ')||undefined,link.id)
    }
    for (const gate of gates) {
      if(tree&&!connected.has(gate.id))continue
      addNode(gate.id,gate.operator,gate.operator==='AND'?'All inputs required':'Any input sufficient',gate.status,'#64748B','gate','gates')
      for (const input of gate.inputIds) if(ids.has(input)||gateIds.has(input)) addEdge('input:'+gate.id+':'+input,input,gate.id,gate.status)
      addEdge('output:'+gate.id,gate.id,gate.outputId,gate.status)
    }
    if (!tree) for (const barrier of data.barriers) addNode(barrier.id,barrier.title,label(barrier.role)+' barrier',barrier.status,barrierColor[barrier.status],'barrier','barriers')
    const renderedIds=new Set(nodes.map(node=>node.id))
    return {nodes,edges:edges.filter(edge=>renderedIds.has(edge.source)&&renderedIds.has(edge.target))}
  },[data,events,links,tree,filters])
  const structure=JSON.stringify([positionKey,graph.nodes.map(node=>node.id),graph.edges.map(({id,source,target})=>({id,source,target}))])
  useEffect(()=>{
    let active=true
    const [,ids,edges]=JSON.parse(structure) as [string,string[],Edge[]]
    const nodes=ids.map(id=>({id,position:{x:0,y:0},data:{}}))
    arrange(nodes,edges,tree?'DOWN':'RIGHT').then(positions=>{
      if(!active)return
      setLayout({key:structure,positions})
      setLayoutError('')
      setDrag({})
      requestAnimationFrame(()=>{if(active)void flow.fitView({padding:.18,minZoom:window.matchMedia('(max-width: 850px)').matches?.62:undefined})})
    }).catch(()=>{
      if(!active)return
      setLayoutError('Automatic layout failed. A grid layout is shown.')
      const positions=Object.fromEntries(nodes.map(({id},index)=>[id,{x:(index%4)*255,y:Math.floor(index/4)*145}]))
      setLayout({key:structure,positions})
    })
    return ()=>{active=false}
  },[structure,tree,flow,layoutVersion])
  const selected=selection?.id
  const selectedLink=selection?.kind==='links'?graph.edges.find(edge=>edge.data?.linkId===selected):undefined
  const path=selected?new Set([...trace(selectedLink?.source??selected,graph.edges,'up'),...trace(selectedLink?.target??selected,graph.edges,'down')]):null
  const hasGraphSelection=!!selected&&(graph.nodes.some(node=>node.id===selected)||!!selectedLink)
  const hiddenSelection=tree&&selection&&['events','links','gates'].includes(selection.kind)&&!hasGraphSelection
  const nodes=graph.nodes.map(node=>({...node,position:drag[node.id]??manual[node.id]??layout.positions[node.id]??node.position,selected:selected===node.id,style:{opacity:hasGraphSelection&&!path?.has(node.id)?0.45:1}}))
  const edges=graph.edges.map(edge=>({...edge,selected:!!selectedLink&&edge.id===selectedLink.id,style:{...edge.style,opacity:hasGraphSelection&&!(path?.has(edge.source)&&path?.has(edge.target))?0.25:edge.style?.opacity}}))
  function resetLayout() {
    const positions={...useStudio.getState().prefs.positions}
    delete positions[positionKey]
    prefsUpdate({positions})
    setDrag({})
    setLayoutVersion(value=>value+1)
  }
  return <section className="panel graph-panel">
    <div className="view-toolbar"><div><strong>{tree?'Fault tree':'Causal map'}</strong><small>{tree?'Qualitative model with explicit AND / OR logic':'Drag to position · Select to trace upstream and downstream'}</small></div>
      <div className="toolbar-actions"><button onClick={resetLayout}><RotateCcw size={15}/> Reset layout</button>{!tree&&<button onClick={()=>setEditing(!editing)} aria-pressed={editing}>Edit graph</button>}{tree&&<button onClick={()=>openEditor({kind:'gates'})}><Plus size={15}/> Gate</button>}</div>
    </div>
    {hiddenSelection&&<p className="notice" role="status">The selected record is outside the visible fault tree.</p>}
    {layoutError&&<p className="notice">{layoutError}</p>}
    {tree&&!data.gates.length?<Empty>No fault tree has been defined. Add a gate to model the inputs explicitly.</Empty>:!nodes.length?<Empty>No graph nodes match the filters.</Empty>:<>
    <div className="graph-body">
      {editing&&<div className="palette" aria-label="Node palette"><strong>Node palette</strong>
        <button onClick={()=>openEditor({kind:'events'})}><Plus size={14}/> Event</button>
        <button onClick={()=>openEditor({kind:'events',defaults:{role:'condition'}})}><Plus size={14}/> Condition</button>
        <button onClick={()=>openEditor({kind:'events',defaults:{role:'consequence',category:'consequence'}})}><Plus size={14}/> Consequence</button>
        <button onClick={()=>openEditor({kind:'barriers'})}><Plus size={14}/> Barrier</button>
        <button onClick={()=>openEditor({kind:'gates'})}><Plus size={14}/> Gate</button>
        <button onClick={()=>openEditor({kind:'links'})}><Plus size={14}/> Relationship</button>
      </div>}
      <div className="graph-canvas" aria-label={tree?'Fault tree canvas':'Causal map canvas'}>
        {layout.key!==structure&&<div className="graph-loading" role="status">Arranging graph…</div>}
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView fitViewOptions={{padding:.18}} minZoom={.12} maxZoom={2.5}
          nodesConnectable={!tree&&editing} deleteKeyCode={null}
          onNodesChange={changes=>{
            for (const change of changes) {
              if(change.type==='position'&&change.position) {
                const {id,position}=change
                setDrag(current=>({...current,[id]:position}))
                if(!change.dragging) prefsUpdate({positions:{...useStudio.getState().prefs.positions,[positionKey]:{...(useStudio.getState().prefs.positions[positionKey]??{}),[id]:position}}})
              }
              if(change.type==='select'&&change.selected) {
                const node=nodes.find(node=>node.id===change.id)
                if(node)onSelect(node.data.selection)
              }
            }
          }}
          onNodeClick={(_,node)=>onSelect(node.data.selection)}
          onEdgesChange={changes=>{for(const change of changes)if(change.type==='select'&&change.selected){const linkId=edges.find(edge=>edge.id===change.id)?.data?.linkId;if(typeof linkId==='string')onSelect({kind:'links',id:linkId})}}}
          onEdgeClick={(_,edge)=>{if(typeof edge.data?.linkId==='string')onSelect({kind:'links',id:edge.data.linkId})}}
          onConnect={({source,target})=>{if(data.events.some(event=>event.id===source)&&data.events.some(event=>event.id===target))openEditor({kind:'links',defaults:{source,target}})}}
          isValidConnection={({source,target})=>source!==target&&data.events.some(event=>event.id===source)&&data.events.some(event=>event.id===target)}
        ><Background gap={20} size={1.2}/><Controls showInteractive={false}/><MiniMap pannable zoomable nodeColor={node=>String(node.data.color)} position="bottom-right"/></ReactFlow>
      </div>
    </div>
    <div className="graph-legend"><span><i/> Confirmed / supported</span><span><i className="dashed"/> Hypothesis / unassessed</span>{filters.ruledOut&&<span>× Ruled out</span>}{tree&&<span>Non-gate branches show recorded causal relationships.</span>}</div>
    </>}
  </section>
}
