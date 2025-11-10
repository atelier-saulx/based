import { object, record, string } from 'valibot'
import { type } from './type.js'

export const schema = object({
  types: record(string(), type),
})
