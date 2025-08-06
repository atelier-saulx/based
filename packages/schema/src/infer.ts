import { parse } from './parse/index.js'
import { Schema } from './types.js'

// Type inference utilities
type InferString = string
type InferNumber = number
type InferBoolean = boolean
type InferText = string
type InferJson = any
type InferTimestamp = number
type InferBinary = Uint8Array
type InferCardinality = number
type InferVector = Float32Array
type InferColvec = Float32Array

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

type InferProp<T, Types> = T extends { type: 'string' }
  ? InferString
  : T extends {
        type:
          | 'number'
          | 'int8'
          | 'uint8'
          | 'int16'
          | 'uint16'
          | 'int32'
          | 'uint32'
      }
    ? InferNumber
    : T extends { type: 'boolean' }
      ? InferBoolean
      : T extends { type: 'text' }
        ? InferText
        : T extends { type: 'json' }
          ? InferJson
          : T extends { type: 'timestamp' }
            ? InferTimestamp
            : T extends { type: 'binary' }
              ? InferBinary
              : T extends { type: 'cardinality' }
                ? InferCardinality
                : T extends { type: 'vector' }
                  ? InferVector
                  : T extends { type: 'colvec' }
                    ? InferColvec
                    : T extends { enum: infer E }
                      ? E extends readonly (string | number | boolean)[]
                        ? InferEnum<E>
                        : never
                      : T extends { ref: infer R extends string }
                        ? InferReference<R, Types>
                        : T extends { items: { ref: infer R extends string } }
                          ? InferReferences<R, Types>
                          : T extends { items: infer I }
                            ? InferSet<I, Types>
                            : T extends { props: infer P }
                              ? InferObject<P, Types>
                              : T extends string
                                ? T extends 'string'
                                  ? InferString
                                  : T extends
                                        | 'number'
                                        | 'int8'
                                        | 'uint8'
                                        | 'int16'
                                        | 'uint16'
                                        | 'int32'
                                        | 'uint32'
                                    ? InferNumber
                                    : T extends 'boolean'
                                      ? InferBoolean
                                      : T extends 'text'
                                        ? InferText
                                        : T extends 'json'
                                          ? InferJson
                                          : T extends 'timestamp'
                                            ? InferTimestamp
                                            : T extends 'binary'
                                              ? InferBinary
                                              : T extends 'cardinality'
                                                ? InferCardinality
                                                : T extends 'vector'
                                                  ? InferVector
                                                  : T extends 'colvec'
                                                    ? InferColvec
                                                    : never
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

type InferSchema<T extends Schema> = T extends { types: infer Types }
  ? Types extends Record<string, any>
    ? InferSchemaTypes<Types>
    : never
  : never

// Utility type for getting the inferred type
export type Infer<T> = InferSchema<T>

// Main inference function, returns the inferred schema
export const infer = <T extends { types: Record<string, any> }>(
  schema: T,
): InferSchema<T> => {
  return schema.types as any
}
