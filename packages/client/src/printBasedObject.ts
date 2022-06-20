import { GenericObject } from '@based/types'

export const color = (
  str: string,
  color: 'white' | 'blue' | 'red' | 'green' | 'brightBlue' | 'brightRed'
): string => {
  if (typeof window !== 'undefined') {
    // can also add colors / styling in console
    return str
  }
  const colors = {
    white: '\u001b[37;1m',
    reset: '\u001b[0m',
    blue: '\u001b[34m',
    red: '\u001b[31m',
    green: '\u001b[32m',
    brightBlue: '\u001b[34;1m',
    brightRed: '\u001b[31;1m',
  }
  return `${colors[color]}${str}${colors.reset}`
}

const printBasedObject = (
  obj: GenericObject,
  indent = 0,
  noBrackets = false,
  name = '',
  isError = false
): string[] => {
  let prefix = ''
  for (let i = 0; i < indent; i++) {
    prefix += ' '
  }
  const lines: string[] = noBrackets
    ? []
    : name
    ? [prefix + `${color(name, isError ? 'brightRed' : 'white')} {`]
    : [prefix + '{']
  let needComma = false

  if (!noBrackets) {
    prefix += ' '
    indent += 1
  }

  for (const k in obj) {
    const value = obj[k]
    const field = k[0] === '$' ? color(k, 'white') : k
    if (needComma) {
      lines[lines.length - 1] += ','
    }
    if (Array.isArray(value)) {
      lines.push(`${prefix}  ${field}: [`)
      for (let i = 0; i < value.length; i++) {
        const v = value[i]
        lines.push(
          ...(v && typeof v === 'object'
            ? printBasedObject(v, indent + 4)
            : [`${prefix}    ${v}`])
        )
        if (i !== value.length - 1) {
          lines[lines.length - 1] += ','
        }
      }
      lines.push(`${prefix}  ]`)
    } else if (value && typeof value === 'object') {
      lines.push(`${prefix}  ${field}: {`)
      lines.push(...printBasedObject(value, indent + 2, true))
      lines.push(`${prefix}  }`)
    } else {
      //   if (typeof value === 'number') {
      //     value = color(String(value), 'green')
      //   } else if (value === true || value === false) {
      //     value = color(String(value), 'green')
      //   }
      lines.push(`${prefix}  ${field}: ${value}`)
    }
    needComma = true
  }
  if (!noBrackets) {
    lines.push(prefix.slice(0, -1) + '}')
  }
  return lines
}

export default printBasedObject
