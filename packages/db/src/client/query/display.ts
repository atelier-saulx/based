import picocolors from 'picocolors'
import { QueryDef } from './types.js'
import { BasedQueryResponse } from './BasedQueryResponse.js'
import { ENCODER } from '@based/utils'
import { PropType, type PropTypeEnum } from '../../zigTsExports.js'
import type { PropDef, PropDefEdge } from '@based/schema'

const decimals = (v: number) => ~~(v * 100) / 100

const sizeCalc = (size: number) => {
  if (size > 1e6) {
    return `${decimals(size / 1e6)} mb`
  }
  if (size > 1e3) {
    return `${decimals(size / 1e3)} kb`
  }
  return `${size} bytes`
}

export const size = (size: number) => {
  const str = sizeCalc(size)
  if (size > 1e3 * 1e3 * 25) {
    return picocolors.red(str)
  } else {
    return picocolors.green(str)
  }
}

const timeCalc = (time: number) => {
  if (time > 1e3) {
    return `${decimals(time / 1e3)} s`
  }
  return `${decimals(time)} ms`
}

export const time = (time: number) => {
  const str = timeCalc(time)
  if (time > 1e3) {
    return picocolors.red(str)
  } else {
    return picocolors.green(str)
  }
}

export const printNumber = (nr: number) => {
  if (nr > 1000) {
    return picocolors.blue(nr.toLocaleString())
  }
  return picocolors.blue(nr)
}

export const prettyPrintVal = (v: any, type: PropTypeEnum): string => {
  if (type === PropType.binary) {
    const nr = 12
    const isLarger = v.length > nr
    // RFE Doesn't slice make a new alloc? subarray would be probably sufficient here.
    const x = [...v.slice(0, nr)].map((v) => {
      return `${v}`.padStart(3, '0') + ' '
    })
    return (
      picocolors.blue(x.join('')) +
      (isLarger ? picocolors.dim('... ') : '') +
      picocolors.italic(
        picocolors.dim(`${~~((v.byteLength / 1e3) * 100) / 100}kb`),
      )
    )
  }

  if (
    type === PropType.string ||
    type === PropType.text ||
    type === PropType.alias
  ) {
    if (v.length > 50) {
      const byteLength = ENCODER.encode(v).byteLength
      const chars = picocolors.italic(
        picocolors.dim(`${~~((byteLength / 1e3) * 100) / 100}kb`),
      )
      v =
        v.slice(0, 50).replace(/\n/g, '\\n ') +
        picocolors.dim('...') +
        '" ' +
        chars
    }

    if (type === PropType.alias) {
      return `"${v}" ${picocolors.italic(picocolors.dim('alias'))}`
    }

    return `"${v}"`
  }

  if (type === PropType.cardinality) {
    return `${picocolors.blue(v)} ${picocolors.italic(picocolors.dim('unique'))}`
  }

  if (type === PropType.timestamp) {
    if (v === 0) {
      return `0 ${picocolors.italic(picocolors.dim('No date'))}`
    } else {
      return `${v} ${picocolors.italic(picocolors.dim(new Date(v).toString().replace(/\(.+\)/, '')))}`
    }
  }

  return v
}

export const parseUint8Array = (p: any) => {
  if (ArrayBuffer.isView(p)) {
    const x: any[] = []
    // @ts-ignore
    for (let i = 0; i < p.length; i++) {
      x[i] = p[i]
    }
    p = x
    return p
  }
  return p
}

export const safeStringify = (p: any, nr = 30) => {
  var v: string
  try {
    p = parseUint8Array(p)
    if (typeof p === 'object') {
      for (const key in p) {
        p[key] = parseUint8Array(p[key])
      }
    }
    v = JSON.stringify(p).replace(/"/g, '').slice(0, nr)
    if (v.length === nr) {
      v += '...'
    }
  } catch (err) {
    v = ''
  }
  return v
}

const inspectObject = (
  object: any,
  q: QueryDef,
  path: string,
  level: number,
  isLast: boolean,
  isFirst: boolean,
  isObject: boolean,
  depth: number,
) => {
  const prefix = ''.padEnd(level, ' ')
  let str = ''
  if (isFirst || isObject) {
    str = '{\n'
  } else {
    str = prefix + '{\n'
  }
  const prefixBody = ''.padEnd(level + 3, ' ')
  let edges: any[] = []
  // use reader schema
  for (const k in object) {
    const key = path ? path + '.' + k : k
    let def: PropDef | PropDefEdge
    def = q.props![key]
    let v = object[k]
    let isEdge = k[0] === '$'

    if (k === '$searchScore') {
      edges.push({ k, v, def: { typeIndex: PropType.number } })
    } else if (isEdge) {
      if (q.edges?.props?.[k]) {
        edges.push({ k, v, def: q.edges?.props?.[k] })
      } else {
        str += prefixBody + `${k}: `
        isEdge = false
      }
    } else {
      str += prefixBody + `${k}: `
    }

    if (isEdge) {
      // skip
    } else if (key === 'id') {
      str +=
        picocolors.blue(v) +
        // @ts-ignore
        picocolors.italic(picocolors.dim(` ${q.target.type}`))
      str += ',\n'
    } else if (!def) {
      if (typeof v === 'number') {
        if (q.aggregate) {
          str += printNumber(v)
          str += picocolors.italic(picocolors.dim(` ${k.toLowerCase()}`))
          str += ',\n'
        } else {
          str += printNumber(v) + '\n'
        }
      } else {
        str +=
          inspectObject(v, q, key, level + 2, false, false, true, depth) + ''
      }
    } else if ('__isPropDef' in def) {
      if (def.typeIndex === PropType.references) {
        if (q.aggregate) {
          str += printNumber(v)
          str += picocolors.italic(picocolors.dim(` ${k.toLowerCase()}`))
        } else {
          str += inspectData(
            v,
            q.references.get(def.prop)!,
            level + 2,
            false,
            depth,
          )
        }
      } else if (def.typeIndex === PropType.reference) {
        if (!v || !v.id) {
          str += 'null,\n'
        } else {
          if (q.aggregate) {
            str += printNumber(v)
            str += picocolors.italic(picocolors.dim(` ${k.toLowerCase()}`))
          } else {
            str += inspectObject(
              v,
              q.references.get(def.prop)!,
              '',
              level + 2,
              false,
              false,
              true,
              depth,
            )
          }
        }
      } else if (def.typeIndex === PropType.binary) {
        if (v === undefined) {
          return ''
        }
        str += prettyPrintVal(v, def.typeIndex)
      } else if (def.typeIndex === PropType.text) {
        if (typeof v === 'object') {
          str += '{\n'
          for (const lang in v) {
            str += `${prefixBody}  ${lang}: ${prettyPrintVal(v[lang], def.typeIndex)},\n`
          }
          str += `${prefixBody}}`
        } else {
          if (v === undefined) {
            return ''
          }
          str += prettyPrintVal(v, def.typeIndex)
        }
      } else if (
        def.typeIndex === PropType.string ||
        def.typeIndex === PropType.alias
      ) {
        if (v === undefined) {
          return ''
        }
        str += prettyPrintVal(v, def.typeIndex)
      } else if (def.typeIndex === PropType.cardinality) {
        if (typeof v === 'object' && v !== null) {
          str +=
            inspectObject(v, q, key, level + 2, false, false, true, depth) + ''
        } else {
          str += prettyPrintVal(v, def.typeIndex)
        }
      } else if (def.typeIndex === PropType.timestamp) {
        str += prettyPrintVal(v, def.typeIndex)
      } else {
        if (typeof v === 'number') {
          if (q.aggregate) {
            str += printNumber(v)
            str += picocolors.italic(picocolors.dim(` ${k.toLowerCase()}`))
          } else {
            str += printNumber(v)
          }
        } else if (typeof v === 'object' && v) {
          str +=
            inspectObject(v, q, key, level + 2, false, false, true, depth) + ''
        } else {
          str += v
        }
      }
      if (
        def?.typeIndex !== PropType.reference &&
        def?.typeIndex !== PropType.references &&
        typeof v !== 'object'
      ) {
        str += ',\n'
      }
    } else {
      str += ',\n'
    }
  }

  for (const edge of edges) {
    if (edge.def.typeIndex === PropType.reference) {
      str += prefixBody + picocolors.bold(`${edge.k}: `)
      str += inspectObject(
        edge.v,
        q.edges!.references.get(edge.def.prop)!,
        '',
        level + 2,
        false,
        false,
        true,
        depth,
      )
    } else if (edge.def.typeIndex === PropType.references) {
      str += prefixBody + picocolors.bold(`${edge.k}: `)
      str +=
        inspectData(
          edge.v,
          q.edges!.references.get(edge.def.prop)!,
          level + 3,
          false,
          depth + 2,
        ) + '\n'
    } else {
      str +=
        prefixBody +
        picocolors.bold(`${edge.k}: `) +
        prettyPrintVal(edge.v, edge.def.typeIndex) +
        ',\n'
    }
  }

  if (isObject) {
    str += prefix + ' },\n'
  } else if (isLast) {
    str += prefix + '}'
  } else {
    str += prefix + '},\n'
  }
  return str
}

export const inspectData = (
  q: BasedQueryResponse,
  def: QueryDef,
  level: number,
  top: boolean,
  depth: number,
  hasId: boolean = false,
) => {
  const length = q.length
  const max = Math.min(length, depth)
  const prefix = top ? '  ' : ''
  let str: string
  let i = 0

  if (hasId || def.aggregate) {
    str = prefix
    level = level + 1
  } else if (top) {
    level = level + 3
    str = prefix + '[\n' + prefix + '  '
  } else {
    str = prefix + '['
  }

  if (def.aggregate) {
    str += inspectObject(
      'toObject' in q ? q.toObject() : q,
      def,
      '',
      level + 1,
      i === max - 1,
      i === 0,
      false,
      depth,
    )
    return str
  }

  for (const x of q) {
    str += inspectObject(
      x,
      def,
      '',
      level + 1,
      i === max - 1,
      i === 0,
      false,
      depth,
    )
    i++
    if (i >= max) {
      break
    }
  }

  if (length > max) {
    const morePrefix = ''.padStart(top ? 2 : level + 3, ' ')
    str +=
      ',\n' +
      picocolors.dim(
        picocolors.italic(
          prefix +
            morePrefix +
            `...${length - max} More item${length - max !== 1 ? 's' : ''}\n`,
        ),
      )
    if (hasId) {
      str += ''
    } else if (top) {
      str += prefix + ']'
    } else {
      str += prefix + ']'.padStart(level + 2, ' ')
    }
  } else if (hasId) {
  } else if (top) {
    str += '\n' + prefix + ']'
  } else {
    str += ']' + '\n'
  }
  return str
}

export const defHasId = (def: QueryDef) => {
  return 'id' in def.target || 'alias' in def.target
}

export const displayTarget = (def: QueryDef) => {
  // ids
  const hasId = defHasId(def)
  const hasIds = 'ids' in def.target

  const target =
    hasId || hasIds
      ? def.schema!.type +
        ':' +
        (hasIds
          ? // @ts-ignore
            `ids(${def.target?.ids?.length ?? 0})`
          : 'alias' in def.target
            ? safeStringify(def.target.alias, 30)
            : // @ts-ignore
              def.target.id)
      : def.schema!.type
  return target
}
