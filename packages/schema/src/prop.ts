import {
  string as str,
  object as obj,
  lazy,
  record,
  union,
  type GenericSchema,
  type InferInput,
  type InferOutput,
  optional,
  literal,
} from 'valibot'
import { alias } from './alias.js'
import { binary } from './binary.js'
import { boolean } from './boolean.js'
import { cardinality } from './cardinality.js'
import { colvec } from './colvec.js'
import { enum_ } from './enum.js'
import { json } from './json.js'
import { number } from './number.js'
import { reference } from './reference.js'
import { string } from './string.js'
import { text } from './text.js'
import { timestamp } from './timestamp.js'
import { vector } from './vector.js'
import { references } from './references.js'
import { base } from './base.js'

// these need to be defined in the same place
export interface PropsIn {
  [key: string]: InferInput<typeof prop>
}

export interface PropsOut {
  [key: string]: InferOutput<typeof prop>
}

export const props: GenericSchema<PropsIn, PropsOut> = record(
  str(),
  lazy(() => prop),
)

const object = obj({
  type: optional(literal('object'), 'object'),
  props,
  ...base.entries,
})

export const prop = union([
  alias,
  binary,
  boolean,
  cardinality,
  colvec,
  enum_,
  json,
  number,
  object,
  string,
  text,
  timestamp,
  vector,
  reference,
  references,
])
