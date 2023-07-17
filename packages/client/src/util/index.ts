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
