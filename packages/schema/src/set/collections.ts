import { Parser } from './types'
import { error, ParseError } from './error'
import { fieldWalker } from '.'

// what about making errors return signature

export const set: Parser<'set'> = async (
  path,
  value,
  fieldSchema,
  typeSchema,
  target,
  handlers,
  noCollect
) => {
  if (value && typeof value === 'object' && value.$value) {
    value = value.$value
  }
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
    if (value.$remove) {
      for (let i = 0; i < value.$remove.length; i++) {
        q.push(
          fieldWalker(
            path,
            value.$remove[i],
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
    error(handlers, ParseError.incorrectFormat, path)
    return
  }
  const isArray = Array.isArray(value)
  if (isArray) {
    error(handlers, ParseError.incorrectFormat, path)
    return
  }
  const q: Promise<void>[] = []
  for (const key in value) {
    const propDef = fieldSchema.properties[key]
    if (!propDef) {
      error(handlers, ParseError.fieldDoesNotExist, [...path, key])
      return
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
  if (fieldSchema.required) {
    for (const req of fieldSchema.required) {
      if (!(req in value)) {
        target.required.push([...path, req])
      }
    }
  }
}

// IF REQUIRED AND PUSH OR UNSHIFT just throw here scince we dont need to parse at all...
export const array: Parser<'array'> = async (
  path,
  value,
  fieldSchema,
  typeSchema,
  target,
  handlers,
  noCollect
) => {
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
        error(handlers, ParseError.multipleOperationsNotAllowed, path)
        return
      }
      if (
        typeof value.$insert !== 'object' ||
        value.$insert.$idx === undefined
      ) {
        error(handlers, ParseError.incorrectFormat, path)
        return
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
        error(handlers, ParseError.multipleOperationsNotAllowed, path)
        return
      }
      if (value.$remove.$idx === undefined) {
        error(handlers, ParseError.incorrectFormat, path)
        return
      }
    }
    if (value.$push) {
      opCount++
      if (opCount > 1) {
        error(handlers, ParseError.multipleOperationsNotAllowed, path)
        return
      }

      // TODO: FIX PUSH PARSING
      const q: Promise<void>[] = []
      const push = Array.isArray(value.$push) ? value.$push : [value.$push]
      for (let i = 0; i < push.length; i++) {
        q.push(
          fieldWalker(
            // exception
            [...path, '$push', i],
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
        error(handlers, ParseError.multipleOperationsNotAllowed, path)
        return
      }
      const q: Promise<void>[] = []
      const unshift = Array.isArray(value.$unshift)
        ? value.$unshift
        : [value.$unshift]

      // TODO: FIX UNSHIFT PARSING
      for (let i = 0; i < unshift.length; i++) {
        q.push(
          fieldWalker(
            // exception
            [...path, '$unshift', i],
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
        error(handlers, ParseError.multipleOperationsNotAllowed, path)
        return
      }
      if (
        typeof value.$assign !== 'object' ||
        typeof value.$assign.$idx !== 'number'
      ) {
        error(handlers, ParseError.incorrectFormat, path)
        return
      }
      await fieldWalker(
        [...path, value.$assign.$idx],
        value.$assign.$value,
        fieldSchema.values,
        typeSchema,
        target,
        handlers,
        noCollect
      )
      return
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
    error(handlers, ParseError.incorrectFieldType, path)
    return
  }
  const q: Promise<void>[] = []
  const collector: any[] = []
  const nHandler = noCollect
    ? handlers
    : {
        ...handlers,
        collect: (collect) => {
          collector.push(collect)
        },
      }
  for (let i = 0; i < parsedValue.length; i++) {
    q.push(
      fieldWalker(
        [...path, i],
        parsedValue[i],
        fieldSchema.values,
        typeSchema,
        target,
        nHandler,
        noCollect
      )
    )
  }

  await Promise.all(q)

  if (!noCollect) {
    handlers.collect({
      path,
      typeSchema,
      fieldSchema,
      target,
      value: { $delete: true },
    })
    for (const c of collector) {
      handlers.collect(c)
    }
  }
}

export const record: Parser<'record'> = async (path, value, fieldSchema) => {}
