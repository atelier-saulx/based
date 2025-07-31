const timeToNumber = (ex: string): number => {
  if (ex === 's') {
    return 1000
  }
  if (ex === 'm') {
    return 1000 * 60
  }
  if (ex === 'h') {
    return 1000 * 60 * 60
  }
  if (ex === 'd') {
    return 1000 * 60 * 60 * 24
  }
  if (ex === 'y') {
    return 31556952000
  }
  return 1
}

export const convertToTimestamp = (value: string | Date | number) => {
  if (value instanceof Date) {
    return value.valueOf()
  }
  if (typeof value === 'string') {
    if (value === 'now') {
      return Date.now()
    }
    const trimmedValue = value.trim()
    if (!trimmedValue) {
      return 0
    }

    const y = trimmedValue.replace(/([+-])(?=((now)|(\d+([smhdy]))))/g, ' $1 ')

    const arr = y.split(/ +/)
    let newValue = 0
    let now: number
    let op = 1
    for (const seg of arr) {
      if (seg === '-') {
        op = -1
      } else if (seg === '+') {
        op = 1
      } else {
        var v = 0
        if (seg === 'now') {
          if (!now) {
            now = Date.now()
          }
          v = now
        } else if (/[smhdy]$/.test(seg)) {
          const ex = seg[seg.length - 1]
          const number = parseInt(seg, 10)
          v = number * timeToNumber(ex)
        } else if (seg) {
          v = new Date(seg).valueOf()
        }
        if (op === -1) {
          newValue -= v
        } else {
          newValue += v
        }
      }
    }
    return newValue
  }
  return value
}
