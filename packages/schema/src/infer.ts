import { VectorBaseType } from './def/typeIndexes.js'
import { Schema, SchemaVector } from './types.js'

// type BasedTypeMap = {
//   uint8: Uint8Array
//   float32: Float32Array
//   number: Float64Array
//   float64: Float64Array
// }

type TypedArray =
  | Uint8Array
  | Float32Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array

// Map schema types to TypeScript types
type TypeMap = {
  string: string
  number: number
  int8: number
  uint8: number
  int16: number
  uint16: number
  int32: number
  uint32: number
  boolean: boolean
  text: string
  json: any
  // return type is different
  timestamp: number | string | Date
  binary: Uint8Array
  cardinality: number
  vector: TypedArray
  colvec: TypedArray
  alias: string
}

type InferEnum<T extends readonly (string | number | boolean)[]> = T[number]

type InferReference<RefName extends string, Types> = RefName extends keyof Types
  ? { id: number } & InferSchemaType<Types[RefName], Types>
  : { id: number } | undefined

type InferReferences<
  RefName extends string,
  Types,
> = RefName extends keyof Types
  ? Array<{ id: number } & InferSchemaType<Types[RefName], Types>>
  : Array<{ id: number }>

type InferObject<T extends Record<string, any>, Types> = {
  [K in keyof T]: InferProp<T[K], Types>
}

type InferSet<T, Types> = InferProp<T, Types>[]

type InferProp<T, Types> = T extends { props: infer P }
  ? InferObject<P, Types>
  : T extends { items: { ref: infer R extends string } }
    ? InferReferences<R, Types>
    : T extends { items: infer I }
      ? InferSet<I, Types>
      : T extends { ref: infer R extends string }
        ? InferReference<R, Types>
        : T extends { enum: infer E }
          ? E extends readonly (string | number | boolean)[]
            ? InferEnum<E>
            : never
          : T extends { type: infer U }
            ? U extends keyof TypeMap
              ? TypeMap[U]
              : never
            : T extends keyof TypeMap
              ? TypeMap[T]
              : never

// Schema type inference with support for both shorthand and full notation
type InferSchemaType<T, Types> = T extends { props: infer Props }
  ? {
      [K in keyof Props]: InferProp<Props[K], Types>
    } & { id: number }
  : {
      [K in keyof T]: InferProp<T[K], Types>
    } & { id: number }

type InferSchemaTypes<T> = {
  [K in keyof T]: InferSchemaType<T[K], T>
}

type InferSchema<T extends Schema> = T extends {
  types: infer Types
}
  ? Types extends Record<string, any>
    ? InferSchemaTypes<Types>
    : never
  : never

// Utility type for getting the inferred type
export type Infer<T extends Schema> = InferSchema<T>

// Main inference function, returns the inferred schema
export const infer = <T extends { types: Record<string, any> }>(
  schema: T,
): InferSchema<T> => {
  return schema.types as any
}
