import picocolors from 'picocolors'
import { QueryDef } from './types.js'
import {
  BINARY,
  CARDINALITY,
  NUMBER,
  PropDef,
  PropDefEdge,
  REFERENCE,
  REFERENCES,
  STRING,
  TEXT,
  TIMESTAMP,
  TypeIndex,
} from '@based/schema/def'
import { BasedQueryResponse } from './BasedIterable.js'
import { ENCODER } from '@saulx/utils'
import { AggregateType } from './aggregates/types.js'

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

export const prettyPrintVal = (v: any, type: TypeIndex): string => {
  if (type === BINARY) {
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

  if (type === STRING || type === TEXT) {
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
      return `"${v}`
    } else {
      return `"${v}"`
    }
  }

  if (type === CARDINALITY) {
    return `${picocolors.blue(v)} ${picocolors.italic(picocolors.dim('unique'))}`
  }

  if (type === TIMESTAMP) {
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
    const x = []
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
  let edges = []
  for (const k in object) {
    const key = path ? path + '.' + k : k
    let def: PropDef | PropDefEdge
    def = q.props[key]
    let v = object[k]
    let isEdge = k[0] === '$'

    if (k === '$searchScore') {
      edges.push({ k, v, def: { typeIndex: NUMBER } })
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
          // TBD: replace comptime const enum and reverse map it
          const [[__, akv], _] = q.aggregate.aggregates
          const aggType = akv[0].type
          str += picocolors.italic(
            picocolors.dim(` ${AggregateType[aggType].toLowerCase()}`),
          )
          str += ',\n'
        } else {
          str += printNumber(v) + '\n'
        }
      } else {
        str +=
          inspectObject(v, q, key, level + 2, false, false, true, depth) + ''
      }
    } else if ('__isPropDef' in def) {
      if (def.typeIndex === REFERENCES) {
        str += inspectData(
          v,
          q.references.get(def.prop),
          level + 2,
          false,
          depth,
        )
      } else if (def.typeIndex === REFERENCE) {
        if (!v || !v.id) {
          str += 'null,\n'
        } else {
          str += inspectObject(
            v,
            q.references.get(def.prop),
            '',
            level + 2,
            false,
            false,
            true,
            depth,
          )
        }
      } else if (def.typeIndex === BINARY) {
        if (v === undefined) {
          return ''
        }
        str += prettyPrintVal(v, def.typeIndex)
      } else if (def.typeIndex === TEXT) {
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
      } else if (def.typeIndex === STRING) {
        if (v === undefined) {
          return ''
        }
        str += prettyPrintVal(v, def.typeIndex)
      } else if (def.typeIndex === CARDINALITY) {
        str += prettyPrintVal(v, def.typeIndex)
      } else if (def.typeIndex === TIMESTAMP) {
        str += prettyPrintVal(v, def.typeIndex)
      } else {
        if (typeof v === 'number') {
          if (q.aggregate) {
            str += printNumber(v)
            const [[__, akv], _] = q.aggregate.aggregates
            const aggType = akv[0].type
            str += picocolors.italic(
              picocolors.dim(` ${AggregateType[aggType].toLowerCase()}`),
            )
          } else {
            str += printNumber(v)
          }
        } else if (typeof v === 'object' && v) {
          inspectObject(v, q, key, level + 2, false, false, true, depth) + ''
        } else {
          str += v
        }
      }
      if (def?.typeIndex !== REFERENCE) {
        str += ',\n'
      }
    } else {
      str += ',\n'
    }
  }

  for (const edge of edges) {
    if (edge.def.typeIndex === REFERENCE) {
      str += prefixBody + picocolors.bold(`${edge.k}: `)
      str += inspectObject(
        edge.v,
        q.edges.references.get(edge.def.prop),
        '',
        level + 2,
        false,
        false,
        true,
        depth,
      )
    } else if (edge.def.typeIndex === REFERENCES) {
      str += prefixBody + picocolors.bold(`${edge.k}: `)
      str +=
        inspectData(
          edge.v,
          q.edges.references.get(edge.def.prop),
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
    str += ']'
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
      ? def.schema.type +
        ':' +
        (hasIds
          ? // @ts-ignore
            `ids(${def.target?.ids?.length ?? 0})`
          : 'alias' in def.target
            ? safeStringify(def.target.alias, 30)
            : // @ts-ignore
              def.target.id)
      : def.schema.type
  return target
}
