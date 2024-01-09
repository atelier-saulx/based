import { Path } from './types.js'
import { setByPath } from '@saulx/utils'

export * from './types.js'
export * from './parse/index.js'
export * from './exec/index.js'

export function applyDefault(
  obj: any,
  { path, value }: { path: Path; value: any }
): void {
  for (let i = 0; i < path.length - 1; i++) {
    const part = path[i]
    const next = path[i + 1]

    if (!obj[part]) {
      const o = {}
      setByPath(o, path.slice(i + 1), value)
      obj[part] = o
      return
    }

    obj = obj[part]

    if (typeof next === 'number') {
      // specific indexed paths are set specifically
      // $value with specific indexed path is set using this if
    } else if (Array.isArray(obj)) {
      // when there is an array without indexed path segment next
      // means that it's a default value on a traverse result field
      // and we will apply defautls on each element separately
      obj.forEach((x) => applyDefault(x, { path: path.slice(i + 1), value }))
      return
    }
  }

  const last = path[path.length - 1]
  if (obj[last] === undefined) {
    obj[last] = value
  }
}
