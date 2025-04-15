import { createSchemaDiagram } from '../src/index.js'
import escSchema from './schema/based.schema.js'
// @ts-ignore

// document.body
createSchemaDiagram(escSchema, document.body)
