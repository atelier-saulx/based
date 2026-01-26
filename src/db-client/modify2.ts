import {
  parseSchema,
  type Schema,
  type SchemaOut,
  type SchemaTypes,
} from '../schema.js'

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
  timestamp: number | string | Date
  binary: Uint8Array
  alias: string
  vector: TypedArray
  colvec: TypedArray
  cardinality: string | string[]
}

type InferProp<Prop, Types> = Prop extends { type: 'object'; props: infer P }
  ? InferType<P, Types>
  : Prop extends { type: infer T extends keyof TypeMap }
    ? TypeMap[T]
    : Prop extends { enum: infer E extends readonly any[] }
      ? E[number]
      : Prop extends { ref: string }
        ? string | number
        : Prop extends { items: { ref: string } }
          ? (string | number)[]
          : never

type InferType<Props, Types> = {
  [K in keyof Props as Props[K] extends { required: true }
    ? K
    : never]: InferProp<Props[K], Types>
} & {
  [K in keyof Props as Props[K] extends { required: true }
    ? never
    : K]?: InferProp<Props[K], Types>
}

type InferPayload<Types extends SchemaTypes<true>> = {
  [K in keyof Types]: InferType<Types[K]['props'], Types>
}

const schema = parseSchema({
  types: {
    user: {
      props: {
        name: 'string',
        foo: 'string',
      },
    },
  },
})

export const create = <
  S extends SchemaOut = SchemaOut,
  T extends keyof S['types'] = keyof S['types'],
>(
  schema: S,
  type: T,
  payload: InferPayload<S['types']>[T],
) => {
  const buf: Uint8Array = new Uint8Array(100)
  buf

  const buffers = []
}

create(schema, 'user', {
  name: 'xxx',
  foo: 'abc',
})
