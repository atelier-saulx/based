import { type SchemaTypes } from '../../schema.js'

import type { BasedModify } from './index.js'

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

type NumInc = number | { increment: number }

type TypeMap = {
  string: string
  number: NumInc
  int8: NumInc
  uint8: NumInc
  int16: NumInc
  uint16: NumInc
  int32: NumInc
  uint32: NumInc
  boolean: boolean
  text: string
  json: any
  timestamp: NumInc | string | Date
  binary: Uint8Array
  alias: string
  vector: TypedArray
  colvec: TypedArray
  cardinality: string | string[]
}

type InferEdgeProps<Prop, Types> = {
  [K in keyof Prop as K extends `$${string}`
    ? K
    : never]?: Prop[K] extends keyof TypeMap
    ? TypeMap[Prop[K]]
    : InferProp<Prop[K], Types>
}

type InferRefValue<Prop, Types> =
  | number
  | BasedModify<any>
  | ({ id: number | BasedModify<any> } & InferEdgeProps<Prop, Types>)

type InferReferences<Prop, Types> =
  | InferRefValue<Prop, Types>[]
  | {
      add?: InferRefValue<Prop, Types>[]
      update?: InferRefValue<Prop, Types>[]
      delete?: (number | BasedModify<any>)[]
    }

type InferProp<Prop, Types> = Prop extends { type: 'object'; props: infer P }
  ? InferType<P, Types>
  : Prop extends { type: infer T extends keyof TypeMap }
    ? TypeMap[T]
    : Prop extends { enum: infer E extends readonly any[] }
      ? E[number]
      : Prop extends { ref: string }
        ? InferRefValue<Prop, Types>
        : Prop extends { items: { ref: string } }
          ? InferReferences<Prop['items'], Types>
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

export type InferPayload<Types extends Record<string, any>> = {
  [K in keyof Types]: InferType<Types[K]['props'], Types>
}
