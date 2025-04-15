import { createSchemaDiagram } from '../src/index.js'
import escSchema from './schema/based.schema.js'
// @ts-ignore

// document.body
const ctx = createSchemaDiagram(escSchema, document.getElementById('blurf'))

document.getElementById('download').onclick = () => {
  ctx.downloadPng()
}

document.getElementById('grid').onclick = () => {
  ctx.toggleGrid()
}
