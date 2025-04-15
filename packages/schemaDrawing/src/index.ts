import { Schema } from '@based/schema'
import { Ctx } from './ctx.js'
import { render } from './render.js'
import { positionTypes } from './positionTypes.js'

export const createSchemaDiagram = (schema: Schema, element: Element) => {
  const ctx = new Ctx(schema, element)
  positionTypes(ctx)
  render(ctx)
  return ctx
}
