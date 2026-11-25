import {describe,expect,it} from 'vitest'
import {categories} from '../src/lib/schema'
import bundledSeed from '../src/data/cases.json'
import {seed} from '../src/store/investigation'
import {parseFile,hasCycle,timingConflict,validateCase} from '../src/lib/validation'
import {emptyFilters,filterEvents,filterLinks,stackEvents,timeScale,trace} from '../src/lib/selectors'
import {importFile,readStorage,writeStorage,type Snapshot} from '../src/lib/storage'
import rawSeed from '../cases.json'
import {arrange} from '../src/lib/layout'

const first=seed.cases[0]
describe('canonical case validation',()=>{
  it('preserves all canonical records and covers every category on one dated timeline',()=>{
    expect(bundledSeed).toEqual(rawSeed)
    const canonical=parseFile(rawSeed)
    expect(seed.cases.slice(1)).toEqual(canonical.cases.slice(1))
    expect(first.events).toEqual(expect.arrayContaining(canonical.cases[0].events))
    expect(new Set(first.events.filter(event=>event.time).map(event=>event.category))).toEqual(new Set(categories))
    expect(seed.cases).toHaveLength(8)
  })
  it('rejects malformed timestamps and schema versions',()=>{
    const copy=structuredClone(seed)
    copy.cases[0].events[0].time='2026-05-10T08:00:00'
    expect(()=>parseFile(copy)).toThrow(/time/)
    expect(()=>parseFile({...seed,schemaVersion:2})).toThrow(/schemaVersion/)
  })
  it('rejects duplicate IDs and referenced removals',()=>{
    expect(()=>parseFile({...seed,cases:[first,first]})).toThrow(/Duplicate case/)
    expect(validateCase({...first,events:[...first.events,first.events[0]]})).toContain('Duplicate record ID normal')
    expect(validateCase({...first,events:first.events.filter(event=>event.id!=='trigger')})).toEqual(expect.arrayContaining([expect.stringContaining('missing event')]))
  })
  it('validates ranges, pathway roles, action targets and gate logic',()=>{
    const copy=structuredClone(first)
    copy.events[0].endTime='2026-05-09T08:00:00Z'
    copy.pathways[0].barrierIds=['b3']
    copy.actions[0].targetId='missing'
    copy.gates[0].inputIds=['g2','condition']
    copy.gates[1].inputIds=['g1','trigger']
    expect(validateCase(copy).join(' ')).toMatch(/invalid time range.*cycle.*invalid barrier.*missing action target/)
    expect(hasCycle([['a','b'],['a','c'],['b','c']])).toBe(false)
    expect(hasCycle([['a','a']])).toBe(true)
  })
  it('flags a relationship with reversed known times',()=>{
    expect(timingConflict(first,{...first.links[0],source:'impact',target:'normal'})).toBe(true)
  })
})
describe('visualisation selectors',()=>{
  it('searches evidence and preserves original data',()=>{
    const evidence=first.evidence.find(item=>item.id==='E-normal')!
    expect(filterEvents(first,{...emptyFilters,query:evidence.title}).map(event=>event.id)).toContain('normal')
    expect(first.events).toHaveLength(16)
  })
  it('uses overlapping time ranges and retains the undated tray',()=>{
    const ids=filterEvents(first,{...emptyFilters,from:'2026-05-10T08:20:00Z',to:'2026-05-10T08:21:00Z'}).map(event=>event.id)
    expect(ids).toContain('condition')
    expect(ids).toContain('latent')
    expect(ids).not.toContain('normal')
  })
  it('keeps scale proportional and retains anchors while stacking collisions',()=>{
    const scale=timeScale(0,10000,1000)
    expect(scale(5000)).toBe((scale(0)+scale(10000))/2)
    const items=stackEvents(first.events.slice(0,3),()=>20)
    expect(items.map(({row,x})=>[row,x])).toEqual([[0,20],[1,20],[2,20]])
  })
  it('filters relationship statuses and traces convergence and branching',()=>{
    const visible=filterLinks(first.links,first.events,emptyFilters)
    expect(visible.some(link=>link.status==='ruled-out')).toBe(false)
    expect(filterLinks(first.links,first.events,{...emptyFilters,ruledOut:true})).toHaveLength(first.links.length)
    expect([...trace('upset',visible,'up')]).toEqual(expect.arrayContaining(['trigger','intermediate','latent']))
    expect([...trace('top',visible,'down')]).toEqual(expect.arrayContaining(['impact','safe']))
  })
  it('lays out causal and fault-tree dependencies in their respective directions',async()=>{
    const nodes=['a','b'].map(id=>({id,position:{x:0,y:0},data:{}}))
    const edges=[{id:'edge',source:'a',target:'b'}]
    const right=await arrange(nodes,edges,'RIGHT')
    const down=await arrange(nodes,edges,'DOWN')
    expect(right.a.x).toBeLessThan(right.b.x)
    expect(down.a.y).toBeLessThan(down.b.y)
  })
})
describe('persistence and import/export',()=>{
  it('round-trips a locally edited case and manual positions',()=>{
    const store=new Map<string,string>()
    const storage={getItem:(key:string)=>store.get(key)??null,setItem:(key:string,value:string)=>{store.set(key,value)}}
    const file=structuredClone(seed)
    file.cases[0].events[0].title='Edited locally'
    const snapshot:Snapshot={file,prefs:{caseId:first.id,dark:false,sidebar:true,inspector:true,positions:{'RCA-001:map':{normal:{x:10,y:20}}}}}
    writeStorage(storage,snapshot)
    expect(readStorage(storage)).toEqual(snapshot)
    const exported=JSON.stringify({schemaVersion:1,cases:[file.cases[0]]})
    expect(importFile(seed,exported,'merge')).toEqual(file)
    expect(importFile(seed,exported,'replace').cases).toHaveLength(1)
    expect(()=>importFile(seed,'{','replace')).toThrow()
    expect(seed.cases[0].events[0].title).toBe('Normal operation')
  })
})
