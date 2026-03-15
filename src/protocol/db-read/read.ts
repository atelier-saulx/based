import { combineToNumber, readFloatLE, readUint32 } from '../../utils/index.js'
import {
  AggItem,
  Item,
  Meta,
  ReadMeta,
  ReadSchema,
  ReadSchemaEnum,
  ReadInstruction,
} from './types.js'
import { readAggregate } from './aggregate.js'
import { addMetaProp, addProp } from './addProps.js'
import { readProp } from './prop.js'
import { readMain } from './main.js'
import { undefinedProps } from './undefined.js'
import {
  IncludeResponseMeta,
  IncludeResponseMetaByteSize,
  PropType,
  readIncludeResponseMeta,
  ReadOp,
} from '../../zigTsExports.js'
import { readMeta } from './meta.js'

export * from './types.js'
export * from './string.js'
export * from './schema/deserialize.js'

const aggregation: ReadInstruction = (q, result, i, item) => {
  let field = result[i]
  i++
  const size = readUint32(result, i)
  i += 4
  const ref = q.refs[field]
  const def = ref.prop
  addProp(def, readAggregate(ref.schema, result, i, i + size), item)
  i += size
  return i
}

const reference: ReadInstruction = (q, result, i, item) => {
  const field = result[i]
  i++
  const ref = q.refs[field]
  const size = readUint32(result, i)
  i += 4
  if (size === 0) {
    addProp(ref.prop, null, item)
    i += size
  } else {
    const id = readUint32(result, i)
    i += 4
    const refItem: Item = { id }
    readProps(ref.schema, result, i, size + i - 4, refItem)
    addProp(ref.prop, refItem, item)
    i += size - 4
  }
  return i
}

const references: ReadInstruction = (q, result, i, item) => {
  const field = result[i]
  i++
  const ref = q.refs[field]
  const size = readUint32(result, i)
  i += 4
  const refs = resultToObject(ref.schema, result, size + i, i)
  addProp(ref.prop, refs, item)
  i += size
  return i
}

const edge: ReadInstruction = (q, result, i, item) => {
  const size = readUint32(result, i)
  i += 4
  return readProps(q.edges!, result, i, i + size, item)
}

const readInstruction = (
  instruction: number,
  q: ReadSchema,
  result: Uint8Array,
  i: number,
  item: Item,
): number => {
  if (instruction === ReadOp.meta) {
    return readMeta(q, result, i, item)
  } else if (instruction === ReadOp.aggregation) {
    return aggregation(q, result, i, item)
  } else if (instruction === ReadOp.reference) {
    return reference(q, result, i, item)
  } else if (instruction === ReadOp.references) {
    return references(q, result, i, item)
  } else if (instruction === ReadOp.edge) {
    return edge(q, result, i, item)
  } else if (instruction === 0) {
    return readMain(q, result, i, item)
  } else {
    return readProp(instruction, q, result, i, item)
  }
}

export const readProps = (
  q: ReadSchema,
  result: Uint8Array,
  offset: number,
  end: number,
  item: Item,
) => {
  q.readId ^= 1
  let i = offset
  while (i < end) {
    const instruction = result[i]
    i++
    if (instruction === ReadOp.id) {
      undefinedProps(q, item)
      // Next node
      return i - offset
    }
    i = readInstruction(instruction, q, result, i, item)
  }
  // For the last id
  undefinedProps(q, item)
  return i
}

export const resultToObject = (
  q: ReadSchema,
  result: Uint8Array,
  end: number,
  offset: number = 0,
  items: AggItem | [Item] = [],
) => {
  if (q.aggregate) {
    return readAggregate(q, result, 0, result.byteLength - 4)
  }

  const len = readUint32(result, offset)

  if (len === 0) {
    if (q.type === ReadSchemaEnum.single) {
      return null
    }
    return items
  }

  let i = 5 + offset

  const readHook = q.hook
  while (i < end) {
    const id = readUint32(result, i)
    i += 4

    let item: Item = { id }

    if (q.search) {
      item.$searchScore = readFloatLE(result, i)
      i += 4
    }
    const l = readProps(q, result, i, end, item) ?? 0

    i += l

    if (readHook) {
      const res = readHook(item)
      if (res === null) {
        continue
      }
      items.push(res || item)
    } else {
      items.push(item)
    }
  }

  if (q.type === ReadSchemaEnum.single) {
    return items[0]
  }

  return items
}

export const readId = (
  q: ReadSchema,
  result: Uint8Array,
  offset: number = 0,
) => {
  if (q.type === ReadSchemaEnum.single && !q.aggregate) {
    let i = 5 + offset
    return readUint32(result, i)
  }
  return undefined
}

export const readChecksum = (result: Uint8Array) => {
  const len = result.byteLength
  return readUint32(result, len - 4)
}

export const readVersion = (result: Uint8Array) => {
  const len = result.byteLength
  return combineToNumber(readUint32(result, len - 4), len)
}
