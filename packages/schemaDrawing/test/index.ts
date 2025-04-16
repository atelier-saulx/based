import { createSchemaDiagram } from '../src/index.js'
import escSchema from './schema/based.schema.js'
// @ts-ignore

// document.body
const ctx = createSchemaDiagram(escSchema, document.getElementById('blurf'))

document.getElementById('download').onclick = () => {
  ctx.downloadPng()
}

document.getElementById('noOverlap').onclick = () => {
  ctx.noOverlap = !ctx.noOverlap
  ctx.render()
}

document.getElementById('grid').onclick = () => {
  ctx.toggleGrid()
}

document.getElementById('filter').oninput = (e) => {
  // @ts-ignore
  ctx.filter(e.target.value)
}

document.getElementById('clear').onclick = () => {
  ctx.clearFilter()
}
