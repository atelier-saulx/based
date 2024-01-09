import {
  BasedSchemaPartial,
  BasedSchemaFieldPartial,
  BasedSchemaTypePartial,
} from './types.js'

// gaurd in the schema for refs in arrays

export const validateType = (
  _fromSchema: BasedSchemaPartial,
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
  _fromSchema: BasedSchemaPartial,
  _path: string[],
  _field: BasedSchemaFieldPartial
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

  if (schema.language && typeof schema.language !== 'string') {
    throw new Error('Language must be a string')
  }

  if (schema.translations && !Array.isArray(schema.translations)) {
    throw new Error('Translations needs to be an array')
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
