import { ClientAuthState as AuthState } from './auth.js'

export type EventMap = {
  reconnect: true
  disconnect: true
  connect: true
  'authstate-change': AuthState
}

export type Event = keyof EventMap

export type Listener<T> = (data: T) => void
