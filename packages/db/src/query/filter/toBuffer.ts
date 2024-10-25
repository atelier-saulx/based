import { QueryDefFilter } from '../types.js'

export const fillConditionsBuffer = (
  result: Buffer,
  conditions: QueryDefFilter,
  offset: number,
) => {
  let lastWritten = offset
  conditions.conditions.forEach((v, k) => {
    result[lastWritten] = k
    let sizeIndex = lastWritten + 1
    lastWritten += 3
    let conditionSize = 0
    for (const condition of v) {
      conditionSize += condition.byteLength
      result.set(condition, lastWritten)
      lastWritten += condition.byteLength
    }
    result.writeInt16LE(conditionSize, sizeIndex)
  })
  if (conditions.references) {
    for (const [refField, refConditions] of conditions.references) {
      result[lastWritten] = 254
      const sizeIndex = lastWritten + 1
      result[lastWritten + 3] = refField
      lastWritten += 4
      result[lastWritten] = refConditions.schema.idUint8[0]
      lastWritten += 1
      result[lastWritten] = refConditions.schema.idUint8[1]
      lastWritten += 1
      const size = fillConditionsBuffer(result, refConditions, lastWritten)
      result.writeUint16LE(size + 4, sizeIndex)
      lastWritten += size
    }
  }
  conditions.edges.forEach((v, k) => {
    result[lastWritten] = 252
    let sizeIndex = lastWritten + 1
    lastWritten += 3
    result[lastWritten] = k
    lastWritten++

    let conditionSize = 0
    for (const condition of v) {
      conditionSize += condition.byteLength
      result.set(condition, lastWritten)
      lastWritten += condition.byteLength
    }
    result.writeInt16LE(conditionSize, sizeIndex)
  })
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
