import {
  any,
  array,
  boolean,
  check,
  custom,
  date,
  instance,
  integer,
  lazy,
  literal,
  minValue,
  never,
  number,
  object,
  objectWithRest,
  optional,
  parse,
  picklist,
  pipe,
  record,
  string,
  transform,
  union,
  type GenericSchema,
  type InferInput,
  type InferOutput,
} from 'valibot'
import { Validation } from '../index.js'

const compression = picklist(['none', 'deflate'])
const natural = pipe(number(), integer(), minValue(0))
const positive = pipe(number(), minValue(0))
const mime = union([
  picklist([
    'text/html',
    'text/plain',
    'text/markdown',
    'image/png',
    'image/jpeg',
    'video/mp4',
    'video/quicktime',
    'image/*',
    'video/*',
    'audio/*',
    '*/*',
  ]),
  custom<`${string}/${string}`>((v: string) => v.includes('/')),
])
const format = picklist([
  'alpha',
  'alphaLocales',
  'alphanumeric',
  'alphanumericLocales',
  'ascii',
  'base32',
  'base58',
  'base64',
  'BIC',
  'btcAddress',
  'clike',
  'code',
  'creditCard',
  'css',
  'currency',
  'dataURI',
  'EAN',
  'email',
  'ethereumAddress',
  'FQDN',
  'hexadecimal',
  'hexColor',
  'HSL',
  'html',
  'IBAN',
  'identityCard',
  'IMEI',
  'IP',
  'IPRange',
  'ISBN',
  'ISIN',
  'ISO31661Alpha2',
  'ISO31661Alpha3',
  'ISO4217',
  'ISO6391',
  'ISO8601',
  'ISRC',
  'ISSN',
  'javascript',
  'json',
  'JWT',
  'latLong',
  'licensePlate',
  'lowercase',
  'luhnNumber',
  'MACAddress',
  'magnetURI',
  'markdown',
  'MD5',
  'mimeType',
  'mobilePhone',
  'mobilePhoneLocales',
  'octal',
  'password',
  'passportNumber',
  'port',
  'postalCode',
  'postalCodeLocales',
  'python',
  'RFC3339',
  'rgbColor',
  'rust',
  'semVer',
  'slug',
  'surrogatePair',
  'taxID',
  'typescript',
  'uppercase',
  'URL',
  'UUID',
  'VAT',
])

const schemaNumberTypes = picklist([
  'number',
  'int8',
  'uint8',
  'int16',
  'uint16',
  'int32',
  'uint32',
])

const enumType = union([string(), boolean(), number()])
const vectorType = union([
  instance(Int8Array),
  instance(Uint8Array),
  instance(Int16Array),
  instance(Uint16Array),
  instance(Int32Array),
  instance(Uint32Array),
  instance(Float32Array),
  instance(Float64Array),
])

// ---- schema props
const base = object({
  required: optional(boolean()),
  title: optional(string()),
  description: optional(string()),
  validation: optional(custom<Validation>((v) => typeof v === 'function')),
})

const bool = object({
  ...base.entries,
  type: literal('boolean'),
  default: optional(boolean()),
})

const str = object({
  ...base.entries,
  type: literal('string'),
  default: optional(string()),
  maxBytes: optional(natural),
  max: optional(natural),
  min: optional(natural),
  mime: optional(mime),
  format: optional(format),
  compression: optional(compression),
})

const alias = object({
  ...str.entries,
  type: literal('alias'),
})

const binary = object({
  ...base.entries,
  type: literal('binary'),
  default: optional(instance(Uint8Array)),
  maxBytes: optional(number()),
  mime: optional(mime),
  format: optional(format),
})

const text = object({
  ...base.entries,
  type: literal('text'),
  default: optional(record(string(), string())),
  format: optional(format),
  compression: optional(compression),
})

const json = object({
  ...base.entries,
  type: literal('json'),
  default: optional(any()),
})

const cardinality = object({
  ...base.entries,
  type: literal('cardinality'),
  maxBytes: optional(natural),
  precision: optional(natural),
  mode: optional(picklist(['sparse', 'dense'])),
})

const vector = object({
  ...base.entries,
  type: picklist(['vector', 'colvec']),
  default: optional(vectorType),
  size: number(),
  baseType: schemaNumberTypes,
})

const timestamp = object({
  ...base.entries,
  type: literal('timestamp'),
  default: optional(date()),
})

const enume = object({
  ...base.entries,
  type: optional(literal('enum'), 'enum'),
  default: optional(enumType),
  enum: array(enumType),
})

const num = object({
  ...base.entries,
  type: schemaNumberTypes,
  default: optional(number()),
  min: optional(number()),
  max: optional(number()),
  step: optional(positive),
})

const reference: GenericSchema<
  InferInput<typeof base> & {
    type?: 'reference'
    ref: string
    prop: string
    [key: `$${string}`]: SchemaProp
  }
> = pipe(
  objectWithRest(
    {
      ...base.entries,
      type: optional(literal('reference'), 'reference'),
      prop: string(),
      ref: string(),
    },
    lazy(() => prop),
  ),
  check((v) =>
    Object.keys(v).every(
      (k) => k in (reference as any).entries || k[0] === '$',
    ),
  ),
)

const references: GenericSchema<
  InferInput<typeof base> & {
    type?: 'references'
    items: {
      ref: string
      prop: string
      [key: `$${string}`]: SchemaProp
    }
  }
> = object({
  ...base.entries,
  type: optional(literal('references'), 'references'),
  items: reference,
})

const props: GenericSchema<{ [key: string]: SchemaProp }> = record(
  string(),
  lazy(() => prop),
)

const obj = object({
  ...base.entries,
  type: optional(literal('object'), 'object'),
  props,
})

const propShorthand = union([
  pipe(
    picklist([
      'timestamp',
      'binary',
      'boolean',
      'string',
      'alias',
      'text',
      'json',
      'cardinality',
      ...schemaNumberTypes.options,
    ]),
    transform((type) => ({ type })),
  ),
  pipe(
    array(enumType),
    transform((e) => ({ enum: e })),
  ),
])

const prop = union([
  propShorthand,
  alias,
  binary,
  bool,
  cardinality,
  enume,
  json,
  num,
  obj,
  reference,
  references,
  str,
  text,
  timestamp,
  vector,
])

const typeShorthand = pipe(
  objectWithRest(
    {
      props: optional(never()),
    },
    prop,
  ),
  transform((props) => ({ props })),
)

const type = union(
  [
    typeShorthand,
    object({
      props,
    }),
  ],
  // ({ issues }) => {
  //   const { key, value } = issues[0].path[0]
  //   console.log({ key, value }, issues[0].path[0])
  //   return `Unexpected value at ${key}: ${value}`
  // },
)

const schema = object({
  types: record(string(), type),
})

export type SchemaProp = InferInput<typeof prop>
export type SchemaBinary = InferInput<typeof binary>
export type SchemaBoolean = InferInput<typeof bool>
export type SchemaCardinality = InferInput<typeof cardinality>
export type SchemaEnum = InferInput<typeof enume>
export type SchemaJson = InferInput<typeof json>
export type SchemaObject = InferInput<typeof obj>
export type SchemaReference = InferInput<typeof reference>
export type SchemaReferences = InferInput<typeof references>
export type SchemaString = InferInput<typeof str>
export type SchemaText = InferInput<typeof text>
export type SchemaTimestamp = InferInput<typeof timestamp>
export type SchemaVector = InferInput<typeof vector>
export type Schema = InferInput<typeof schema>
export type StrictSchema = InferOutput<typeof schema>

export const p = (input: Schema): { schema: StrictSchema } => {
  // try {
  const output = parse(schema, input)
  return { schema: output }
  // } catch (e) {
  //   throw flatten(e.issues)
  // }
}

// const result = p({
//   types: {
//     youxi: {
//       title: 'string',
//       age: 'number',
//       things: {
//         type: 'enum',
//         enum: [1, 2, 3],
//       },
//     },
//   },
// })

// const schema1 = {
//   types: {
//     user: {
//       email: [string(), email()],
//       name: string(),
//       age: [number(), integer(), minValue(0), maxValue(100)],
//     },
//   },
// }

// const schema2 = {
//   types: {
//     user: {
//       email: pipe(string(), email()),
//       name: string(),
//       age: pipe(number(), integer(), minValue(0), maxValue(100)),
//     },
//   },
// }

// const schema3 = {
//   types: {
//     user: {
//       email: optional(pipe(string(), email())),
//       name: optional(string()),
//       age: optional(pipe(number(), integer(), minValue(0), maxValue(100))),
//     },
//   },
// }

const schema4 = {
  types: {
    user: {
      email: 'string.email',
      name: 'string',
      age: 'uint8.max(120): User age has to be smaller than 120',
      friends: 'references.user.friends',
      bff: 'reference.user.bff',
    },
  },
}

const schema5: Schema = {
  types: {
    user: {
      email: {
        type: 'string',
        validation: () => true,
      },
      name: {
        type: 'string',
        validation: () => true,
      },
      age: {
        type: 'uint8',
        min: 18,
      },
      friends: {
        items: {
          ref: 'user',
          prop: 'friends',
        },
      },
      bff: {
        ref: 'user',
        prop: 'bff',
      },
    },
  },
}
