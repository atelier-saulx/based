type ReverseMap<T extends Record<PropertyKey, PropertyKey>> = {
  [P in keyof T as T[P]]: P
}

const reverseMap = <P extends Record<PropertyKey, PropertyKey>>(
  obj: P,
): ReverseMap<P> => {
  const reverse: any = {}
  for (const k in obj) {
    reverse[k] = obj[k]
  }
  return reverse
}

export const typeIndexMap = {
  null: 0,
  timestamp: 1,
  number: 4,
  cardinality: 5,
  int8: 20,
  uint8: 6,
  int16: 21,
  uint16: 22,
  int32: 23,
  uint32: 7,
  boolean: 9,
  enum: 10,
  string: 11,
  text: 12,
  reference: 13,
  references: 14,
  microbuffer: 17,
  alias: 18,
  // aliases: 19,
  binary: 25,
  // id: 26,
  vector: 27,
  json: 28,
  //   object: 29,
  colvec: 30,
} as const

export const reverseTypeMap = reverseMap(typeIndexMap)
export type TypeName = keyof typeof typeIndexMap
export type TypeIndex = keyof typeof reverseTypeMap
