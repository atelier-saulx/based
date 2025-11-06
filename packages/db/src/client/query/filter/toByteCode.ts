import { writeUint16, writeUint32 } from '@based/utils'
import { QueryDefFilter, FilterCondition } from '../types.js'
import {
  META_EDGE,
  META_EXISTS,
  META_OR_BRANCH,
  META_REFERENCE,
  TYPE_DEFAULT,
  TYPE_NEGATE,
} from './types.js'

const writeConditions = (
  result: Uint8Array,
  k: number,
  offset: number,
  conditions: FilterCondition[],
  metaOffset: number,
) => {
  let lastWritten = offset
  result[lastWritten] = k
  lastWritten++
  const sizeIndex = lastWritten
  lastWritten += 2
  let conditionSize = 0
  for (const condition of conditions) {
    conditionSize += condition.buffer.byteLength
    result.set(condition.buffer, lastWritten)
    if ('subscriptionMeta' in condition) {
      if ('now' in condition.subscriptionMeta) {
        for (const n of condition.subscriptionMeta.now) {
          n.resolvedByteIndex = n.byteIndex + lastWritten + metaOffset
        }
      }
    }
    lastWritten += condition.buffer.byteLength
  }
  writeUint16(result, conditionSize, sizeIndex)
  return lastWritten - offset
}

export const fillConditionsBuffer = (
  result: Uint8Array,
  conditions: QueryDefFilter,
  offset: number,
  metaOffset: number,
) => {
  let lastWritten = offset
  let orJumpIndex = 0

  if (conditions.or && conditions.or.size != 0) {
    result[lastWritten] = META_OR_BRANCH
    lastWritten++
    orJumpIndex = lastWritten
    lastWritten += 2
    lastWritten += 4
  }

  conditions.conditions.forEach((v, k) => {
    lastWritten += writeConditions(result, k, lastWritten, v, metaOffset)
  })

  if (conditions.references) {
    for (const [refField, refConditions] of conditions.references) {
      result[lastWritten] = META_REFERENCE
      lastWritten++
      result[lastWritten] = refField
      lastWritten++
      writeUint16(result, refConditions.schema.id, lastWritten)
      lastWritten += 2
      const sizeIndex = lastWritten
      lastWritten += 2
      const size = fillConditionsBuffer(
        result,
        refConditions,
        lastWritten,
        metaOffset,
      )
      writeUint16(result, size, sizeIndex)
      lastWritten += size
    }
  }

  if (conditions.edges) {
    conditions.edges.forEach((v, k) => {
      result[lastWritten] = META_EDGE
      lastWritten++
      let sizeIndex = lastWritten
      lastWritten += 2
      const size = writeConditions(result, k, lastWritten, v, metaOffset)
      lastWritten += size
      writeUint16(result, size, sizeIndex)
    })
  }

  if (conditions.or && conditions.or.size != 0) {
    const size = fillConditionsBuffer(
      result,
      conditions.or,
      lastWritten,
      metaOffset,
    )
    writeUint16(result, size, orJumpIndex)
    writeUint32(result, lastWritten, orJumpIndex + 2)
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

export const isSimpleMainFilter = (conditions: QueryDefFilter) => {
  if (
    !conditions.references &&
    !conditions.edges &&
    conditions.conditions.size === 1 &&
    conditions.conditions.has(0) &&
    !conditions.or &&
    !conditions.exists
  ) {
    return true
  }
  return false
}

export const filterToBuffer = (
  conditions: QueryDefFilter,
  metaOffset: number,
): Uint8Array => {
  // add extra byte IS SINGLE CONDITION
  let result: Uint8Array
  if (conditions.size > 0) {
    result = new Uint8Array(conditions.size)
    fillConditionsBuffer(result, conditions, 0, metaOffset)
  } else {
    result = new Uint8Array(0)
  }
  return result
}

export const resolveMetaIndexes = (
  defFilter: QueryDefFilter,
  offset: number,
) => {
  if (!defFilter.hasSubMeta) {
    return
  }

  for (const conditions of defFilter.conditions.values()) {
    for (const condition of conditions) {
      if (condition.subscriptionMeta) {
        if (condition.subscriptionMeta.now) {
          for (const now of condition.subscriptionMeta.now) {
            now.resolvedByteIndex += offset
          }
        }
      }
    }
  }

  if (defFilter.and) {
    resolveMetaIndexes(defFilter.and, offset)
  }

  if (defFilter.or) {
    resolveMetaIndexes(defFilter.or, offset)
  }

  if (defFilter.references) {
    for (const ref of defFilter.references.values()) {
      resolveMetaIndexes(ref, offset)
    }
  }
}
