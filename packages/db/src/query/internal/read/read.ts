import { QueryDef } from '../types.js'

type Item = {
  id: number
} & { [key: string]: any }

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
      const mainInclude = q.include.main

      // q.schema
      // make oposite map there 0 -> also

      if (mainInclude.len === q.schema.mainLen) {
        // console.log('includes all')
      } else {
        // console.log(mainInclude)

        for (const k in mainInclude.include) {
          const [index, prop] = mainInclude.include[k]

          if (prop.typeIndex === 5) {
            const value = result.readUInt32LE(i + index)
            console.log({ value })
          }
          // etc etc
        }

        i += mainInclude.len
      }
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
