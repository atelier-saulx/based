import { SchemaTypeDef, STRING, ALIAS, CARDINALITY } from './types.js'

export function makeSeparateSort(result: Partial<SchemaTypeDef>) {
  result.hasSeperateSort = true
  let max = 0
  for (const f of result.separate) {
    if (
      f.typeIndex === STRING ||
      f.typeIndex === ALIAS ||
      f.typeIndex === CARDINALITY
    ) {
      if (f.prop > max) {
        max = f.prop
      }
    }
  }

  result.seperateSort.buffer = new Uint8Array(max + 1)
  for (const f of result.separate) {
    if (
      f.typeIndex === STRING ||
      f.typeIndex === ALIAS ||
      f.typeIndex === CARDINALITY
    ) {
      result.seperateSort.buffer[f.prop] = 1
      result.seperateSort.props.push(f)
      result.seperateSort.size++
    }
  }
  result.seperateSort.bufferTmp = new Uint8Array(max + 1)
  result.seperateSort.buffer.set(result.seperateSort.bufferTmp)
}
