import { SchemaTypeDef } from '@based/schema/def'
import { SchemaOut } from '@based/schema'
import { Emitter } from './Emitter.js'

export type EventMap = {
  schema: SchemaOut
}

export type Event = keyof EventMap

export type Listener<T> = (data: T) => void

export class DbShared extends Emitter {
  schema?: SchemaOut
  schemaTypesParsed?: Record<string, SchemaTypeDef> = {}
  schemaTypesParsedById?: Record<number, SchemaTypeDef> = {}
}
