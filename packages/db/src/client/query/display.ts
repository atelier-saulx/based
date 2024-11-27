import picocolors from 'picocolors'
import { QueryDef } from './types.js'
import {
  BINARY,
  PropDef,
  PropDefEdge,
  STRING,
  TIMESTAMP,
  TypeIndex,
} from '../../server/schema/types.js'
import { BasedQueryResponse } from './BasedIterable.js'

const decimals = (v) => ~~(v * 100) / 100

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

const prettyPrintVal = (v: any, type: TypeIndex): string => {
  if (type === BINARY) {
    const nr = 12
    const isLarger = v.length > nr
    // const arr = isLarger ? [...v.slice(0, nr)] : [...v]
    const x = [...v.slice(0, nr)].map((v) => {
      return `${v}`.padStart(3, '0') + ' '
    })
    return (
      picocolors.blue(x.join('')) +
      (isLarger ? picocolors.dim('... ') : '') +
      picocolors.italic(
        picocolors.dim(
          `${~~((Buffer.byteLength(v, 'utf8') / 1e3) * 100) / 100}kb`,
        ),
      )
    )
  }

  if (type === STRING) {
    if (v.length > 40) {
      const chars = picocolors.italic(
        picocolors.dim(
          `${~~((Buffer.byteLength(v, 'utf8') / 1e3) * 100) / 100}kb`,
        ),
      )
      v =
        v.slice(0, 40).replace(/\n/g, '\\n ') +
        picocolors.dim('...') +
        '" ' +
        chars
      return `"${v}`
    } else {
      return `"${v}"`
    }
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
    let def: PropDef | PropDefEdge = q.props[key]
    let v = object[k]
    const isEdge = k[0] === '$'

    if (isEdge) {
      edges.push({ k, v, def: q.edges?.props?.[k] })
    } else {
      str += prefixBody + `${k}: `
    }

    if (isEdge) {
      // str += `${v}`
      // str += ',\n'
    } else if (key === 'id') {
      // @ts-ignore
      str += v + picocolors.italic(picocolors.dim(` ${q.target.type}`))

      // str += picocolors.blue(`${v}`) + picocolors.dim(` ${q.target.type}`)
      str += ',\n'
    } else if (!def) {
      str += inspectObject(v, q, key, level + 2, false, false, true, depth) + ''
    } else if ('__isPropDef' in def) {
      if (def.typeIndex === 14) {
        str += inspectData(
          v,
          q.references.get(def.prop),
          level + 2,
          false,
          depth,
        )
      } else if (def.typeIndex === 13) {
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
      } else if (def.typeIndex === STRING) {
        if (v === undefined) {
          return ''
        }
        str += prettyPrintVal(v, def.typeIndex)
      } else if (def.typeIndex === TIMESTAMP) {
        str += prettyPrintVal(v, def.typeIndex)
      } else {
        if (typeof v === 'number') {
          str += picocolors.blue(v)
        } else {
          str += v
        }
      }
      if (def?.typeIndex !== 13) {
        str += ',\n'
      }
    } else {
      str += ',\n'
    }
  }

  for (const edge of edges) {
    str +=
      prefixBody +
      picocolors.bold(`${edge.k}: `) +
      prettyPrintVal(edge.v, edge.def.typeIndex) +
      ',\n'
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
  if (hasId) {
    str = prefix
    level = level + 1
  } else if (top) {
    level = level + 3
    str = prefix + '[\n' + prefix + '  '
  } else {
    str = prefix + '['
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
