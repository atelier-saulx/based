import { PropDef, PropDefEdge } from '../../schema/types.js'
import { debug } from '../debug.js'
import { QueryDef } from '../types.js'

type Item = {
  id: number
} & { [key: string]: any }

const addField = (p: PropDef | PropDefEdge, value: any, item: Item) => {
  const len = p.path.length
  if (len === 1) {
    item[p.path[0]] = value
  } else {
    let select: any = item
    for (let i = 0; i < len; i++) {
      const field = p.path[i]
      if (i === len - 1) {
        select[field] = value
      } else {
        select = select[field] = {}
      }
    }
  }
}

const readMainValue = (
  prop: PropDef | PropDefEdge,
  result: Buffer,
  index: number,
  item: Item,
) => {
  if (prop.typeIndex === 5) {
    addField(prop, result.readUInt32LE(index), item)
  } else if (prop.typeIndex === 9) {
    addField(prop, !!result[index], item)
  } else if (prop.typeIndex === 10) {
    if (result[index] === 0) {
      addField(prop, undefined, item)
    } else {
      addField(prop, prop.enum[result[index] - 1], item)
    }
  } else if (prop.typeIndex === 11) {
    const len = result[index]
    let str = ''
    if (len !== 0) {
      str = result.toString('utf-8', index + 1, index + len + 1)
    }
    addField(prop, str, item)
    // 18: int8
  } else if (prop.typeIndex === 18) {
    addField(prop, result.readInt8(index), item)
  }
  // 19: uint8
  else if (prop.typeIndex === 19) {
    addField(prop, result.readUint8(index), item)
  }
  // 20: int16
  else if (prop.typeIndex === 20) {
    addField(prop, result.readInt16LE(index), item)
  }
  // 21: uint16
  else if (prop.typeIndex === 21) {
    addField(prop, result.readUint16LE(index), item)
  }
  // 22: int32
  else if (prop.typeIndex === 22) {
    addField(prop, result.readInt32LE(index), item)
  }
  // 5: uint32
  else if (prop.typeIndex === 5) {
    addField(prop, result.readUint32LE(index), item)
  }
}

const readMain = (q: QueryDef, result: Buffer, offset: number, item: Item) => {
  const mainInclude = q.include.main
  let i = offset
  if (mainInclude.len === q.schema.mainLen) {
    for (const start in q.schema.main) {
      readMainValue(q.schema.main[start], result, Number(start) + i, item)
    }
    i += q.schema.mainLen
  } else {
    for (const k in mainInclude.include) {
      const [index, prop] = mainInclude.include[k]
      readMainValue(prop, result, index + i, item)
    }
    i += mainInclude.len
  }
  return i - offset
}

const readAllFields = (
  q: QueryDef,
  result: Buffer,
  offset: number,
  end: number,
  item: Item,
): number => {
  let i = offset

  while (i < end) {
    const index = result[i]
    i++

    console.log('GET INDEX', { index })

    if (index === 255) {
      return i - offset
    }

    if (index === 254) {
      const field = result[i]
      i++
      const size = result.readUint32LE(i)
      i += 4
      const ref = q.references.get(field)
      if (size === 0) {
        // @ts-ignore
        addField(ref.target.propDef, null, item)
        i += size
      } else {
        i++
        let id = result.readUInt32LE(i)
        i += 4
        const refItem: Item = {
          id,
        }
        readAllFields(q.references.get(field), result, i, size + i - 5, refItem)
        // @ts-ignore
        addField(ref.target.propDef, refItem, item)
        i += size - 5
      }
    } else if (index === 253) {
      const field = result[i]
      i++
      const ref = q.references.get(field)
      const size = result.readUint32LE(i)
      i += 4
      const refs = resultToObject(ref, result, size + i + 4, i)
      // @ts-ignore
      addField(ref.target.propDef, refs, item)
      i += size + 4
    } else if (index === 0) {
      i += readMain(q, result, i, item)
    } else {
      const prop = q.schema.reverseProps[index]
      debug(q)
      console.log('GET THIS', index, prop)

      if (prop.typeIndex === 11) {
        const size = result.readUint32LE(i)
        if (size === 0) {
          addField(prop, '', item)
        } else {
          addField(prop, result.toString('utf8', i + 4, size + i + 4), item)
        }
        i += size + 4
      }
    }
  }

  return i - offset
}

export const resultToObject = (
  q: QueryDef,
  result: Buffer,
  end: number = result.byteLength,
  offset: number = 0,
) => {
  const len = result.readUint32LE(offset)
  if (len === 0) {
    return []
  }
  const items = []
  let i = 5 + offset
  while (i < end) {
    let id = result.readUInt32LE(i)
    i += 4
    const item: Item = {
      id,
    }
    const l = readAllFields(q, result, i, end, item)
    i += l
    items.push(item)
  }
  return items
}
