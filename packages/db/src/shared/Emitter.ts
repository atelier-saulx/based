import type { DbSchema } from '@based/schema'

export type EventMap = {
  schema: DbSchema
  info: string
  error: string
}

export type Event = keyof EventMap

export type Listener<T> = (data: T) => void

export class Emitter {
  listeners: {
    [E in Event]?: Listener<EventMap[E]>[]
  } = {}

  emit<E extends Event>(type: E, val: EventMap[E]) {
    if (this.listeners[type]) {
      const lis = this.listeners[type]
      for (let i = 0, len = lis.length; i < lis.length; i++) {
        const fn = lis[i]
        // @ts-ignore
        fn(val)
        if (len > lis.length) {
          if (lis[i] !== fn) {
            i--
            len = lis.length
          }
        }
      }
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
    fn?: Listener<EventMap[E]>,
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
    // TODO: optmize this
    const listener = () => {
      this.off(type, listener)
      this.off(type, fn)
    }
    this.on(type, fn)
    this.on(type, listener)
  }

  off<E extends Event>(type: E, fn?: Listener<EventMap[E]>) {
    const listeners = this.listeners[type]
    if (listeners) {
      if (!fn) {
        delete this.listeners[type]
      } else {
        for (let i = 0; i < listeners.length; i++) {
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
