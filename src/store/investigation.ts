import {create} from 'zustand'
import rawSeed from '../data/cases.json'
import timelineExample from '../data/plant-feed-timeline.json'
import {parseFile} from '../lib/validation'
import {readStorage,writeStorage,type Preferences} from '../lib/storage'
import {emptyFilters,type Filters} from '../lib/selectors'
import type {Case,CaseFile,Selection} from '../lib/schema'

const canonical = parseFile(rawSeed)
const originalDemo = canonical.cases[0]
export const seed = parseFile({...canonical,cases:canonical.cases.map(data=>data.id===originalDemo.id?{
  ...data,events:[...data.events,...timelineExample.events],evidence:[...data.evidence,...timelineExample.evidence],
}:data)})

function refreshUneditedDemo(file:CaseFile): CaseFile {
  const demo=file.cases.find(data=>data.id===originalDemo.id)
  if (JSON.stringify(demo)!==JSON.stringify(originalDemo)) return file
  return {...file,cases:file.cases.map(data=>data.id===originalDemo.id?seed.cases[0]:data)}
}
const defaults:Preferences = {caseId:seed.cases[0].id,dark:false,sidebar:true,inspector:true,positions:{}}
type State = {
  file:CaseFile; prefs:Preferences; ready:boolean; message:string; storageError:boolean
  past:CaseFile[]; future:CaseFile[]; selection:Selection|null; filters:Filters
  init:()=>void; commit:(file:CaseFile)=>void; edit:(data:Case)=>void
  prefsUpdate:(prefs:Partial<Preferences>)=>void; choose:(id:string)=>void; reset:()=>void
  select:(selection:Selection|null)=>void; filter:(filters:Partial<Filters>)=>void
  undo:()=>void; redo:()=>void
}
export const useStudio = create<State>((set,get)=>{
  function save() {
    const {file,prefs}=get()
    try {
      writeStorage(window.localStorage,{file,prefs})
      set({message:'Saved locally',storageError:false})
    } catch {
      set({message:'Could not save to browser storage. Export to keep your changes.',storageError:true})
    }
  }
  function swap(file:CaseFile) {
    const {prefs,selection}=get()
    const data=file.cases.find(data=>data.id===prefs.caseId)??file.cases[0]
    set({file,prefs:{...prefs,caseId:data.id},selection:selection&&data[selection.kind].some(item=>item.id===selection.id)?selection:null})
  }
  return {
    file:seed,prefs:defaults,ready:false,message:'Loading saved investigation…',storageError:false,
    past:[],future:[],selection:null,filters:emptyFilters,
    init() {
      if (get().ready) return
      try {
        const saved=readStorage(window.localStorage)
        if (saved) {set({prefs:saved.prefs});swap(refreshUneditedDemo(saved.file))}
        set({ready:true,message:saved?'Saved locally':'Seed data loaded'})
      } catch {
        set({ready:true,message:'Could not read browser storage. The fictional seed is available.',storageError:true})
      }
    },
    commit(file) {
      const validated=parseFile(file)
      set(state=>({past:[...state.past,state.file].slice(-40),future:[]}))
      swap(validated)
      save()
    },
    edit(data) {get().commit({...get().file,cases:get().file.cases.map(item=>item.id===data.id?data:item)})},
    prefsUpdate(prefs) {set(state=>({prefs:{...state.prefs,...prefs}}));save()},
    choose(caseId) {set({selection:null});get().prefsUpdate({caseId})},
    reset() {
      set(state=>({prefs:{...state.prefs,positions:{},caseId:defaults.caseId},selection:null,filters:emptyFilters}))
      get().commit(seed)
    },
    select(selection) {set(state=>({selection,prefs:selection?{...state.prefs,inspector:true}:state.prefs}))},
    filter(filters) {set(state=>({filters:{...state.filters,...filters}}))},
    undo() {
      const {past,file,future}=get()
      if (!past.length) return
      swap(past[past.length-1])
      set({past:past.slice(0,-1),future:[file,...future]})
      save()
    },
    redo() {
      const {past,file,future}=get()
      if (!future.length) return
      swap(future[0])
      set({past:[...past,file],future:future.slice(1)})
      save()
    },
  }
})
