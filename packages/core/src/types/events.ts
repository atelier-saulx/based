import { Schema } from './schema'
import { Auth } from './auth'

export type EventMap = {
  connect: boolean
  debug: {
    type: string
    direction: 'up' | 'down'
    binary: Uint8Array
    data: any
  }
  auth: Auth
  schema: Schema
}

export type Event = keyof EventMap
