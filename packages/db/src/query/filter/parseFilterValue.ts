import {
  PropDef,
  PropDefEdge,
  TIMESTAMP,
  CREATED,
  UPDATED,
} from '../../schema/types.js'

// -------------------------------------------
// conditions normal
// field, [size 2]
// [or = 0] [size 2] [start 2], [op], value[size]
// -------------------------------------------
// conditions or fixed
// field, [size 2]
// [or = 1] [size 2] [start 2] [op], [repeat 2], value[size] value[size] value[size]
// -------------------------------------------
// conditions or variable
// field, [size 2]
// [or = 2] [size 2] [start 2], [op], [size 2], value[size], [size 2], value[size]
// -------------------------------------------

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

export const parseFilterValue = (
  prop: PropDef | PropDefEdge,
  value: any,
): number => {
  if (
    prop.typeIndex === TIMESTAMP ||
    prop.typeIndex === CREATED ||
    prop.typeIndex === UPDATED
  ) {
    if (value instanceof Date) {
      return value.valueOf()
    }
    if (typeof value === 'string') {
      if (value === 'now') {
        return Date.now()
      }
      const y = value.replace(/([+-])/g, ' $1 ')
      const arr = y.split(/ +/)
      let newValue = 0
      let now: number
      let op = 1

      console.log({ arr })
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
          console.log({ newValue })
        }
      }
      return newValue
    }
  }
  return value
}
