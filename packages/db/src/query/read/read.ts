import { PropDef, PropDefEdge } from '../../schema/types.js'
import { QueryDef } from '../types.js'

type Item = {
  id: number
} & { [key: string]: any }

const addField = (
  p: PropDef | PropDefEdge,
  value: any,
  item: Item,
  defaultOnly: boolean = false,
) => {
  const len = p.path.length
  if (len === 1) {
    const field = p.path[0]
    if (!defaultOnly || !(field in item)) {
      item[field] = value
    }
  } else {
    let select: any = item
    for (let i = 0; i < len; i++) {
      const field = p.path[i]
      if (i === len - 1) {
        if (!defaultOnly || !(field in select)) {
          select[field] = value
        }
      } else {
        select = select[field] ?? (select[field] = {})
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
  // 1: timestamp, 4: number
  if (prop.typeIndex === 4 || prop.typeIndex === 1) {
    addField(prop, result.readDoubleLE(index), item)
  }
  // 5: uint32
  else if (prop.typeIndex === 5) {
    addField(prop, result.readUInt32LE(index), item)
  }
  // 9: boolean
  else if (prop.typeIndex === 9) {
    addField(prop, Boolean(result[index]), item)
  }
  // 10: Enum
  else if (prop.typeIndex === 10) {
    if (result[index] === 0) {
      addField(prop, undefined, item)
    } else {
      addField(prop, prop.enum[result[index] - 1], item)
    }
  }
  // 11: string
  else if (prop.typeIndex === 11) {
    // Also remove this default then (same as other string)
    const len = result[index]
    if (len !== 0) {
      const str = result.toString('utf-8', index + 1, index + len + 1)
      addField(prop, str, item)
    } else {
      addField(prop, '', item)
    }
  }
  // 18: int8
  else if (prop.typeIndex === 18) {
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
  id: number,
): number => {
  let i = offset

  while (i < end) {
    const index = result[i]
    i++

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
        readAllFields(
          q.references.get(field),
          result,
          i,
          size + i - 5,
          refItem,
          id,
        )
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
      if (prop.typeIndex === 11) {
        q.include.propsRead[index] = id
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
    const l = readAllFields(q, result, i, end, item, id)
    i += l
    for (const k in q.include.propsRead) {
      if (q.include.propsRead[k] !== id) {
        addField(q.schema.reverseProps[k], '', item)
      }
    }
    items.push(item)
  }

  if ('id' in q.target) {
    return items[0]
  }

  return items
}
