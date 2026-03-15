type GenericObject = Record<string, any>
const isObject = (val: any): val is GenericObject =>
  val !== null && typeof val === 'object' && !Array.isArray(val)
function isDeepEqual(a: any, b: any): boolean {
  if (a === b) return true
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    if (Array.isArray(a)) {
      if (!Array.isArray(b) || a.length !== b.length) return false
      for (let i = 0; i < a.length; i++) {
        if (!isDeepEqual(a[i], b[i])) return false
      }
      return true
    }

    // For nested objects inside arrays
    const keys = Object.keys(a)
    if (keys.length !== Object.keys(b).length) return false
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      if (!Object.prototype.hasOwnProperty.call(b, key)) return false
      if (!isDeepEqual(a[key], b[key])) return false
    }
    return true
  }

  return false
}

export function diffSchemas(
  oldSchema: GenericObject,
  newSchema: GenericObject,
): GenericObject {
  const diff: GenericObject = {}

  // 1. Check for additions and updates
  for (const key in newSchema) {
    const oldVal = oldSchema[key]
    const newVal = newSchema[key]

    if (!(key in oldSchema)) {
      // Brand new key
      diff[key] = newVal
    } else if (isObject(oldVal) && isObject(newVal)) {
      // Both are plain objects, recurse deep
      const nestedDiff = diffSchemas(oldVal, newVal)
      if (Object.keys(nestedDiff).length > 0) {
        diff[key] = nestedDiff
      }
    } else if (Array.isArray(oldVal) && Array.isArray(newVal)) {
      // Both are arrays. Fast reference/recursive check.
      if (!isDeepEqual(oldVal, newVal)) {
        diff[key] = newVal
      }
    } else if (oldVal !== newVal) {
      // Primitive value changed
      diff[key] = newVal
    }
  }

  // 2. Check for deletions
  for (const key in oldSchema) {
    if (!(key in newSchema)) {
      // Key was removed
      diff[key] = undefined
    }
  }
  return diff
}
