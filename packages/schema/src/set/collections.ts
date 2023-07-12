import { Parser } from './types'
import { error, ParseError } from './error'
import { fieldWalker } from '.'

export const set: Parser<'set'> = async (
  path,
  value,
  fieldSchema,
  typeSchema,
  target,
  handlers
) => {
  const q: Promise<void>[] = []
  const fieldDef = fieldSchema.items
  if (Array.isArray(value)) {
    const handlerNest = {
      ...handlers,
      collect: ({ value }) => {
        parsedArray.push(value)
      },
    }
    const parsedArray = []
    for (let i = 0; i < value.length; i++) {
      q.push(
        fieldWalker(
          [...path, i],
          value[i],
          fieldDef,
          typeSchema,
          target,
          handlerNest
        )
      )
    }
    await Promise.all(q)
    handlers.collect({
      path,
      value: { $value: parsedArray },
      typeSchema,
      fieldSchema,
      target,
    })
  } else {
    const handlerNest = {
      ...handlers,
      collect: () => {},
    }
    if (value.$add) {
      for (let i = 0; i < value.$add.length; i++) {
        q.push(
          fieldWalker(
            [...path, '$add', i],
            value.$add[i],
            fieldDef,
            typeSchema,
            target,
            handlerNest
          )
        )
      }
    }
    if (value.$delete) {
      for (let i = 0; i < value.$add.length; i++) {
        q.push(
          fieldWalker(
            [...path, '$delete', i],
            value.$delete[i],
            fieldDef,
            typeSchema,
            target,
            handlerNest
          )
        )
      }
    }
    await Promise.all(q)
    handlers.collect({ path, value, typeSchema, fieldSchema, target })
  }
}

export const object: Parser<'object'> = async (
  path,
  value,
  fieldSchema,
  typeSchema,
  target,
  handlers
) => {
  if (typeof value !== 'object') {
    error(path, ParseError.incorrectFormat)
  }
  const isArray = Array.isArray(value)
  if (isArray) {
    error(path, ParseError.incorrectFormat)
  }
  const q: Promise<void>[] = []
  for (const key in value) {
    const propDef = fieldSchema.properties[key]
    if (!propDef) {
      error([...path, key], ParseError.fieldDoesNotExist)
    }
    q.push(
      fieldWalker(
        [...path, key],
        value[key],
        propDef,
        typeSchema,
        target,
        handlers
      )
    )
  }
  await Promise.all(q)
}

export const array: Parser<'array'> = async (
  path,
  value,
  fieldSchema,
  typeSchema,
  target,
  handlers
) => {
  const isArray = Array.isArray(value)
  if (typeof value === 'object' && !isArray) {
    if (value.$insert) {
      if (
        typeof value.$insert !== 'object' ||
        value.$insert.$idx === undefined
      ) {
        error([...path, '$insert'], ParseError.incorrectFormat)
      } else {
        const nestedHandler = {
          ...handlers,
          collect: () => {},
        }
        const q: Promise<void>[] = []
        if (Array.isArray(value.$insert.$value)) {
          for (let i = 0; i < value.$insert.$value.length; i++) {
            q.push(
              fieldWalker(
                [...path, 'insert', i],
                value.$insert.$value[i],
                fieldSchema.values,
                typeSchema,
                target,
                nestedHandler
              )
            )
          }
        } else {
          q.push(
            fieldWalker(
              [...path, '$insert'],
              value.$insert.$value,
              fieldSchema.values,
              typeSchema,
              target,
              nestedHandler
            )
          )
        }
        await Promise.all(q)
      }
    }
    if (value.$remove && value.$remove.$idx === undefined) {
      error([...path, '$remove'], ParseError.incorrectFormat)
    }
    if (value.$push) {
      const q: Promise<void>[] = []
      const nestedHandler = {
        ...handlers,
        collect: () => {},
      }
      if (Array.isArray(value.$push)) {
        for (let i = 0; i < value.$push.length; i++) {
          q.push(
            fieldWalker(
              [...path, i],
              value.$push[i],
              fieldSchema.values,
              typeSchema,
              target,
              nestedHandler
            )
          )
        }
      } else {
        q.push(
          fieldWalker(
            [...path, '$push'],
            value.$push,
            fieldSchema.values,
            typeSchema,
            target,
            nestedHandler
          )
        )
      }
      await Promise.all(q)
    }
    if (value.$assign) {
      if (
        typeof value.$assign !== 'object' ||
        value.$assign.$idx === undefined
      ) {
        error([...path, '$assign'], ParseError.incorrectFormat)
      } else {
        await fieldWalker(
          [...path, '$assign', '$value'],
          value.$assign.$value,
          fieldSchema.values,
          typeSchema,
          target,
          {
            ...handlers,
            collect: () => {},
          }
        )
      }
    }
    handlers.collect({ path, value, typeSchema, fieldSchema, target })
    return
  }

  if (!isArray) {
    error(path, ParseError.incorrectFieldType)
  }

  const q: Promise<void>[] = []
  for (let i = 0; i < value.length; i++) {
    q.push(
      fieldWalker(
        [...path, i],
        value[i],
        fieldSchema.values,
        typeSchema,
        target,
        handlers
      )
    )
  }
  await Promise.all(q)
}

export const record: Parser<'record'> = async (path, value, fieldSchema) => {}
