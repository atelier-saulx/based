const merge = (target: any, source: any) => {
  if (source.constructor === Array) {
    if (target.length == 0) {
      return source
    }

    for (let i = 0; i < source.length; i++) {
      if (i in target) {
        if (
          target[i] &&
          typeof target[i] === 'object' &&
          source[i] &&
          typeof source[i] === 'object'
        ) {
          const s = merge(target[i], source[i])
          if (s) {
            target[i] = s
          }
        } else if (source[i] !== undefined) {
          target[i] = source[i]
        }
      } else {
        target[i] = source[i]
      }
    }
  } else {
    for (const i in source) {
      if (i in target) {
        if (
          target[i] &&
          typeof target[i] === 'object' &&
          source[i] &&
          typeof source[i] === 'object'
        ) {
          const s = merge(target[i], source[i])
          if (s) {
            target[i] = s
          }
        } else if (source[i] !== undefined) {
          target[i] = source[i]
        }
      } else {
        target[i] = source[i]
      }
    }
  }
}

const deepMergeArrayBlock = (target: any, source: any) => {
  if (
    target &&
    typeof target === 'object' &&
    source &&
    typeof source === 'object'
  ) {
    const s = merge(target, source)

    if (s) {
      // hard case
      for (let i = 0; i < s.length; i++) {
        target[i] = s[i]
      }
      target.splice(s.length - 1, target.length - s.length)
    }

    return target
  }
}

export function deepMergeArrays(target: any, ...sources: any[]): any {
  if (!sources.length) return target
  if (sources.length === 1) {
    deepMergeArrayBlock(target, sources[0])
    return target
  }
  for (let i = 0; i < sources.length; i++) {
    deepMergeArrayBlock(target, sources[i])
  }
  return target
}

const mergeExcludeArray = (target: any, source: any): any => {
  if (source.constructor === Array || target.constructor === Array) {
    return source
  } else {
    for (const i in source) {
      if (i in target) {
        if (
          target[i] &&
          source[i] &&
          typeof target[i] === 'object' &&
          target[i].constructor !== Array &&
          typeof source[i] === 'object' &&
          source[i].constructor !== Array
        ) {
          const a = mergeExcludeArray(target[i], source[i])
          if (a !== target[i]) {
            target[i] = a
          }
        } else {
          target[i] = source[i]
        }
      } else {
        target[i] = source[i]
      }
    }
  }
  return target
}

export function deepMerge(target: any, ...sources: any[]): any {
  if (!sources.length) return target
  if (sources.length === 1) {
    const source = sources[0]
    if (
      target &&
      typeof target === 'object' &&
      source &&
      typeof source === 'object'
    ) {
      return mergeExcludeArray(target, source)
    }
  }
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i]
    if (
      target &&
      typeof target === 'object' &&
      source &&
      typeof source === 'object'
    ) {
      const a = mergeExcludeArray(target, source)
      if (a !== target) {
        target = a
      }
    }
  }
  return target
}
