import ELK from 'elkjs/lib/elk.bundled.js'
import type {Edge,Node,XYPosition} from '@xyflow/react'

export const nodeWidth=214
export const nodeHeight=104
const elk=new ELK()
export async function arrange(nodes:Node[],edges:Edge[],direction:'RIGHT'|'DOWN'):Promise<Record<string,XYPosition>> {
  if (!nodes.length) return {}
  const graph=await elk.layout({
    id:'investigation',layoutOptions:{'elk.algorithm':'layered','elk.direction':direction,'elk.spacing.nodeNode':'32','elk.layered.spacing.nodeNodeBetweenLayers':'95'},
    children:nodes.map(node=>({id:node.id,width:nodeWidth,height:nodeHeight})),
    edges:edges.map(edge=>({id:edge.id,sources:[edge.source],targets:[edge.target]})),
  })
  return Object.fromEntries((graph.children??[]).map(node=>[node.id,{x:node.x??0,y:node.y??0}]))
}
