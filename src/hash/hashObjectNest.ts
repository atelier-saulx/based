import { hashFieldLegacy } from './hashField.js'

const hashObjectNest = (
  obj: { [key: string]: any } | any[],
  hash = 5381,
  hash2 = 52711
): [number, number] => {
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const result = hashFieldLegacy(hash, hash2, i, obj[i], hashObjectNest)
      hash = result[0]
      hash2 = result[1]
    }
  } else {
    for (const key in obj) {
      if (key === undefined) {
        continue
      }
      const result = hashFieldLegacy(hash, hash2, key, obj[key], hashObjectNest)
      hash = result[0]
      hash2 = result[1]
    }
  }
  return [hash, hash2]
}

export default hashObjectNest
