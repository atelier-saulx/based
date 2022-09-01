import { Auth } from './auth'

export type EventMap = {
  reconnect: true
  disconnect: true
  connect: true
  debug: {
    type: string
    direction: 'up' | 'down'
    binary?: Uint8Array
    data: any
  }
  auth: Auth
}

export type Event = keyof EventMap

export type Listener<T> = (data?: T) => void
