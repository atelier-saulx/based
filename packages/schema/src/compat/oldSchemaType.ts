type FieldType =
  | 'float'
  | 'boolean'
  | 'number'
  | 'int'
  | 'string'
  | 'text'
  | 'id'
  | 'digest'
  | 'url'
  | 'email'
  | 'phone'
  | 'geo'
  | 'type'
  | 'timestamp'

type FieldSchemaObject = {
  type: 'object'
  properties: {
    [key: string]: FieldSchema
  }
  meta?: any
  timeseries?: boolean
}

type FieldSchemaJson = {
  type: 'json'
  properties?: {
    [key: string]: FieldSchema
  }
  meta?: any
  timeseries?: boolean
}

type FieldSchemaRecord = {
  type: 'record'
  values: FieldSchema
  meta?: any
  timeseries?: boolean
}

type FieldSchemaReferences = {
  type: 'reference' | 'references'
  bidirectional?: {
    fromField: string
  }
  meta?: any
  timeseries?: boolean
}

type FieldSchemaOther = {
  type: FieldType
  meta?: any
  timeseries?: boolean
}

type FieldSchemaArrayLike = {
  type: 'set' | 'array'
  items: FieldSchema
  meta?: any
  timeseries?: boolean
}

type FieldSchema =
  | FieldSchemaObject
  | FieldSchemaRecord
  | FieldSchemaArrayLike
  | FieldSchemaJson
  | FieldSchemaReferences
  | FieldSchemaOther

type FieldInputSchemaArrayLike = {
  type: 'set' | 'array'
  items: FieldInputSchema
  meta?: any
  timeseries?: boolean
}

type FieldInputSchemaRecord = {
  type: 'record'
  values: FieldInputSchema
  meta?: any
  timeseries?: boolean
}

type FieldInputSchemaObject = {
  type: 'object'
  properties: {
    [key: string]: FieldInputSchema
  }
  meta?: any
  timeseries?: boolean
}

type FieldInputSchema =
  | FieldSchema
  | FieldInputSchemaArrayLike
  | FieldInputSchemaRecord
  | FieldInputSchemaObject
  | DeleteField

// maybe null?

type DeleteField = { $delete: boolean }

type Fields = Record<string, FieldSchema>

type HierarchySchema =
  | false // has to be false but does not work...
  | {
      [key: string]:
        | false // has to be false but does not work...
        | { excludeAncestryWith: string[] }
        | { includeAncestryWith: string[] }
    }

type TypeSchema = {
  prefix?: string
  hierarchy?: HierarchySchema
  fields?: Fields
  meta?: any
}

type Types = { [key: string]: TypeSchema }

export type oldSchema = {
  sha?: string
  languages?: string[]
  types: Types
  rootType?: Pick<TypeSchema, 'fields' | 'prefix' | 'meta'>
  idSeedCounter?: number
  prefixToTypeMapping?: Record<string, string>
}
