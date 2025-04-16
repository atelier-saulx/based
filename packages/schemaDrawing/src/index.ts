import { Schema } from '@based/schema'
import { Ctx } from './ctx.js'

export const createSchemaDiagram = (schema: Schema, element: Element) => {
  const ctx = new Ctx(schema, element)
  ctx.render()
  return ctx
}

export * from './mermaid.js'
