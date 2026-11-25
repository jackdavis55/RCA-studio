import { z } from 'zod'

export const categories = ['procedural','equipment','environmental','human','external','organisational','software','design','process','consequence'] as const
export const statuses = ['unassessed','hypothesis','supported','confirmed','ruled-out'] as const
export const roles = ['trigger','condition','event','top-event','consequence'] as const
export const occurrences = ['observed','possible','prevented','not-observed','unknown'] as const
export const precisions = ['exact','approximate','range','unknown'] as const
export const linkTypes = ['causes','contributes','enables','prevents','mitigates'] as const
export const barrierStatuses = ['effective','degraded','failed','missing','unknown'] as const
export const actionStatuses = ['open','in-progress','complete'] as const
export const targetTypes = ['event','link','barrier'] as const
const id = z.string().trim().min(1)
const title = z.string().trim().min(1)
const time = z.iso.datetime({offset:true}).nullable()
const status = z.enum(statuses)
const evidenceIds = z.array(id)
export const EventSchema = z.object({id,title,description:z.string(),category:z.enum(categories),role:z.enum(roles),time,endTime:z.iso.datetime({offset:true}).optional(),timePrecision:z.enum(precisions),status,occurrence:z.enum(occurrences),evidenceIds,asset:z.string().optional(),source:z.string().optional()})
export const LinkSchema = z.object({id,source:id,target:id,type:z.enum(linkTypes),status,rationale:z.string(),evidenceIds,timeException:z.string().trim().min(1).optional()})
export const EvidenceSchema = z.object({id,title,source:z.string(),observation:z.string(),time,reliability:z.string()})
export const BarrierSchema = z.object({id,title,role:z.enum(['preventive','mitigative']),status:z.enum(barrierStatuses),owner:z.string(),evidenceIds})
export const PathwaySchema = z.object({id,threatId:id.optional(),consequenceId:id.optional(),barrierIds:z.array(id),side:z.enum(['left','right'])})
export const GateSchema = z.object({id,operator:z.enum(['AND','OR']),inputIds:z.array(id).min(2),outputId:id,status,rationale:z.string()})
export const ActionSchema = z.object({id,title,targetType:z.enum(targetTypes),targetId:id,owner:z.string(),dueDate:z.iso.date().nullable(),status:z.enum(actionStatuses),rationale:z.string(),confidence:status.optional()})
export const CaseSchema = z.object({id,title,description:z.string(),fictional:z.literal(true),timezone:z.string().refine(value=>{
  try { new Intl.DateTimeFormat('en',{timeZone:value}); return true } catch {return false}
},'Unknown time zone'),topEventId:id,events:z.array(EventSchema),links:z.array(LinkSchema),evidence:z.array(EvidenceSchema),barriers:z.array(BarrierSchema),pathways:z.array(PathwaySchema),gates:z.array(GateSchema),actions:z.array(ActionSchema),categoryAssessments:z.partialRecord(z.enum(categories),status)})
export const CaseFileSchema = z.object({schemaVersion:z.literal(1),cases:z.array(CaseSchema).min(1)})
export type CaseFile = z.infer<typeof CaseFileSchema>
export type Case = z.infer<typeof CaseSchema>
export type Event = z.infer<typeof EventSchema>
export type Link = z.infer<typeof LinkSchema>
export type Evidence = z.infer<typeof EvidenceSchema>
export type Barrier = z.infer<typeof BarrierSchema>
export type Gate = z.infer<typeof GateSchema>
export type Category = Event['category']
export type Status = Event['status']
export type Action = z.infer<typeof ActionSchema>
export const collections = ['events','links','evidence','barriers','gates','pathways','actions'] as const
export type Collection = typeof collections[number]
export type Selection = {kind: Collection; id: string}
