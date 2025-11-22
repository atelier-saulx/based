// WARN: The following type codes are used in js and zig but selva has its own typing.
export const NULL = 0
export const TIMESTAMP = 1
export const NUMBER = 4
export const CARDINALITY = 5
export const INT8 = 20
export const UINT8 = 6
export const INT16 = 21
export const UINT16 = 22
export const INT32 = 23
export const UINT32 = 7
export const BOOLEAN = 9
export const ENUM = 10
export const STRING = 11
export const TEXT = 12
export const REFERENCE = 13
export const REFERENCES = 14
export const MICRO_BUFFER = 17
export const ALIAS = 18
export const ALIASES = 19
export const BINARY = 25
export const VECTOR = 27
export const JSON = 28
export const OBJECT = 29
export const COLVEC = 30
export const ID = 255

export type TypeIndex =
  | typeof NULL
  | typeof TIMESTAMP
  | typeof NUMBER
  | typeof CARDINALITY
  | typeof INT8
  | typeof UINT8
  | typeof INT16
  | typeof UINT16
  | typeof INT32
  | typeof UINT32
  | typeof BOOLEAN
  | typeof ENUM
  | typeof STRING
  | typeof TEXT
  | typeof REFERENCE
  | typeof REFERENCES
  | typeof MICRO_BUFFER
  | typeof ALIAS
  | typeof ALIASES
  | typeof BINARY
  | typeof ID
  | typeof VECTOR
  | typeof JSON
  | typeof OBJECT
  | typeof COLVEC

export enum VectorBaseType {
  Int8 = 1,
  Uint8 = 2,
  Int16 = 3,
  Uint16 = 4,
  Int32 = 5,
  Uint32 = 6,
  Float32 = 7,
  Float64 = 8,
}

export const isNumberType = (type: TypeIndex): boolean => {
  return (
    type === NUMBER ||
    type === UINT16 ||
    type === UINT32 ||
    type === INT16 ||
    type === INT32 ||
    type == UINT8 ||
    type === INT8 ||
    type === CARDINALITY
  )
}
