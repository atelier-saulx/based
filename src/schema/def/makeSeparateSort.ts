import { PropType } from '../../zigTsExports.js'
import { SchemaTypeDef, type SchemaSortUndefinedHandler } from './types.js'

export function makeSeparateSort(result: Partial<SchemaTypeDef>) {
  result.hasSeperateSort = true
  let max = 0
  result.separate ??= []
  for (const f of result.separate) {
    if (
      f.typeIndex === PropType.string ||
      f.typeIndex === PropType.alias ||
      f.typeIndex === PropType.cardinality
    ) {
      if (f.prop > max) {
        max = f.prop
      }
    }
  }

  const separateSort = result.separateSort as SchemaSortUndefinedHandler
  separateSort.buffer = new Uint8Array(max + 1)
  for (const f of result.separate) {
    if (
      f.typeIndex === PropType.string ||
      f.typeIndex === PropType.alias ||
      f.typeIndex === PropType.cardinality
    ) {
      separateSort.buffer[f.prop] = 1
      separateSort.props.push(f)
      separateSort.size++
    }
  }
  separateSort.bufferTmp = new Uint8Array(max + 1)
  separateSort.buffer.set(separateSort.bufferTmp)
}
