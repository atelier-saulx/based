import { debug } from '../debug.js'
import { QueryDefFilter } from '../types.js'

// -------------------------------------------
// and
// [meta = 255] [size 2]
// -------------------------------------------
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
// field, [size 2]
// [or = 0] [size 2] [start 2], [op] [typeIndex], value[size]
// -------------------------------------------
// conditions or fixed
// field, [size 2]
// [or = 1] [size 2] [start 2] [op] [typeIndex], [repeat 2], value[size] value[size] value[size]
// -------------------------------------------
// conditions or variable
// field, [size 2]
// [or = 2] [size 2] [start 2], [op] [typeIndex], [size 2], value[size], [size 2], value[size]
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
  // make this u32
  result.writeUint16LE(conditionSize, sizeIndex)
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
    result[lastWritten] = 253
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
      result[lastWritten] = 254
      lastWritten++
      result[lastWritten] = refField
      lastWritten++
      result.writeUint16LE(refConditions.schema.id, lastWritten)
      lastWritten += 2
      const sizeIndex = lastWritten
      lastWritten += 2
      const size = fillConditionsBuffer(result, refConditions, lastWritten)
      result.writeUint16LE(size, sizeIndex)
      lastWritten += size
    }
  }

  if (conditions.edges) {
    conditions.edges.forEach((v, k) => {
      result[lastWritten] = 252
      lastWritten++
      let sizeIndex = lastWritten
      lastWritten += 2
      const size = writeConditions(result, k, lastWritten, v)
      lastWritten += size
      result.writeUint16LE(size, sizeIndex)
    })
  }

  if (conditions.or) {
    const size = fillConditionsBuffer(result, conditions.or, lastWritten)
    result.writeUint16LE(size, orJumpIndex)
    result.writeUint32LE(lastWritten, orJumpIndex + 2)
    lastWritten += size
  }

  return lastWritten - offset
}

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
