import stringHash from './stringHash.js'

// TODO: Something like this - but wait for later (has higher colision atm)

// const NULL_NUMBER = 1423862142
// const OBJECT_NUMBER = 193418506
// const BOOLEAN_NUMBER = 193413639

// export const hashFieldLegacy = (
//   hash: number,
//   hash2: number,
//   i: number,
//   field: any,
//   nest: (field: any, hash: number, hash2: number) => [number, number]
// ): [number, number] => {
//   const type = typeof field
//   if (type === 'string') {
//     hash = stringHash(field, (hash * 33) ^ i)
//     hash2 = stringHash(field, (hash2 * 33) ^ i)
//   } else if (type === 'number') {
//     hash = (hash * 33) ^ i
//     hash = (hash * 33) ^ field
//     hash2 = (hash2 * 33) ^ i
//     hash2 = (hash2 * 33) ^ field
//   } else if (type === 'object') {
//     if (field === null) {
//       hash = (hash * 33) ^ i
//       hash = (hash * 33) ^ NULL_NUMBER
//       hash2 = (hash2 * 33) ^ i
//       hash2 = (hash2 * 33) ^ NULL_NUMBER
//     } else {
//       const x = nest(field, hash, hash2)
//       hash = (hash * 33) ^ i
//       hash = (hash * 33) ^ x[0]
//       hash = (hash * 33) ^ OBJECT_NUMBER
//       hash2 = (hash2 * 33) ^ i
//       hash2 = (hash2 * 33) ^ x[1]
//       hash2 = (hash2 * 33) ^ OBJECT_NUMBER
//     }
//   } else if (type === 'boolean') {
//     hash = (hash * 33) ^ i
//     hash = (hash * 33) ^ BOOLEAN_NUMBER
//     hash2 = (hash2 * 33) ^ i
//     hash2 = (hash2 * 33) ^ BOOLEAN_NUMBER
//   }
//   return [hash, hash2]
// }

export const hashFieldLegacy = (
  hash: number,
  hash2: number,
  i: number | string,
  field: any,
  nest: (field: any, hash: number, hash2: number) => [number, number]
): [number, number] => {
  const type = typeof field
  let f: string = ''
  if (type === 'string') {
    f = i + ':' + field
  } else if (type === 'number') {
    f = i + 'n:' + field
  } else if (type === 'object') {
    if (field === null) {
      f = i + 'v:' + 'null'
    } else {
      const x = nest(field, hash, hash2)
      return [stringHash(i + 'o:', x[0]), stringHash(i + 'o:', x[1])]
    }
  } else if (type === 'boolean') {
    f = i + 'b:' + (field ? 'true' : 'false')
  }
  return [stringHash(f, hash), stringHash(f, hash2)]
}
