import {z} from 'zod'
import type {CaseFile} from './schema'
import {parseFile} from './validation'

export const storageKey = 'rca-studio.v1'
const preferences = z.object({
  caseId:z.string(),dark:z.boolean(),sidebar:z.boolean(),inspector:z.boolean(),
  positions:z.record(z.string(),z.record(z.string(),z.object({x:z.number(),y:z.number()})))
})
export type Preferences = z.infer<typeof preferences>
export type Snapshot = {file:CaseFile; prefs:Preferences}
export function readStorage(storage:Pick<Storage,'getItem'>): Snapshot|null {
  const raw = storage.getItem(storageKey)
  if (!raw) return null
  const saved = JSON.parse(raw)
  return {file:parseFile(saved.file),prefs:preferences.parse(saved.prefs)}
}
export function writeStorage(storage:Pick<Storage,'setItem'>, snapshot:Snapshot) {
  storage.setItem(storageKey,JSON.stringify(snapshot))
}
export function importFile(current:CaseFile,text:string,mode:'merge'|'replace') {
  const incoming = parseFile(JSON.parse(text))
  if (mode==='replace') return incoming
  const cases = new Map(current.cases.map(data=>[data.id,data]))
  for (const data of incoming.cases) cases.set(data.id,data)
  return {schemaVersion:1 as const,cases:[...cases.values()]}
}
export function downloadJson(file:CaseFile,name:string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(file,null,2)+'\n'],{type:'application/json'}))
  const anchor = document.createElement('a')
  anchor.href=url
  anchor.download=name+'.json'
  anchor.click()
  setTimeout(()=>URL.revokeObjectURL(url),1000)
}
