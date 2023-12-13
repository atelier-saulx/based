import {
  BasedSchemaFieldObject,
  BasedSchemaFieldRecord,
  BasedSchemaType,
  BasedSchemaTypePartial,
} from '@based/schema'
import { ExecContext, Path } from '../get'

export function joinPath(path: (string | number)[]): string {
  if (!path.length) {
    return ''
  }

  let str = `${path[0]}`

  for (let i = 1; i < path.length; i++) {
    const v = path[i]
    if (typeof v === 'number') {
      str += `[${v}]`
    } else {
      str += `.${v}`
    }
  }

  return str
}

export function aliasStrToPath(alias: string): Path {
  return alias.split('.').reduce((acc, part) => {
    if (!part.endsWith(']')) {
      acc.push(part)
      return acc
    }

    let numStr = ''
    let i: number
    for (i = part.length - 2; i >= 0; i--) {
      const c = part[i]
      if (c === '[') {
        break
      }

      numStr += c
    }

    const num = Number(numStr)
    if (!Number.isNaN(num)) {
      acc.push(part.slice(0, i))
      acc.push(num)
      return acc
    }

    acc.push(part)
    return acc
  }, [])
}

export function getTypeSchema(ctx: ExecContext, id: string): BasedSchemaType {
  const prefix = id.slice(0, 2)
  const typeName =
    prefix === 'ro' ? 'root' : ctx.client.schema.prefixToTypeMapping[prefix]
  return typeName === 'root'
    ? ctx.client.schema.root
    : ctx.client.schema.types[typeName]
}

export function pathToQuery(path: string[], value: any) {
  const result = {}
  let current = result
  for (let i = 0; i < path.length; i++) {
    current = current[path[i]] = i === path.length - 1 ? value : {}
  }
  return result
}

export function getValueByPath(
  obj: object | undefined,
  path: string | string[] | undefined
) {
  const p = typeof path === 'string' ? path.split('.') : path
  if (typeof obj === 'object') {
    if (!path.length) {
      return obj
    }
    let current = obj
    for (let i = 0; i < p.length; i++) {
      const key = p[i]
      if (!current.hasOwnProperty(key)) {
        return undefined
      }
      if (i === p.length - 1) {
        return current[key]
      }
      current = current[key]
    }
  }
  return undefined
}

export const getSchemaTypeFieldByPath = (
  type: BasedSchemaTypePartial | undefined,
  path: string[] | undefined
): any => {
  if (typeof type === 'object') {
    let currentFields = type.fields
    for (let i = 0; i < path.length; i++) {
      if (!currentFields) {
        return undefined
      }
      const fieldName = path[i]
      if (!currentFields.hasOwnProperty(fieldName)) {
        return undefined
      }
      const field = currentFields[fieldName]
      if (i === path.length - 1) {
        return field
      }
      if (field.type === 'object') {
        currentFields = (field as BasedSchemaFieldObject).properties
      }
      if (
        field.type === 'record' &&
        (field as BasedSchemaFieldRecord).values?.type === 'object'
      ) {
        currentFields = (
          (field as BasedSchemaFieldRecord).values as BasedSchemaFieldObject
        ).properties
      }
    }
  }
  return undefined
}

export const nonRecursiveWalker = (
  obj: any,
  fn: (target: any, path: string[], type: number) => void,
  targetObjects?: boolean
) => {
  if (typeof obj !== 'object') {
    return
  }
  if (typeof fn !== 'function') {
    throw new Error('fn must be a function')
  }


  const stack = new Array<[target: any, path: string[]]>()

  stack.push([obj, []])

  while (stack.length) {
    for (const key in stack[0][0]) {
      if (typeof stack[0][0][key] === 'object') {
        stack.push([stack[0][0][key], stack[0][1].concat(key)])
        if (targetObjects) {
          fn(stack[0][0][key], stack[0][1].concat(key), 1)
        }
      } else {
        fn(stack[0][0][key], stack[0][1].concat(key), 0)
      }
    }
    stack.shift()
  }
}
