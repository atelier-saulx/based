import { QueryIteratorTypeEnum, SortOrder } from '../../../zigTsExports.js'
import { QueryDef } from '../types.js'

export const getIteratorType = (
  def: QueryDef,
  hasEdges: boolean,
  hasEdgesInclude: boolean,
): QueryIteratorTypeEnum => {
  // 1. Determine the "Base" Block (Search Type)
  // Priorities: EdgeInclude > Edge > Vector > Text > Default
  const hasSearch = def.search?.size && def.search.size > 0
  const isVector = hasSearch && def.search!.isVector

  let base = 0
  if (hasEdgesInclude) {
    base = 32 // Edge Include Block
  } else if (hasEdges) {
    base = 24 // Edge Block
  } else if (isVector) {
    base = 16 // Vector Block
  } else if (hasSearch) {
    base = 8 // Text Search Block
  }

  // 2. Determine Modifiers (Bitwise offsets)
  // Bit 0 (+1): Filter
  // Bit 1 (+2): Desc
  const hasFilter = def.filter.size > 0
  const isDesc = def.sort?.order === SortOrder.desc

  let modifier = 0
  if (isDesc) modifier += 2
  if (hasFilter) modifier += 1

  return (base + modifier) as QueryIteratorTypeEnum
}
