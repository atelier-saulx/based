import hashObject from './hashObject.js'
import stringHash from './stringHash.js'

// no murmur (and no buffers) for browser
const hash = (val: any, size?: number): number => {
  let result: number
  if (typeof val === 'object') {
    if (val === null) {
      result = 0
    } else {
      result = hashObject(val)
    }
  } else {
    if (typeof val === 'boolean') {
      result = val ? 792222265344 : 4821552340992
    } else if (typeof val === 'number') {
      result =
        (stringHash('n:' + val) >>> 0) * 4096 +
        (stringHash('n:' + val, 52711) >>> 0)
    } else {
      result = (stringHash(val) >>> 0) * 4096 + (stringHash(val, 52711) >>> 0)
    }
  }

  if (size) {
    const len = Math.ceil(Math.log10(result + 1))
    if (len < size) {
      return result * Math.pow(10, size - len)
    }
  }

  return result
}

export default hash
