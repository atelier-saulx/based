type TypedArray =
  | Uint8Array
  | Float32Array
  | Int8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float64Array

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
  timestamp: number
  binary: Uint8Array
  alias: string
  vector: TypedArray
  colvec: TypedArray
  cardinality: number
}

type InferProp<
  Prop,
  Types,
  Locales extends Record<string, any> = Record<string, any>,
> = Prop extends { type: 'text' }
  ? string
  : Prop extends { type: 'object'; props: infer P }
    ? InferType<P, Types, Locales>
    : Prop extends { type: infer T extends keyof TypeMap }
      ? TypeMap[T]
      : Prop extends { enum: infer E extends readonly any[] }
        ? E[number]
        : Prop extends { ref: string }
          ? number // ID
          : Prop extends { items: { ref: string } }
            ? number[] // IDs
            : unknown

type InferType<
  Props,
  Types,
  Locales extends Record<string, any> = Record<string, any>,
> = {
  [K in keyof Props]: InferProp<Props[K], Types, Locales>
}

export type InferSchemaOutput<
  S extends { types: any; locales?: any },
  T extends keyof S['types'],
> = InferType<
  S['types'][T]['props'],
  S['types'],
  S['locales'] extends Record<string, any> ? S['locales'] : {}
> & { id: number }
