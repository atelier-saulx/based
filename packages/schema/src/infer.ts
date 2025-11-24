import type { Schema } from './_types.js'

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
  vector: TypedArray
  colvec: TypedArray
  alias: string
}

type OutputSpecifics = {
  cardinality: number
}

type InputSpecifics = {
  cardinality: string | string[]
}

type IO = 'input' | 'output'

type ResolveDataType<
  Key,
  Mode extends IO,
> = Key extends keyof (Mode extends 'input' ? InputSpecifics : OutputSpecifics)
  ? (Mode extends 'input' ? InputSpecifics : OutputSpecifics)[Key &
      keyof (Mode extends 'input' ? InputSpecifics : OutputSpecifics)]
  : Key extends keyof TypeMap
    ? TypeMap[Key]
    : never

type InferEnum<T extends readonly (string | number | boolean)[]> = T[number]

type InferReference<
  RefName extends string,
  Types,
  Mode extends IO,
> = RefName extends keyof Types
  ? { id: number } & InferSchemaType<Types[RefName], Types, Mode>
  : { id: number } | undefined

type InferReferences<
  RefName extends string,
  Types,
  Mode extends IO,
> = RefName extends keyof Types
  ? Array<{ id: number } & InferSchemaType<Types[RefName], Types, Mode>>
  : Array<{ id: number }>

type InferObject<T extends Record<string, any>, Types, Mode extends IO> = {
  [K in keyof T]: InferProp<T[K], Types, Mode>
}

type InferSet<T, Types, Mode extends IO> = InferProp<T, Types, Mode>[]

type InferProp<T, Types, Mode extends IO> = T extends { props: infer P }
  ? P extends Record<string, any>
    ? InferObject<P, Types, Mode>
    : never
  : T extends { items: { ref: infer R extends string } }
    ? InferReferences<R, Types, Mode>
    : T extends { items: infer I }
      ? InferSet<I, Types, Mode>
      : T extends { ref: infer R extends string }
        ? InferReference<R, Types, Mode>
        : T extends { enum: infer E }
          ? E extends readonly (string | number | boolean)[]
            ? InferEnum<E>
            : never
          : T extends { type: infer U }
            ? ResolveDataType<U, Mode>
            : T extends keyof TypeMap
              ? ResolveDataType<T, Mode>
              : never

// Schema type inference with support for both shorthand and full notation
type InferSchemaType<T, Types, Mode extends IO> = T extends {
  props: infer Props
}
  ? {
      [K in keyof Props]: InferProp<Props[K], Types, Mode>
    } & { id: number }
  : {
      [K in keyof T]: InferProp<T[K], Types, Mode>
    } & { id: number }

type InferSchemaTypes<T, Mode extends IO> = {
  [K in keyof T]: InferSchemaType<T[K], T, Mode>
}

type InferSchema<T extends Schema, Mode extends IO> = T extends {
  types: infer Types
}
  ? Types extends Record<string, any>
    ? InferSchemaTypes<Types, Mode>
    : never
  : never

// Utility type for getting the inferred type
export type Infer<T extends Schema> = InferSchema<T, 'output'>

export type InferOutput<T extends Schema> = InferSchema<T, 'output'>
export type InferInput<T extends Schema> = InferSchema<T, 'input'>

// Main inference function, returns the inferred schema
export const infer = <T extends { types: Record<string, any> }>(
  schema: T,
): InferSchema<T, 'output'> => {
  return schema.types as any
}
