import type { Language } from './languages'

// Schema type
// inspiration from https://json-schema.org/understanding-json-schema/index.html
// but added a few extra types
//   reference
//   references
//   set
//   record

// https://json-schema.org/learn/examples/geographical-location.schema.json

// contentSchema can be used for JSON types as well
// contentSchema can be used for reference / refrences

// TODO parser / validator / parseOut / parseIn (parsIn after validator)

// for refs etc check https://json-schema.org/understanding-json-schema/structuring.html#defs

export type BasedSchemaFieldType =
  | 'array'
  | 'object'
  | 'record'
  | 'set'
  | 'string'
  | 'number'
  | 'float'
  | 'json'
  | 'integer'
  | 'timestamp'
  | 'reference'
  | 'references'
  | 'text'

export type BasedSchemaPattern = string // RE ^[A-Za-z_][A-Za-z0-9_]*$

export type BasedSchemaLanguage = Language // fix

export type BasedSchemaTypePrefix = string // fix

// Some examples
export type BasedSchemaContentMediaType =
  | 'text/html'
  | 'text/plain'
  | 'text/markdown'
  | 'image/png'
  | 'image/jpeg'
  | 'video/mp4'
  | string

export type BasedSchemaFieldShared = {
  $id?: string
  $schema?: string
  required?: boolean
  title?: string
  description?: string
  readOnly?: boolean
  writeOnly?: boolean
  $comment?: string
  examples?: any[] // <--- make this generic
  default?: any // <-- make this generic

  // extra thing by us allow users to overwrite entire validations
  customValidator?: (value: any) => boolean

  $defs?: { [key: string]: BasedSchemaField }
}

// -------------- Primitive ---------------
export type BasedSchemaFieldString = {
  type: 'string'
  minLength?: number
  maxLength?: number
  contentMediaEncoding?: string // base64
  contentMediaType?: BasedSchemaContentMediaType
  pattern?: BasedSchemaPattern
  format?: 'email' | 'hostname' | 'ipv4' | 'ipv6' | 'uuid' | 'uri'
  // maybe add some more? e.g. phone
} & BasedSchemaFieldShared

export type BasedSchemaFieldEnum = {
  enum: any[] // this changes behaviour pretty extreme
  // important to type as well because we want to enum based on the type e.g. for references
} & BasedSchemaFieldShared

export type BasedSchemaFieldConst = {
  const: any
} & BasedSchemaFieldShared

type NumberDefaults = {
  multipleOf?: number
  minimum?: number
  maximum?: number
  exclusiveMaximum?: boolean
  exclusiveMinimum?: boolean
}

export type BasedSchemaFieldNumber = NumberDefaults & {
  type: 'number'
}

export type BasedSchemaFieldInteger = NumberDefaults & {
  type: 'integer'
} & BasedSchemaFieldShared

export type BasedSchemaFieldTimeStamp = NumberDefaults & {
  type: 'timestamp'
} & BasedSchemaFieldShared

export type BasedSchemaFieldBoolean = {
  type: 'boolean'
} & BasedSchemaFieldShared

// Can support full json SCHEMA validation for this
export type BasedSchemaFieldJSON = {
  type: 'json'
} & BasedSchemaFieldShared

export type BasedSchemaFieldPrimitive =
  | BasedSchemaFieldString
  | BasedSchemaFieldNumber
  | BasedSchemaFieldInteger
  | BasedSchemaFieldTimeStamp
  | BasedSchemaFieldJSON
  | BasedSchemaFieldBoolean
  | BasedSchemaFieldEnum
  | BasedSchemaFieldShared

// -------------- Enumerable ---------------
export type BasedSchemaFieldText = {
  type: 'text'
  required?: BasedSchemaLanguage[]
  contentMediaType?: BasedSchemaContentMediaType
} & BasedSchemaFieldShared

export type BasedSchemaFieldObject = {
  type: 'object'
  properties: {
    [name: string]: BasedSchemaField
  }
  required?: string[]
} & BasedSchemaFieldShared

export type BasedSchemaFieldRecord = {
  type: 'record'
  values: BasedSchemaField
} & BasedSchemaFieldShared

export type BasedSchemaFieldArray = {
  type: 'array'
  values: BasedSchemaField
} & BasedSchemaFieldShared

export type BasedSchemaFieldSet = {
  type: 'set'
  items: BasedSchemaFieldPrimitive
} & BasedSchemaFieldShared

export type BasedSchemaFieldEnumerable =
  | BasedSchemaFieldText
  | BasedSchemaFieldObject
  | BasedSchemaFieldRecord
  | BasedSchemaFieldArray
  | BasedSchemaFieldSet

// -------------- Reference ---------------
export type BasedSchemaFieldReference = {
  type: 'reference'
  bidirectional?: {
    fromField: string
  }
  // TODO: selva filters { $operator: 'includes', $value: 'image/', $field: 'mimeType' }
  allowedTypes?: (string | { type?: string; $filter: any | any[] })[]
} & BasedSchemaFieldShared

// make extra package called based db - query (maybe in based-db)
export type BasedSchemaFieldReferences = {
  type: 'references'
  bidirectional?: {
    fromField: string
  }
  allowedTypes?: (string | { type?: string; $filter: any | any[] })[]
} & BasedSchemaFieldShared

// return type can be typed - sort of
export type BasedSchemaField =
  | BasedSchemaFieldEnumerable
  | BasedSchemaFieldPrimitive
  | BasedSchemaFieldReference
  | BasedSchemaFieldReferences
  | {
      isRequired?: boolean // our own
      $ref: string // to mimic json schema will just load it in place (so only for setting)
    }

export type BasedSchemaType = {
  fields: {
    [name: string]: BasedSchemaField
  }
  title?: string
  description?: string
  prefix?: BasedSchemaTypePrefix
  $defs?: { [key: string]: BasedSchemaField }
}

// this is the return value,, optional for insert
export type BasedSchema = {
  languages: BasedSchemaLanguage[]
  root: BasedSchemaType

  // in our setup this is used as top level /$defs/[name]/
  // in our setup this is used as top level /types/[name]/$defs/[name]
  // #/$defs/name

  $defs?: { [name: string]: BasedSchemaField }
  types: {
    [type: string]: BasedSchemaType
  }
}

// TODO: add required
