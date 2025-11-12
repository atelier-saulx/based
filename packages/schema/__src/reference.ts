import {
  check,
  lazy,
  literal,
  objectWithRest,
  optional,
  pipe,
  string,
  type GenericSchema,
  type InferInput,
  type InferOutput,
} from 'valibot'
import { base } from './base.js'
import { prop, type PropsIn, type PropsOut } from './prop.js'

export type In = InferInput<typeof base> & {
  type?: 'reference'
  ref: string
  prop: string
  [edge: `$${string}`]: PropsIn[keyof PropsIn]
}

export type Out = InferOutput<typeof base> & {
  type: 'reference'
  ref: string
  prop: string
  [edge: `$${string}`]: PropsOut[keyof PropsOut]
}

// @ts-ignore
const schema: GenericSchema<In, Out> = objectWithRest(
  {
    type: optional(literal('reference'), 'reference'),
    prop: string(),
    ref: string(),
    ...base.entries,
  },
  lazy(() => prop),
)

export const reference = pipe(
  schema,
  check((v) =>
    Object.keys(v).every(
      (k) => k in (reference as any).entries || k[0] === '$',
    ),
  ),
)
