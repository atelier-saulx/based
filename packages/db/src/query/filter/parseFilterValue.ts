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
      // var val = 0

      // const y = 'now+12s'.replace(/([+-])/g, ' $1 ')

      // const arr = y.split(/[ +]/)
      // // const z
      // console.log(arr)

      if (value === 'now') {
        return Date.now()
      }
      // parse now
    }
    // derp
  }
  return value
}
