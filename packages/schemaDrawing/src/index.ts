import { Schema } from '@based/schema'
import { SchemaDiagram } from './ctx.js'

export const createSchemaDiagram = (schema: Schema, element: Element) => {
  const ctx = new SchemaDiagram(schema, element)
  ctx.render()
  return ctx
}

export * from './mermaid.js'
