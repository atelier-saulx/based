import { PropDef } from '../schema/schema.js'
import picocolors from 'picocolors'
import { QueryIncludeDef } from '../query/types.js'
import { BasedQueryResponse, inspectData } from '../query/BasedQueryResponse.js'

export const toObjectIncludeTree = (
  obj,
  target: any,
  arr: QueryIncludeDef['includeTree'],
  fromObject?: boolean,
) => {
  if (fromObject && !target.id) {
    return null
  }

  for (let i = 0; i < arr.length; i++) {
    const key = arr[i++] as string
    const item = arr[i] as PropDef | QueryIncludeDef['includeTree']
    if ('__isPropDef' in item) {
      const v = target[key]
      // 14: References
      if (item.typeIndex === 14) {
        if (v instanceof BasedQueryResponse) {
          obj[key] = v.toObject()
        } else {
          obj[key] = []
        }
        // 13: Reference
      } else if (item.typeIndex === 13) {
        obj[key] = toObjectIncludeTree({}, v, v.__r.includeTree, true)
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
    const item = arr[i] as PropDef | QueryIncludeDef['includeTree']
    str += prefix + `${key}: `
    if ('__isPropDef' in item) {
      let v = target[key]

      // 14: References
      if (item.typeIndex === 14) {
        if (v instanceof BasedQueryResponse) {
          str += inspectData(v, true)
        }

        // 13: Reference
      } else if (item.typeIndex === 13) {
        if (!v) {
          console.warn('no ref', item, key, target, v)
        }
        if (!v.id) {
          str += 'null'
        } else {
          str += toObjectIncludeTreePrint(
            '',
            v,
            v.__r.includeTree,
            level + 1,
          ).slice(0, -1)
        }
      } else if (item.typeIndex === 11) {
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
      } else if (item.typeIndex === 1) {
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
