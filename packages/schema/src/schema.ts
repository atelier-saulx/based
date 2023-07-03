// Schema type
// inspiration from https://json-schema.org/understanding-json-schema/index.html
// but added a few extra types
//   reference
//   references
//   set
//   record

// contentSchema can be used for JSON types as well
// contentSchema can be used for reference / refrences

// TODO parser / validator / parseOut / parseIn (parsIn after validator)

export type BasedSchemaFieldType =
  | 'string'
  | 'number'
  | 'integer'
  | 'set'
  | 'reference'
  | 'references'
  | 'record'
  | 'array'
  | 'object'
  | 'text'

export type BasedSchemaFieldShared = {
  title?: string
  description?: string
  readOnly?: boolean
  writeOnly?: boolean
  $comment?: string
  examples?: any[] // <--- make this generic
  default?: any // <-- make this generic
  // enum?: any[] // <--- dont need type
  // const?: any // <--- dont need type
}

export type BasedSchemaFieldObject = {
  type: 'object'
  properties: {
    [name: string]: BasedSchemaField
  }
  required?: string[]
}

export type BasedSchemaPattern = string // RE ^[A-Za-z_][A-Za-z0-9_]*$

export type BasedSchemaFieldRecord = {
  type: 'record'
  items: BasedSchemaField
  propertyNames?: {
    pattern?: BasedSchemaPattern
  }
  required?: string[]
}

// return type can be typed - sort of
export type BasedSchemaField = BasedSchemaFieldShared & BasedSchemaFieldObject

export type BasedSchemaType = {
  fields: {
    [name: string]: BasedSchemaField
  }
}

// type language
export type Schema = {
  languages?: string[]
  types: {
    [type: string]: BasedSchemaType
  }
}
