import { QueryDefFilter } from '../types.js'
import {
  META_EDGE,
  META_EXISTS,
  META_OR_BRANCH,
  META_REFERENCE,
  TYPE_DEFAULT,
  TYPE_NEGATE,
} from './types.js'

// or
// [meta = 253]  [size 2] [next 4]
// -------------------------------------------
// edge
// [meta = 252] [size 2]
// -------------------------------------------
// ref
// [meta = 254] [field] [typeId 2] [size 2]
// -------------------------------------------
// conditions normal
// -------------------------------------------
// conditions or fixed
// -------------------------------------------
// conditions or variable
// -------------------------------------------

const writeConditions = (
  result: Buffer,
  k: number,
  offset: number,
  conditions: Buffer[],
) => {
  let lastWritten = offset
  result[lastWritten] = k
  lastWritten++
  const sizeIndex = lastWritten
  lastWritten += 2
  let conditionSize = 0
  for (const condition of conditions) {
    conditionSize += condition.byteLength
    result.set(condition, lastWritten)
    lastWritten += condition.byteLength
  }
  result[sizeIndex] = conditionSize
  result[sizeIndex + 1] = conditionSize >>> 8
  return lastWritten - offset
}

export const fillConditionsBuffer = (
  result: Buffer,
  conditions: QueryDefFilter,
  offset: number,
) => {
  let lastWritten = offset
  let orJumpIndex = 0

  if (conditions.or) {
    result[lastWritten] = META_OR_BRANCH
    lastWritten++
    orJumpIndex = lastWritten
    lastWritten += 2
    lastWritten += 4
  }

  conditions.conditions.forEach((v, k) => {
    lastWritten += writeConditions(result, k, lastWritten, v)
  })

  if (conditions.references) {
    for (const [refField, refConditions] of conditions.references) {
      result[lastWritten] = META_REFERENCE
      lastWritten++
      result[lastWritten] = refField
      lastWritten++
      result[lastWritten] = refConditions.schema.id
      result[lastWritten + 1] = refConditions.schema.id >>> 8
      lastWritten += 2
      const sizeIndex = lastWritten
      lastWritten += 2
      const size = fillConditionsBuffer(result, refConditions, lastWritten)
      result[sizeIndex] = size
      result[sizeIndex + 1] = size >>> 8
      lastWritten += size
    }
  }

  if (conditions.edges) {
    conditions.edges.forEach((v, k) => {
      result[lastWritten] = META_EDGE
      lastWritten++
      let sizeIndex = lastWritten
      lastWritten += 2
      const size = writeConditions(result, k, lastWritten, v)
      lastWritten += size
      result[sizeIndex] = size
      result[sizeIndex + 1] = size >>> 8
    })
  }

  if (conditions.or) {
    const size = fillConditionsBuffer(result, conditions.or, lastWritten)
    result[orJumpIndex] = size
    result[orJumpIndex + 1] = size >>> 8
    result[orJumpIndex + 2] = lastWritten
    result[orJumpIndex + 3] = lastWritten >>> 8
    result[orJumpIndex + 4] = lastWritten >>> 16
    result[orJumpIndex + 5] = lastWritten >>> 24
    lastWritten += size
  }

  if (conditions.exists) {
    for (const exists of conditions.exists) {
      result[lastWritten] = META_EXISTS
      lastWritten++
      result[lastWritten] = exists.prop.prop
      lastWritten++
      result[lastWritten] = exists.negate ? TYPE_NEGATE : TYPE_DEFAULT
      lastWritten++
      result[lastWritten] = exists.prop.typeIndex
      lastWritten++
    }
  }

  return lastWritten - offset
}

// TODO convert to UINT8ARRAY
export const filterToBuffer = (conditions: QueryDefFilter) => {
  let result: Buffer
  if (conditions.size > 0) {
    result = Buffer.allocUnsafe(conditions.size)
    fillConditionsBuffer(result, conditions, 0)
  } else {
    result = Buffer.alloc(0)
  }
  return result
}
