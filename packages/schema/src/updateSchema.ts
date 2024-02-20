import { BasedSchema, BasedSchemaPartial } from './types.js'

export const updateSchema = async (
  _newSchema: BasedSchemaPartial,
  oldSchema: BasedSchema = {
    $defs: {},
    types: {},
    language: 'en',
    root: { fields: {} },
    prefixToTypeMapping: {},
  }
): Promise<BasedSchema> => {
  // add sha

  // put isRequired on the new schema in REQUIRED arrays

  return oldSchema
}
