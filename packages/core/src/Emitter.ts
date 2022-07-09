import { EventMap, Event } from './types'

export type Listener<T> = (data: T) => void

class Emitter {
  constructor() {
    Object.defineProperty(this, 'listeners', {
      enumerable: false,
      writable: true,
    })
  }

  listeners: {
    [E in Event]?: Listener<EventMap[E]>[]
  } = {}

  emit(type: Event, val: EventMap[Event]) {
    if (this.listeners[type]) {
      this.listeners[type].forEach((fn) => fn(val))
    }
  }

  on(type: Event, fn: Listener<EventMap[Event]>) {
    if (!this.listeners[type]) {
      this.listeners[type] = []
    }
    this.listeners[type].push(fn)
  }

  removeAllListeners() {
    this.listeners = {}
  }

  once(type: Event, fn: Listener<EventMap[Event]>) {
    this.on(type, (v) => {
      fn(v)
      this.off(type, fn)
    })
  }

  off(type: Event, fn: Listener<EventMap[Event]>) {
    const listeners = this.listeners[type]
    if (listeners) {
      if (!fn) {
        delete this.listeners[type]
      } else {
        for (let i = 0, len = listeners.length; i < len; i++) {
          if (listeners[i] === fn) {
            listeners.splice(i, 1)
            break
          }
        }
        if (listeners.length === 0) {
          delete this.listeners[type]
        }
      }
    }
  }
}

export default Emitter
