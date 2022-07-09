import { Auth } from './auth'

export type EventMap = {
  connection: boolean
  debug: {
    type: string
    direction: 'up' | 'down'
    binary: Uint8Array
    data: any
  }
  auth: Auth
}

export type Event = keyof EventMap

export type Listener<T> = (data: T) => void
