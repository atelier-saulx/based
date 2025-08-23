import { readFloatLE, readUint32 } from '@based/utils/dist/src/uint8.js'
import {
  AggItem,
  Item,
  ReaderSchema,
  ReaderSchemaEnum,
  ReadInstruction,
} from './types.js'
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
import { readMetaSeperate } from './meta.js'
import { addProp } from './addProps.js'
import { readProp } from './prop.js'
import { readMain } from './main.js'
// import { undefinedProps } from './undefined.js'
export * from './types.js'

const meta: ReadInstruction = (id, q, result, i, item) => {
  const field = result[i]
  i++
  const prop = q.props[field]
  // maybe do this a bit smooter - like this it the meta
  addProp(prop, readMetaSeperate(result, i), item)
  i += 9
  return i
}

// const aggregation: ReadInstruction = (id, q, result, i, item) => {
//   let field = result[i]
//   i++
//   const size = readUint32(result, i)
//   i += 4
//   const ref = q.references.get(field) as QueryDefRest
//   const def = ref.target.propDef
//   // pass id to readAgg as well
//   addProp(q, def, readAggregate(ref, result, i, i + size), item)
//   i += size
//   return i
// }

const reference: ReadInstruction = (id, q, result, i, item) => {
  const field = result[i]
  i++
  const size = readUint32(result, i)
  i += 4
  const ref = q.refs[field]
  if (size === 0) {
    addProp(ref.prop, null, item)
    i += size
  } else {
    i++
    const id = readUint32(result, i)
    i += 4
    const refItem: Item = { id }
    readProps(ref.schema, result, i, size + i - 5, refItem, id)
    addProp(ref.prop, refItem, item)
    i += size - 5
  }
  return i
}

const references: ReadInstruction = (id, q, result, i, item) => {
  const field = result[i]
  i++
  const ref = q.refs[field]
  const size = readUint32(result, i)
  i += 4
  const refs = resultToObject(ref.schema, result, size + i + 4, i)
  addProp(ref.prop, refs, item)
  i += size + 4
  return i
}

const edge: ReadInstruction = (id, q, result, i, item) => {
  return readInstruction(id, result[i], q.edges, result, i + 1, item)
}

const readInstruction = (
  id: number,
  instruction: number,
  q: ReaderSchema,
  result: Uint8Array,
  i: number,
  item: Item,
): number => {
  if (instruction === READ_META) {
    return meta(id, q, result, i, item)
  } else if (instruction === READ_AGGREGATION) {
    // return aggregation(id, q, result, i, item)
  } else if (instruction === READ_REFERENCE) {
    return reference(id, q, result, i, item)
  } else if (instruction === READ_REFERENCES) {
    return references(id, q, result, i, item)
  } else if (instruction === READ_EDGE) {
    return edge(id, q, result, i, item)
  } else if (instruction === 0) {
    return readMain(q, result, i, item)
  } else {
    return readProp(id, instruction, q, result, i, item)
  }
}

export const readProps = (
  q: ReaderSchema,
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
      // undefinedProps(id, q, item)
      // Next node
      return i - offset
    }
    i = readInstruction(id, instruction, q, result, i, item)
  }
  // For the last id
  // undefinedProps(id, q, item)
}

export const resultToObject = (
  q: ReaderSchema,
  result: Uint8Array,
  end: number,
  offset: number = 0,
) => {
  // if (q.aggregate) {
  //   return readAggregate(q, result, 0, result.byteLength - 4)
  // }
  const len = readUint32(result, offset)
  if (len === 0) {
    if (q.type === ReaderSchemaEnum.single) {
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
    // if (q.search) {
    //   item.$searchScore = readFloatLE(result, i)
    //   i += 4
    // }
    const l = readProps(q, result, i, end, item, id)
    i += l
    items.push(item)
  }

  if (q.type === ReaderSchemaEnum.rootProps) {
    delete items[0].id
    return items[0]
  } else if (q.type === ReaderSchemaEnum.single) {
    return items[0]
  }

  return items
}
