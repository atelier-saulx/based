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
    error(handlers, ParseError.fieldDoesNotExist, path)
  }

  if ('customValidator' in fieldSchema) {
    const customValidator = fieldSchema.customValidator
    if (!(await customValidator(value, path, target))) {
      error(handlers, ParseError.incorrectFormat, path)
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
  let errors: {
    message: string
    code: ParseError
  }[]

  const collect: BasedSchemaCollectProps[] = []

  const x = { ...inHandlers }

  if (!('collectErrors' in x)) {
    errors = []
    x.collectErrors = (info) => {
      errors.push(info)
    }
  }

  let prevCollect: any

  if (!('collect' in x)) {
    x.collect = (info) => {
      collect.push(info)
    }
  } else {
    prevCollect = x.collect
    x.collect = (info) => {
      collect.push(info)
    }
  }

  const handlers: BasedSetHandlers = <BasedSetHandlers>x

  let type: string

  if (value.$id) {
    type = schema.prefixToTypeMapping[value.$id.slice(0, 2)]
    if (!type) {
      error(handlers, ParseError.incorrectNodeType, [value.$id])
    }
  }

  if (value.type) {
    if (type && value.type !== type) {
      error(handlers, ParseError.incorrectNodeType, [value.$id, value.type])
    }
    type = value.type
  }

  const schemaType = schema.types[type]

  if (!schemaType) {
    error(handlers, ParseError.incorrectNodeType, [type])
  }

  const target: BasedSetTarget = {
    type,
    schema,
    required: [],
    collected: [],
  }

  if (value.$language) {
    if (!schema.languages.includes(value.$language)) {
      error(handlers, ParseError.languageNotSupported, ['$language'])
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
        error(handlers, ParseError.fieldDoesNotExist, [key])
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
        error(handlers, ParseError.requiredFieldNotDefined, r)
      }
    }
  }

  if (errors?.length) {
    const err = new Error(
      'Errors in in set' +
        errors.reduce((str, info) => {
          return str + `\n - ${info.message}`
        }, '')
    )
    throw err
  }

  if (prevCollect) {
    for (const x of collect) {
      prevCollect(x)
    }
  }

  return target
}
