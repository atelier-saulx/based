export type Item = {
  id: number
} & { [key: string]: any }

export type Meta = {
  checksum: number
  size: number
  crc32: number
  compressed: boolean
  value?: any
}

export type AggItem = Partial<Item>

export type TypedArray =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array
