import { QueryDef } from './types.js'
import { SchemaTypesParsed } from '@based/schema/def'

const walk = (q: any) => {
  const obj: any = {}
  for (const key in q) {
    if (key === 'schema') {
      obj[key] = q[key].type
    } else {
      // if PROPDEF
      if (typeof q[key] === 'object') {
        obj[key] = walk(q[key])
      } else {
        obj[key] = q[key]
      }
    }
  }
  return obj
}

export const serialize = (q: QueryDef): string => {
  const obj = walk(q)
  return JSON.stringify(obj)
}

export const parse = (str: string, parsedSchema: SchemaTypesParsed) => {
  //
}
