const deepCopy = <
  T extends { [key: string]: any | undefined } | (any | undefined)[]
>(
  a: T
): T => {
  const r: T = <T>(Array.isArray(a) ? [] : {})
  for (const k in a) {
    if (a[k] !== null && typeof a[k] === 'object') {
      if ('buffer' in a[k] && a[k].buffer instanceof ArrayBuffer) {
        r[k] = a[k]
      } else {
        if ('toJSON' in a[k] && typeof a[k].toJSON === 'function') {
          r[k] = a[k].toJSON()
        } else {
          r[k] = deepCopy(a[k])
        }
      }
    } else {
      r[k] = a[k]
    }
  }
  return r
}

export default deepCopy
