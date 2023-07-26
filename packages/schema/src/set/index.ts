import {
  BasedSchemaField,
  BasedSchemaType,
  BasedSetHandlers,
  BasedSchema,
  BasedSetTarget,
  BasedSchemaCollectProps,
  BasedSetOptionalHandlers,
} from '../types'
import { error, ParseError } from './error'
import parsers from './parsers'
import { SetOptional } from 'type-fest'

export const fieldWalker = async (
  path: (string | number)[],
  value: any,
  fieldSchema: BasedSchemaField,
  typeSchema: BasedSchemaType,
  target: BasedSetTarget,
  handlers: BasedSetHandlers,
  noCollect?: boolean
): Promise<void> => {
  if ('$ref' in fieldSchema) {
    // TODO: when we have this it has to get it from the schema and redo the parsing with the correct fieldSchema
    return
  }
  const valueType = typeof value

  const valueIsObject = value && valueType === 'object'
  if (valueIsObject && value.$delete === true) {
    if (!noCollect) {
      handlers.collect({ path, value, typeSchema, fieldSchema, target })
    }
    return
  }

  const typeDef = fieldSchema.type ?? ('enum' in fieldSchema ? 'enum' : '')

  if (!typeDef) {
    error(path, ParseError.fieldDoesNotExist)
  }

  if ('customValidator' in fieldSchema) {
    const customValidator = fieldSchema.customValidator
    if (!(await customValidator(value, path, target))) {
      error(path, ParseError.incorrectFormat)
    }
  }

  const parse = parsers[typeDef]

  await parse(path, value, fieldSchema, typeSchema, target, handlers, noCollect)

  return
}

export const setWalker = async (
  schema: BasedSchema,
  value: { [key: string]: any },
  inHandlers: BasedSetOptionalHandlers
): Promise<BasedSetTarget> => {
  let errors: (BasedSchemaCollectProps & {
    message: string
    code: ParseError
  })[]

  if (!('collectErrors' in inHandlers)) {
    errors = []
    inHandlers.collectErrors = (info) => {
      errors.push(info)
    }
  }

  const handlers: BasedSetHandlers = <BasedSetHandlers>inHandlers

  let type: string

  if (value.$id) {
    type = schema.prefixToTypeMapping[value.$id.slice(0, 2)]
    if (!type) {
      error([value.$id], ParseError.incorrectNodeType)
    }
  }

  if (value.type) {
    if (type && value.type !== type) {
      error([value.$id, value.type], ParseError.incorrectNodeType)
    }
    type = value.type
  }

  const schemaType = schema.types[type]

  if (!schemaType) {
    error([type], ParseError.incorrectNodeType)
  }

  const target: BasedSetTarget = {
    type,
    schema,
    required: [],
  }

  if (value.$language) {
    if (!schema.languages.includes(value.$language)) {
      error(['$language'], ParseError.languageNotSupported)
    }
    target.$language = value.$language
  }

  if (value.$id) {
    target.$id = value.$id
  } else if (value.$alias) {
    target.$alias = value.$alias
  }

  const q: Promise<void>[] = []

  for (const key in value) {
    if (key[0] !== '$' && key !== 'type') {
      const fieldSchema = schemaType.fields[key]
      if (!fieldSchema) {
        error([key], ParseError.fieldDoesNotExist)
      } else {
        q.push(
          fieldWalker(
            [key],
            value[key],
            fieldSchema,
            schemaType,
            target,
            handlers
          )
        )
      }
    }
  }

  await Promise.all(q)

  if (schemaType.required) {
    for (const req of schemaType.required) {
      if (!(req in value)) {
        target.required.push([req])
      }
    }
  }

  if (target.required?.length) {
    const requireDefined = await Promise.all(
      target.required.map(async (req) => {
        return handlers.checkRequiredFields(req)
      })
    )
    for (let i = 0; i < requireDefined.length; i++) {
      if (!requireDefined[i]) {
        const r = target.required[i]
        error(r, ParseError.requiredFieldNotDefined)
      }
    }
  }

  if (errors?.length) {
    // hold collect or nah?
    throw new Error(
      'Got some errors ' +
        errors.reduce((str, info) => {
          return str + `\n - ${info.path.join('')} ${info.message}`
        }, '')
    )
  }

  return target
}
