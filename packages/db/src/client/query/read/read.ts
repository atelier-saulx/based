import { readFloatLE, readUint32 } from '@based/utils/dist/src/uint8.js'
import { AggItem, Item } from './types.js'
import { readAggregate } from './aggregate.js'
import {
  QueryDef,
  QueryDefRest,
  QueryDefType,
  READ_AGGREGATION,
  READ_META,
  READ_REFERENCE,
  READ_REFERENCES,
  READ_EDGE,
} from '../types.js'
import { READ_ID } from '../types.js'
import { undefinedProps } from './undefinedProps.js'
import { readMetaSeperate } from './meta.js'
import { addProp } from './addProps.js'
import { readProp } from './prop.js'
import { readMain } from './main.js'
export * from './types.js'

type ReadInstruction = (
  q: QueryDef,
  result: Uint8Array,
  i: number,
  item: Item,
) => number

const meta: ReadInstruction = (q, result, i, item) => {
  const field = result[i]
  i++
  const prop = q.schema.reverseProps[field]
  addProp(q, prop, readMetaSeperate(result, i), item)
  i += 9
  return i
}

const aggregation: ReadInstruction = (q, result, i, item) => {
  let field = result[i]
  i++
  const size = readUint32(result, i)
  i += 4
  const ref = q.references.get(field) as QueryDefRest
  const def = ref.target.propDef
  addProp(q, def, readAggregate(ref, result, i, i + size), item)
  i += size
  return i
}

const reference: ReadInstruction = (q, result, i, item) => {
  const field = result[i]
  i++
  const size = readUint32(result, i)
  i += 4
  const ref = q.references.get(field) as QueryDefRest
  if (size === 0) {
    addProp(q, ref.target.propDef, null, item)
    i += size
  } else {
    i++
    const id = readUint32(result, i)
    i += 4
    const refItem: Item = { id }
    readProps(ref, result, i, size + i - 5, refItem, id)
    addProp(q, ref.target.propDef, refItem, item)
    i += size - 5
  }
  return i
}

const references: ReadInstruction = (q, result, i, item) => {
  const field = result[i]
  i++
  const ref = q.references.get(field) as QueryDefRest
  const size = readUint32(result, i)
  i += 4
  const refs = resultToObject(ref, result, size + i + 4, i)
  // q.include.propsRead[field] = id
  addProp(q, ref.target.propDef, refs, item)
  i += size + 4
  return i
}

const edge: ReadInstruction = (q, result, i, item) => {
  i++
  return readInstruction(result[i], q.edges, result, i, item)
}

export const readInstruction = (
  instruction: number,
  q: QueryDef,
  result: Uint8Array,
  i: number,
  item: Item,
): number => {
  if (instruction === READ_META) {
    return meta(q, result, i, item)
  } else if (instruction === READ_AGGREGATION) {
    return aggregation(q, result, i, item)
  } else if (instruction === READ_REFERENCE) {
    return reference(q, result, i, item)
  } else if (instruction === READ_REFERENCES) {
    return references(q, result, i, item)
  } else if (instruction === READ_EDGE) {
    return edge(q, result, i, item)
  } else if (instruction === 0) {
    return readMain(q, result, i, item)
  } else {
    return readProp(instruction, q, result, i, item)
  }
}

export const readProps = (
  q: QueryDef,
  result: Uint8Array,
  offset: number,
  end: number,
  item: Item,
  id: number,
) => {
  let i = offset
  while (i < end) {
    const instruction = result[i]
    i++
    if (instruction === READ_ID) {
      // Next node
      undefinedProps(id, q, item)
      return i - offset
    }
    // do want this...
    i = readInstruction(instruction, q, result, i, item)
  }
  // For the last id
  undefinedProps(id, q, item)
}

export const resultToObject = (
  q: QueryDef,
  result: Uint8Array,
  end: number,
  offset: number = 0,
) => {
  if (q.aggregate) {
    return readAggregate(q, result, 0, result.byteLength - 4)
  }
  const len = readUint32(result, offset)
  if (len === 0) {
    if ('id' in q.target || 'alias' in q.target) {
      return null
    }
    return []
  }
  let items: AggItem | [Item] = []
  let i = 5 + offset
  while (i < end) {
    const id = readUint32(result, i)
    i += 4
    let item: Item = {
      id,
    }
    if (q.search) {
      item.$searchScore = readFloatLE(result, i)
      i += 4
    }
    const l = readProps(q, result, i, end, item, id)
    i += l
    items.push(item)
  }
  if ('id' in q.target || 'alias' in q.target) {
    if (q.type === QueryDefType.Root && q.target.type === '_root') {
      delete items[0].id
    }
    return items[0]
  }
  return items
}
