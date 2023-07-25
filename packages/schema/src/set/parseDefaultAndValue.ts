import { BasedSchemaFields } from '../types'
import { Parser } from './types'
import { error, ParseError } from './error'
import parsers from './parsers'

export const parseValueAndDefault: Parser<keyof BasedSchemaFields> = async (
  path,
  value,
  fieldSchema,
  typeSchema,
  target,
  handlers,
  noCollect
): Promise<boolean> => {
  let handled = false
  if (typeof value === 'object') {
    const typeDef = fieldSchema.type ?? ('enum' in fieldSchema ? 'enum' : '')
    const parse = parsers[typeDef]
    if (value.$value !== undefined) {
      // TODO: for errors handle path a bit smarter...
      await parse(
        path,
        value.$value,
        fieldSchema,
        typeSchema,
        target,
        handlers,
        true
      )
      handled = true
    }
    if (value.$default !== undefined) {
      if (value.$value !== undefined) {
        error(path, ParseError.valueAndDefault)
      }
      await parse(
        path,
        value.$default,
        fieldSchema,
        typeSchema,
        target,
        handlers,
        true
      )
      handled = true
    }
  }
  if (handled && !noCollect) {
    handlers.collect({ path, value, typeSchema, fieldSchema, target })
  }
  return handled
}
