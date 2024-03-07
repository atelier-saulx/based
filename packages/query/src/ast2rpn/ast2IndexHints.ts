import { Fork, FilterAST } from './types.js'
import isFork from './isFork.js'

function ast2inlineRpn(types: Record<string, { prefix?: string }>, f: FilterAST | null): string | null {
  if (!f) {
    return null
  }

  if (f.$field === 'type') {
    const prefix =
      f.$value === 'root' ? 'ro' : types[<string>f.$value]?.prefix
    if (!prefix) {
      return null
    }

    if (f.$operator == '=') {
      return `"${prefix}" e`
    } else if (f.$operator == '!=') {
      return `"${prefix}" e L`
    }
    return null
  }

  switch (f.$operator) {
    case '=':
      if (typeof f.$value === 'string') {
        return `"${f.$field}" f "${f.$value}" c`
      } else {
        // numeric
        const num = Number(f.$value)
        return Number.isNaN(num) ? null : `"${f.$field}" g #${num} F`
      }
    case 'has':
      if (['ancestors', 'children', 'descendants', 'parents'].includes(f.$field)) {
        return null
      }

      if (typeof f.$value === 'string') {
        return `"${f.$value}" "${f.$field}" a`
      } else if (typeof f.$value === 'number') {
        return `#${f.$value} "${f.$field}" a`
      } else if (Array.isArray(f.$value)) {
        if (typeof f.$value[0] === 'string') {
          if (f.$value.some((v: string) => v.includes('"'))) {
            // We can't inline quotes at the moment
            return null
          }

          return f.$value.map((v) => `"${v}" "${f.$field}" a`).join(' Q U ')
        } else if (typeof f.$value[0] === 'number') {
          return f.$value.map((v) => `#${v} "${f.$field}" a`).join(' Q U ')
        }
        return null
      }
      return null // probably never reached but makes ts happy
    case 'exists':
      return `"${f.$field}" h`
    case 'notExists':
      return `"${f.$field}" h L`
  }

  return null
}

export default function ast2IndexHints(types: Record<string, { prefix?: string }>, fork: Fork): string[] {
  return fork.$and
    .filter((f: Fork | FilterAST) => !isFork(f))
    .map((f: FilterAST) => ast2inlineRpn(types, f))
    .filter((s: string | null) => s)
}
