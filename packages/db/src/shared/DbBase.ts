import { type SchemaOut, type TypeDefs } from '@based/schema'
import { Emitter } from './Emitter.js'

export type EventMap = {
  schema: SchemaOut
}

export type Event = keyof EventMap

export type Listener<T> = (data: T) => void

export class DbShared extends Emitter {
  schema?: SchemaOut
  defs: TypeDefs = {
    byName: {},
    byId: {},
  }
}
