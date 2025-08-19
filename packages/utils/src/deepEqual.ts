const deepEqual = (a: any, b: any): boolean => {
  const typeA = typeof a
  const typeB = typeof b
  if (a === b) return true
  if (typeA !== typeB) return false
  if (a === null || b === null) return false
  if (typeA !== 'object') {
    if (typeA === 'function') {
      if (a.toString() !== b.toString()) {
        return false
      }
    } else if (a !== b) {
      return false
    }
  } else {
    if (Array.isArray(a)) {
      if (Array.isArray(b)) {
        const len = a.length
        if (len !== b.length) {
          return false
        }
        for (let i = 0; i < len; i++) {
          const t = typeof a[i]
          if (typeof b[i] !== t) {
            return false
          } else if (t === 'object') {
            if (!deepEqual(a[i], b[i])) {
              return false
            }
          }
        }
      } else {
        return false
      }
    }
    if (a.checksum || b.checksum) {
      if (a.checksum !== b.checksum) {
        return false
      } else {
        return true
      }
    }
    let cnt = 0
    for (let key in a) {
      if (!a.hasOwnProperty(key)) continue
      if (!b.hasOwnProperty(key)) return false
      const k = b[key]
      const k1 = a[key]
      if (k === void 0 && k1 !== void 0) {
        return false
      }
      const t = typeof k
      if (t !== typeof k1) {
        return false
      } else if (k && t === 'object') {
        if (!deepEqual(k1, k)) {
          return false
        }
      } else if (k !== k1) {
        return false
      }
      cnt++
    }
    for (const _key in b) {
      if (!b.hasOwnProperty(_key)) continue
      cnt--
      if (cnt < 0) {
        return false
      }
    }
  }
  return true
}

export default deepEqual
