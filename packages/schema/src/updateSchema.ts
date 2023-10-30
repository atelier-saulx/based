import { BasedSchema, BasedSchemaPartial } from './types'

export const updateSchema = async (
  newSchema: BasedSchemaPartial,
  oldSchema: BasedSchema = {
    $defs: {},
    types: {},
    languages: { en: ['en'] },
    root: { fields: {} },
    prefixToTypeMapping: {},
  }
): Promise<BasedSchema> => {
  // add sha

  // put isRequired on the new schema in REQUIRED arrays

  return oldSchema
}
