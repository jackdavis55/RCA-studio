import {CaseFileSchema, collections, type Case, type CaseFile, type Link} from './schema'

export function hasCycle(edges: [string,string][]) {
  const outgoing = new Map<string,string[]>()
  for (const [from,to] of edges) outgoing.set(from,[...(outgoing.get(from) ?? []),to])
  const active = new Set<string>()
  const visited = new Set<string>()
  function visit(node: string): boolean {
    if (active.has(node)) return true
    if (visited.has(node)) return false
    active.add(node)
    if (outgoing.get(node)?.some(visit)) return true
    active.delete(node)
    visited.add(node)
    return false
  }
  return [...outgoing.keys()].some(visit)
}

export function timingConflict(data: Case, link: Link) {
  const source = data.events.find(event=>event.id===link.source)
  const target = data.events.find(event=>event.id===link.target)
  return Boolean(source?.time && target?.time && Date.parse(source.time)>Date.parse(target.endTime ?? target.time))
}

export function validateCase(data: Case) {
  const errors: string[] = []
  const ids = new Set<string>()
  for (const collection of collections) for (const item of data[collection]) {
    if (ids.has(item.id)) errors.push('Duplicate record ID '+item.id)
    ids.add(item.id)
  }
  const events = new Map(data.events.map(event=>[event.id,event]))
  const barriers = new Map(data.barriers.map(barrier=>[barrier.id,barrier]))
  const gates = new Set(data.gates.map(gate=>gate.id))
  const evidence = new Set(data.evidence.map(item=>item.id))
  if (events.get(data.topEventId)?.role!=='top-event' || data.events.filter(event=>event.role==='top-event').length!==1) errors.push('Choose exactly one valid top event')
  for (const item of [...data.events,...data.links,...data.barriers]) {
    for (const ref of item.evidenceIds) if (!evidence.has(ref)) errors.push(item.id+' references missing evidence '+ref)
  }
  for (const event of data.events) {
    if (event.endTime && (!event.time || Date.parse(event.endTime)<Date.parse(event.time))) errors.push(event.id+' has an invalid time range')
    if (event.timePrecision==='range' && !event.endTime) errors.push(event.id+' requires a range end')
  }
  const linkKeys = new Set<string>()
  for (const link of data.links) {
    if (!events.has(link.source) || !events.has(link.target)) errors.push(link.id+' references a missing event')
    if (link.source===link.target) errors.push(link.id+' links an event to itself')
    const key = JSON.stringify([link.source,link.target,link.type])
    if (linkKeys.has(key)) errors.push(link.id+' duplicates a relationship')
    linkKeys.add(key)
  }
  const causalEdges = data.links.map(({source,target}):[string,string]=>[source,target])
  if (hasCycle(causalEdges)) errors.push('Causal links contain a cycle')
  const gateEdges: [string,string][] = []
  for (const gate of data.gates) {
    if (!events.has(gate.outputId)) errors.push(gate.id+' has a missing output event')
    if (new Set(gate.inputIds).size!==gate.inputIds.length) errors.push(gate.id+' repeats an input')
    for (const input of gate.inputIds) {
      if (!events.has(input) && !gates.has(input)) errors.push(gate.id+' has a missing input '+input)
      gateEdges.push([input,gate.id])
    }
    gateEdges.push([gate.id,gate.outputId])
  }
  if (hasCycle(gateEdges)) errors.push('Fault tree gates contain a cycle')
  for (const path of data.pathways) {
    const left = path.side==='left'
    const endpoint = left ? path.threatId : path.consequenceId
    if (!endpoint || !events.has(endpoint) || (left ? path.consequenceId : path.threatId)) errors.push(path.id+' has an invalid pathway endpoint')
    if (endpoint && (left ? events.get(endpoint)?.role!=='trigger' : events.get(endpoint)?.role!=='consequence')) errors.push(path.id+' has an invalid pathway event role')
    if (new Set(path.barrierIds).size!==path.barrierIds.length) errors.push(path.id+' repeats a barrier')
    for (const barrier of path.barrierIds) if (barriers.get(barrier)?.role!==(left?'preventive':'mitigative')) errors.push(path.id+' has an invalid barrier '+barrier)
  }
  for (const action of data.actions) {
    const targets = action.targetType==='event' ? data.events : action.targetType==='link' ? data.links : data.barriers
    if (!targets.some(item=>item.id===action.targetId)) errors.push(action.id+' references a missing action target')
  }
  return errors
}

export function parseFile(value: unknown): CaseFile {
  const result = CaseFileSchema.safeParse(value)
  if (!result.success) throw new Error(result.error.issues.map(issue=>issue.path.join('.')+' — '+issue.message).join('\n'))
  const ids = new Set<string>()
  for (const data of result.data.cases) {
    if (ids.has(data.id)) throw new Error('Duplicate case ID '+data.id)
    ids.add(data.id)
    const errors = validateCase(data)
    if (errors.length) throw new Error(data.id+' — '+errors.join('\n'))
  }
  return result.data
}
