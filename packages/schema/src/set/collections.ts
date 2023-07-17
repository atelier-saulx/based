import { Parser } from './types'
import { error, ParseError } from './error'
import { fieldWalker } from '.'

export const set: Parser<'set'> = async (
  path,
  value,
  fieldSchema,
  typeSchema,
  target,
  handlers,
  noCollect
) => {
  const q: Promise<void>[] = []
  const fieldDef = fieldSchema.items
  if (Array.isArray(value)) {
    const parsedArray = []
    for (let i = 0; i < value.length; i++) {
      q.push(
        fieldWalker([...path, i], value[i], fieldDef, typeSchema, target, {
          ...handlers,
          collect: ({ value }) => {
            parsedArray.push(value)
          },
        })
      )
    }
    await Promise.all(q)
    if (!noCollect) {
      handlers.collect({
        path,
        value: { $value: parsedArray },
        typeSchema,
        fieldSchema,
        target,
      })
    }
  } else {
    if (value.$add) {
      for (let i = 0; i < value.$add.length; i++) {
        q.push(
          fieldWalker(
            path,
            value.$add[i],
            fieldDef,
            typeSchema,
            target,
            handlers,
            true
          )
        )
      }
    }
    if (value.$delete) {
      for (let i = 0; i < value.$add.length; i++) {
        q.push(
          fieldWalker(
            path,
            value.$delete[i],
            fieldDef,
            typeSchema,
            target,
            handlers,
            true
          )
        )
      }
    }
    await Promise.all(q)
    if (!noCollect) {
      handlers.collect({ path, value, typeSchema, fieldSchema, target })
    }
  }
}

export const object: Parser<'object'> = async (
  path,
  value,
  fieldSchema,
  typeSchema,
  target,
  handlers,
  noCollect
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
        handlers,
        noCollect
      )
    )
  }
  await Promise.all(q)
}

// unshift // only allow 1 command
export const array: Parser<'array'> = async (
  path,
  value,
  fieldSchema,
  typeSchema,
  target,
  handlers,
  noCollect
) => {
  // $value

  let isArray = Array.isArray(value)
  let parsedValue = value
  let opCount = 0
  let has$Value = false
  if (typeof parsedValue === 'object' && !isArray) {
    if (value.$value) {
      opCount++
      has$Value = true
      parsedValue = value.$value
      isArray = Array.isArray(parsedValue)
    }
    if (value.$insert) {
      opCount++
      if (opCount > 1) {
        error(path, ParseError.multipleOperationsNotAllowed)
      }
      if (
        typeof value.$insert !== 'object' ||
        value.$insert.$idx === undefined
      ) {
        error(path, ParseError.incorrectFormat)
      } else {
        const insert = Array.isArray(value.$insert.$value)
          ? value.$insert.$value
          : [value.$insert.$value]
        const q: Promise<void>[] = []
        for (let i = 0; i < insert.length; i++) {
          q.push(
            fieldWalker(
              path,
              insert[i],
              fieldSchema.values,
              typeSchema,
              target,
              handlers,
              true
            )
          )
        }
        await Promise.all(q)
      }
    }
    if (value.$remove) {
      opCount++
      if (opCount > 1) {
        error(path, ParseError.multipleOperationsNotAllowed)
      }
      if (value.$remove.$idx === undefined) {
        error(path, ParseError.incorrectFormat)
      }
    }
    if (value.$push) {
      opCount++
      if (opCount > 1) {
        error(path, ParseError.multipleOperationsNotAllowed)
      }

      const q: Promise<void>[] = []
      const push = Array.isArray(value.$push) ? value.$push : [value.$push]
      for (let i = 0; i < push.length; i++) {
        q.push(
          fieldWalker(
            path,
            push[i],
            fieldSchema.values,
            typeSchema,
            target,
            handlers,
            true
          )
        )
      }
      await Promise.all(q)
      parsedValue = { $push: push }
    }
    if (value.$unshift) {
      opCount++
      if (opCount > 1) {
        error(path, ParseError.multipleOperationsNotAllowed)
      }
      const q: Promise<void>[] = []
      const unshift = Array.isArray(value.$unshift)
        ? value.$unshift
        : [value.$unshift]
      for (let i = 0; i < unshift.length; i++) {
        q.push(
          fieldWalker(
            path,
            unshift[i],
            fieldSchema.values,
            typeSchema,
            target,
            handlers,
            true
          )
        )
      }
      await Promise.all(q)
      parsedValue = { $unshift: unshift }
    }
    if (value.$assign) {
      opCount++
      if (opCount > 1) {
        error(path, ParseError.multipleOperationsNotAllowed)
      }
      if (
        typeof value.$assign !== 'object' ||
        value.$assign.$idx === undefined
      ) {
        error(path, ParseError.incorrectFormat)
      } else {
        await fieldWalker(
          path,
          value.$assign.$value,
          fieldSchema.values,
          typeSchema,
          target,
          handlers,
          true
        )
      }
    }
    if (!has$Value && !noCollect) {
      handlers.collect({
        path,
        value: parsedValue,
        typeSchema,
        fieldSchema,
        target,
      })
    }
    if (!has$Value) {
      return
    }
  }
  if (!isArray) {
    error(path, ParseError.incorrectFieldType)
  }
  const q: Promise<void>[] = []
  for (let i = 0; i < parsedValue.length; i++) {
    q.push(
      fieldWalker(
        [...path, i],
        parsedValue[i],
        fieldSchema.values,
        typeSchema,
        target,
        handlers,
        noCollect
      )
    )
  }
  await Promise.all(q)
}

export const record: Parser<'record'> = async (path, value, fieldSchema) => {}
