import { Parser } from './types'
import { error, ParseError } from './error'

export const reference: Parser<'reference'> = async (
  path,
  value,
  fieldSchema,
  typeSchema,
  target,
  handlers
) => {
  // $no root
  // prob pass these as options
  // value .default
  // $value

  if (typeof value !== 'string') {
    error(path, ParseError.incorrectFormat)
  }

  if ('allowedTypes' in fieldSchema) {
    const prefix = value.slice(0, 2)
    const targetType = target.schema.prefixToTypeMapping[prefix]
    if (!targetType) {
      error(path, ParseError.referenceIsIncorrectType)
    }
    let typeMatches = false
    for (const t of fieldSchema.allowedTypes) {
      if (typeof t === 'string') {
        if (t === targetType) {
          typeMatches = true
          break
        }
      } else {
        if (t.type && t.type === targetType) {
          typeMatches = true
          if (t.$filter) {
            if (!(await handlers.referenceFilterCondition(value, t.$filter))) {
              error(path, ParseError.referenceIsIncorrectType)
            }
          }
        } else if (!t.type && t.$filter) {
          if (!(await handlers.referenceFilterCondition(value, t.$filter))) {
            error(path, ParseError.referenceIsIncorrectType)
          }
        }
      }
    }
    if (typeMatches === false) {
      error(path, ParseError.referenceIsIncorrectType)
    }
  }
  handlers.collect({ path, value, typeSchema, fieldSchema, target })
}

export const references: Parser<'references'> = async (
  path,
  value,
  fieldSchema,
  typeSchema,
  target,
  handlers
) => {
  // default
  // $no root
  if (Array.isArray(value)) {
    const handler = {
      ...handlers,
      collect: () => {},
    }
    await Promise.all(
      value.map((v, i) => {
        return reference(
          [...path, i],
          v,
          // not nice slow
          { ...fieldSchema, type: 'reference' },
          typeSchema,
          target,
          handler
        )
      })
    )
    value = { $value: value }
  } else if (typeof value === 'object') {
    if (value.$add) {
      const handler = {
        ...handlers,
        collect: () => {},
      }
      await Promise.all(
        value.$add.map((v, i) => {
          return reference(
            [...path, '$add', i],
            v,
            // not nice slow
            { ...fieldSchema, type: 'reference' },
            typeSchema,
            target,
            handler
          )
        })
      )
    }
  }
  handlers.collect({ path, value, typeSchema, fieldSchema, target })
}
