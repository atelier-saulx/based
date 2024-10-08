import { PropDef, PropDefEdge } from '../../../schema/types.js'
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
  item: Item,
): number => {
  let i = offset
  while (i < result.byteLength) {
    const index = result[i]
    i++
    if (index === 255) {
      return i - offset
    }
    if (index === 0) {
      i += readMain(q, result, i, item)
    } else {
      const prop = q.schema.reverseProps[index]
      if (prop.typeIndex === 11) {
        // string
        const size = result.readUint32LE(i)
        if (size === 0) {
          addField(prop, '', item)
        } else {
          addField(prop, result.toString('utf8', i + 4, size + i + 4), item)
        }
        i += size + 4
      }
      // reverse fields index
      // if (q.schema.)
    }
  }
  return i - offset
}

export const resultToObject = (q: QueryDef, result: Buffer) => {
  const len = result.readUint32LE(0)
  if (len === 0) {
    return []
  }
  const items = []
  let i = 5
  while (i < result.byteLength) {
    let id = result.readUInt32LE(i)
    i += 4
    const item: Item = {
      id,
    }
    const l = readAllFields(q, result, i, item)
    i += l
    items.push(item)
  }
  return items
}
