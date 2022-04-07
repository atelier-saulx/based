export type Listener = (val?: any) => void

class Emitter {
  constructor() {
    Object.defineProperty(this, 'listeners', {
      enumerable: false,
      writable: true,
    })
  }

  listeners: { [event: string]: Listener[] } = {}

  emit(type: string, val: any) {
    if (this.listeners[type]) {
      this.listeners[type].forEach((fn) => fn(val))
    }
  }

  on(type: string, fn: Listener) {
    if (!this.listeners[type]) {
      this.listeners[type] = []
    }
    this.listeners[type].push(fn)
  }

  removeAllListeners() {
    this.listeners = {}
  }

  once(type: string, fn: Listener) {
    this.on(type, (v) => {
      fn(v)
      this.removeListener(type, fn)
    })
  }

  removeListener(type: string, fn: Listener) {
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
      }
    }
  }
}

export default Emitter
