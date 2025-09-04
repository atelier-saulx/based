import { SchemaTypeDef } from '@based/schema/def'
import { DbSchema } from '@based/schema'
import { Emitter } from './Emitter.js'

export type EventMap = {
  schema: DbSchema
}

export type Event = keyof EventMap

export type Listener<T> = (data: T) => void

export class DbShared extends Emitter {
  schema?: DbSchema
  schemaTypesParsed?: Record<string, SchemaTypeDef> = {}
  schemaTypesParsedById?: Record<number, SchemaTypeDef> = {}
}
