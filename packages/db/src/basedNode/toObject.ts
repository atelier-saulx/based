import { FieldDef } from '../schemaTypeDef.js'
import picocolors from 'picocolors'
import { QueryIncludeDef } from '../query/types.js'

export const toObjectIncludeTree = (
  obj,
  target: any,
  arr: QueryIncludeDef['includeTree'],
) => {
  for (let i = 0; i < arr.length; i++) {
    const key = arr[i++] as string
    const item = arr[i] as FieldDef | QueryIncludeDef['includeTree']
    if ('__isField' in item) {
      const v = target[key]
      if (item.type === 'reference') {
        obj[key] = v.toObject()
      } else {
        obj[key] = v
      }
    } else {
      // refs in here
      obj[key] = toObjectIncludeTree({}, target[key], item)
    }
  }
  return obj
}

export const toObjectIncludeTreePrint = (
  str: string,
  target: any,
  arr: QueryIncludeDef['includeTree'],
  level: number = 0,
) => {
  const prefix = ''.padEnd(level * 2 + 2, ' ')
  str += '{\n'

  for (let i = 0; i < arr.length; i++) {
    const key = arr[i++] as string
    const item = arr[i] as FieldDef | QueryIncludeDef['includeTree']
    str += prefix + `${key}: `
    if ('__isField' in item) {
      let v = target[key]

      if (item.type === 'reference') {
        str += toObjectIncludeTreePrint(
          '',
          v,
          v.__r.includeTree,
          level + 1,
        ).slice(0, -1)
      } else if (item.type === 'string') {
        if (v === undefined) {
          return ''
        }
        if (v.length > 80) {
          const chars = picocolors.italic(
            picocolors.dim(
              `${~~((Buffer.byteLength(v, 'utf8') / 1e3) * 100) / 100}kb`,
            ),
          )
          v = v.slice(0, 80) + picocolors.dim('...') + '" ' + chars
          str += `"${v}`
        } else {
          str += `"${v}"`
        }
      } else if (item.type === 'timestamp') {
        str += `${v} ${picocolors.italic(picocolors.dim(new Date(v).toString().replace(/\(.+\)/, '')))}`
      } else {
        str += v
      }
      str += '\n'
    } else {
      str += toObjectIncludeTreePrint('', target[key], item, level + 1)
    }
  }

  str += '}\n'.padStart(level * 2 + 2, ' ')
  return str
}
