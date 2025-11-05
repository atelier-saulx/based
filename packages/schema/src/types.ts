import type { Validation } from './def/validation.js'
import { scope, type } from 'arktype'

const shared = {
  '+': 'reject',
  'required?': 'boolean',
  'title?': 'string | Record<string, string>',
  'description?': 'string | Record<string, string>',
  'validation?': 'Function' as type.cast<Validation>,
  'hooks?': {
    'create?': 'Function' as type.cast<
      (value: any, payload: Record<string, any>) => any
    >,
  },
} as const satisfies Parameters<type>[0]
const numbers = '"number"|"int8"|"int16"|"int32"|"uint8"|"uint16"|"uint32"'
const format = type.enumerated(
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
)

const schemaProps = scope({
  EnumItem: 'string|number|boolean',
  Enum: [
    'EnumItem',
    '|',
    {
      'type?': '"enum"',
      'default?': 'EnumItem',
      enum: 'EnumItem[]',
    },
  ],
  Boolean: [
    '"boolean"',
    '|',
    {
      ...shared,
      type: '"boolean"',
      'default?': 'boolean',
    },
  ],
  Number: [
    numbers,
    '|',
    {
      ...shared,
      type: numbers,
      'default?': 'number',
      'min?': 'number',
      'max?': 'number',
      'step?': 'number|"any"',
    },
  ],
  Binary: [
    '"binary"',
    '|',
    {
      ...shared,
      type: '"binary"',
      'default?': 'TypedArray.Uint8',
      'maxBytes?': 'number',
      'format?': format,
    },
  ],
  String: [
    '"string"',
    '|',
    {
      type: '"string"',
      'default?': 'string',
      'maxBytes?': 'number',
      'max?': 'number',
      'min?': 'number',
      'compression?': '"none"|"deflate"',
      'format?': format,
    },
  ],
  Text: [
    '"text"',
    '|',
    {
      type: '"text"',
      'default?': 'Record<string, string>',
      'compression?': '"none"|"deflate"',
      'format?': format,
    },
  ],
  Json: [
    '"json"',
    '|',
    {
      ...shared,
      type: '"json"',
      'default?': 'Record<string, unknown> | null',
    },
  ],
  Cardinality: [
    '"cardinality"',
    '|',
    {
      ...shared,
      type: '"cardinality"',
      'maxBytes?': 'number',
      'precision?': 'number',
      'mode?': '"sparse"|"dense"',
    },
  ],
  Vector: [
    '"vector"|"colvec"',
    '|',
    {
      ...shared,
      type: '"vector"|"colvec"',
      size: 'number',
      'default?':
        'TypedArray.Int8|TypedArray.Int16|TypedArray.Int32|TypedArray.Uint8|TypedArray.Uint16|TypedArray.Uint32|TypedArray.Float32|TypedArray.Float64',
      'baseType?':
        '"number"|"int8"|"int16"|"int32"|"uint8"|"uint16"|"uint32"|"float32"|"float64"',
    },
  ],
  Timestamp: [
    '"timestamp"',
    '|',
    {
      ...shared,
      type: '"timestamp"',
      'default?': 'number|Date|string',
      'on?': '"create"|"update"',
    },
  ],
  References: {
    ...shared,
    'type?': '"references"',
    'default?': 'number[]',
    items: 'Reference',
  },
  Reference: {
    ...shared,
    'type?': '"reference"',
    'default?': 'number.integer',
    ref: [
      'string',
      ':',
      (ref, ctx) => {
        // @ts-ignore
        const { types } = ctx.root
        return (
          ref in types ||
          ctx.reject(
            new Intl.ListFormat('en', {
              style: 'short',
              type: 'disjunction',
            }).format(Object.keys(types)),
          )
        )
      },
    ],
    prop: 'string',
    'dependent?': 'boolean',
    '[/^\\$/]': 'Prop',
  },
  Prop: 'Enum|Boolean|Number|String|Binary|Json|Cardinality|Vector|Timestamp|References|Reference|Text',
})

const schema = type({
  types: {
    '[string]': schemaProps
      .type({
        props: {
          '[string]': 'Prop',
        },
      })
      .or({
        'props?': 'never',
        '[string]': 'Prop',
      }),
  },
})

const s: typeof schema.infer = {
  types: {
    youzi: {
      name: { type: 'string' },
      ballz: 'string',
    },
    james: {
      name: 'string',
    },
    success: {
      props: {
        ding: {
          items: {
            ref: 'youzi',
            prop: 'lullo',
            $ballz: 'string',
          },
        },
      },
    },
  },
}

const parse = (s) => {
  const out = schema(s)
  if (out instanceof type.errors) {
    throw out.summary
  }
  return out
}

console.log(parse(s))
