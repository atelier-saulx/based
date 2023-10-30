import { Path } from './types'
import { setByPath } from '@saulx/utils'

export * from './types'
export * from './parse'
export * from './exec'

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
    } else if (Array.isArray(obj)) {
      obj.forEach((x) => applyDefault(x, { path: path.slice(i + 1), value }))
      return
    }
  }

  const last = path[path.length - 1]
  if (obj[last] === undefined) {
    obj[last] = value
  }
}
