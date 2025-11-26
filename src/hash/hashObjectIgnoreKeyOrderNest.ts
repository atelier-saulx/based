import stringHash from './stringHash.js'
import { hashFieldLegacy } from './hashField.js'

const hashObjectIgnoreKeyOrderNest = (
  obj: { [key: string]: any } | any[],
  hash: number = 5381,
  hash2: number = 52711
): [number, number] => {
  if (Array.isArray(obj)) {
    const fl = '__len:' + obj.length + 1
    hash = stringHash(fl, hash)
    hash2 = stringHash(fl, hash2)
    for (let i = 0; i < obj.length; i++) {
      const field = obj[i]
      const result = hashFieldLegacy(
        hash,
        hash2,
        i,
        field,
        hashObjectIgnoreKeyOrderNest
      )
      hash = result[0]
      hash2 = result[1]
    }
  } else {
    const keys = Object.keys(obj).sort()
    const fl = '__len:' + keys.length + 1
    hash = stringHash(fl, hash)
    hash2 = stringHash(fl, hash2)
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      if (key === undefined) {
        continue
      }
      const field = obj[key]
      const result = hashFieldLegacy(
        hash,
        hash2,
        key,
        field,
        hashObjectIgnoreKeyOrderNest
      )
      hash = result[0]
      hash2 = result[1]
    }
  }
  return [hash, hash2]
}

export default hashObjectIgnoreKeyOrderNest
