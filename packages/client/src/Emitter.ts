import { EventMap, Event, Listener } from './types'

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

  on<E extends Event>(type: E, fn: Listener<EventMap[E]>) {
    if (!this.listeners[type]) {
      this.listeners[type] = []
    }
    this.listeners[type].push(fn)
  }

  removeAllListeners() {
    this.listeners = {}
  }

  once<E extends Event>(type: E): Promise<EventMap[E]>

  once<E extends Event>(type: E, fn: Listener<EventMap[E]>): void

  once<E extends Event>(
    type: E,
    fn?: Listener<EventMap[E]>
  ): Promise<EventMap[E]> | void {
    if (!fn) {
      return new Promise((resolve) => {
        const listener = (v: EventMap[E]) => {
          resolve(v)
          this.off(type, listener)
        }
        this.on(type, listener)
      })
    }
    const listener = (v: EventMap[E]) => {
      fn(v)
      this.off(type, listener)
    }
    this.on(type, listener)
  }

  off<E extends Event>(type: E, fn?: Listener<EventMap[E]>) {
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
