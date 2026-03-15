import type { SchemaOut } from '../schema/index.js'
import { Emitter } from './Emitter.js'

export type EventMap = {
  schema: SchemaOut
}

export type Event = keyof EventMap

export type Listener<T> = (data: T) => void

export class DbShared extends Emitter {
  schema?: SchemaOut
}
