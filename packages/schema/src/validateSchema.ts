import {
  BasedSchemaPartial,
  BasedSchemaFieldPartial,
  BasedSchemaTypePartial,
  BasedSchemaField,
} from './types'

// gaurd in the schema for refs in arrays

export const validateType = (
  fromSchema: BasedSchemaPartial,
  typeName: string,
  type: BasedSchemaTypePartial
) => {
  if (
    type.prefix &&
    (typeof type.prefix !== 'string' || type.prefix.length !== 2)
  ) {
    throw new Error(
      `Incorrect prefix "${type.prefix}" for type "${typeName}" has to be a string of 2 alphanumerical characters e.g. "Az", "ab", "cc", "10"`
    )
  }
}

export const validateField = (
  fromSchema: BasedSchemaPartial,
  path: string[],
  field: BasedSchemaFieldPartial
) => {
  //
}

export const validateSchema = (
  schema: BasedSchemaPartial
): BasedSchemaPartial => {
  // rewrite schema things like required / required: []

  if (typeof schema !== 'object') {
    throw new Error('Schema is not an object')
  }

  if (schema.languages && !Array.isArray(schema.languages)) {
    throw new Error('Languages needs to be an array')
  }

  if (schema.$defs) {
    // first defs ofc
  }

  if (schema.root) {
    validateType(schema, 'root', schema.root)
  }

  if (schema.types) {
    for (const type in schema.types) {
      validateType(schema, type, schema.types[type])
    }
  }

  return schema
}
