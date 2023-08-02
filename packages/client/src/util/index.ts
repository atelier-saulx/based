import { Path } from '../get'

export function joinPath(path: (string | number)[]): string {
  if (!path.length) {
    return ''
  }

  let str = `${path[0]}`

  for (let i = 1; i < path.length; i++) {
    const v = path[i]
    if (typeof v === 'number') {
      str += `[${v}]`
    } else {
      str += `.${v}`
    }
  }

  return str
}

export function parseAlias(alias: string): Path {
  return alias.split('.').reduce((acc, part) => {
    if (!part.endsWith(']')) {
      acc.push(part)
      return acc
    }

    let numStr = ''
    let i: number
    for (i = part.length - 2; i >= 0; i--) {
      const c = part[i]
      if (c === '[') {
        break
      }

      numStr += c
    }

    const num = Number(numStr)
    if (!Number.isNaN(num)) {
      acc.push(part.slice(0, i))
      acc.push(num)
      return acc
    }

    acc.push(part)
    return acc
  }, [])
}
