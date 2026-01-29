import native from '../native.js'
import {
  writeDoubleLE,
  writeFloatLE,
  writeUint64,
  writeInt64,
} from './index.js'

const ENCODER = new TextEncoder()

// Runtime method injection
const delegateMethods = [
  'toString',
  'toLocaleString',
  'join',
  'indexOf',
  'lastIndexOf',
  'includes',
  'every',
  'some',
  'forEach',
  'map',
  'filter',
  'find',
  'findIndex',
  'reduce',
  'reduceRight',
  'entries',
  'keys',
  'values',
] as const

export class AutoSizedUint8Array {
  static readonly ERR_OVERFLOW = 1

  data: Uint8Array
  length: number
  private readonly _maxCapacity: number

  constructor(
    initialCapacity: number = 256,
    maxCapacity: number = 1024 * 1024 * 1024,
  ) {
    const buffer = new (ArrayBuffer as any)(initialCapacity, {
      maxByteLength: maxCapacity,
    })
    this.data = new Uint8Array(buffer)
    this.length = 0
    this._maxCapacity = maxCapacity
  }

  private ensure(requiredCapacity: number): void {
    const currentCapacity = this.data.byteLength
    if (currentCapacity >= requiredCapacity) return
    if (requiredCapacity > this._maxCapacity) {
      throw AutoSizedUint8Array.ERR_OVERFLOW
    }

    // Manual Max for speed
    const doubleCapacity = currentCapacity * 2
    const newCapacity =
      requiredCapacity > doubleCapacity ? requiredCapacity : doubleCapacity
    // Cap at maxCapacity
    const finalCapacity =
      newCapacity > this._maxCapacity ? this._maxCapacity : newCapacity

    ;(this.data.buffer as any).resize(finalCapacity)
  }

  get view(): Uint8Array {
    return this.data.subarray(0, this.length)
  }

  set(array: ArrayLike<number>, offset: number = 0): void {
    const end = offset + array.length
    if (end > this.data.length) {
      this.ensure(end)
    }
    this.data.set(array, offset)
    if (end > this.length) this.length = end
  }

  fill(value: number, start: number = 0, end: number = this.length): this {
    if (end > this.length) {
      if (end > this.data.length) {
        this.ensure(end)
      }
      this.length = end
    }
    this.data.fill(value, start, end)
    return this
  }

  get(index: number): number | undefined {
    return index < this.length ? this.data[index] : undefined
  }

  pushUint8(value: number): void {
    const end = this.length + 1
    if (end > this.data.length) {
      this.ensure(end)
    }
    this.data[this.length] = value
    this.length = end
  }

  writeUint8(value: number, offset: number): void {
    const end = offset + 1
    if (end > this.data.length) {
      this.ensure(end)
    }
    this.data[offset] = value
    if (end > this.length) this.length = end
  }

  pushUint16(value: number): void {
    const end = this.length + 2
    if (end > this.data.length) {
      this.ensure(end)
    }
    this.data[this.length] = value
    this.data[this.length + 1] = value >> 8
    this.length = end
  }

  writeUint16(value: number, offset: number): void {
    const end = offset + 2
    if (end > this.data.length) {
      this.ensure(end)
    }
    this.data[offset] = value
    this.data[offset + 1] = value >> 8
    if (end > this.length) this.length = end
  }

  pushUint32(value: number): void {
    const end = this.length + 4
    if (end > this.data.length) {
      this.ensure(end)
    }
    this.data[this.length] = value
    this.data[this.length + 1] = value >> 8
    this.data[this.length + 2] = value >> 16
    this.data[this.length + 3] = value >> 24
    this.length = end
  }

  pushDoubleLE(value: number): void {
    const end = this.length + 8
    if (end > this.data.length) {
      this.ensure(end)
    }
    writeDoubleLE(this.data, value, this.length)
    this.length = end
  }

  pushFloatLE(value: number): void {
    const end = this.length + 4
    if (end > this.data.length) {
      this.ensure(end)
    }
    writeFloatLE(this.data, value, this.length)
    this.length = end
  }

  pushUint64(value: number): void {
    const end = this.length + 8
    if (end > this.data.length) {
      this.ensure(end)
    }
    writeUint64(this.data, value, this.length)
    this.length = end
  }

  pushInt64(value: number): void {
    const end = this.length + 8
    if (end > this.data.length) {
      this.ensure(end)
    }
    writeInt64(this.data, value, this.length)
    this.length = end
  }

  pushString(value: string): number {
    const maxBytes = native.stringByteLength(value)
    const end = this.length + maxBytes
    if (end > this.data.length) {
      this.ensure(end)
    }
    const { written } = ENCODER.encodeInto(
      value,
      this.data.subarray(this.length),
    )
    this.length += written
    return written
  }

  writeUint32(value: number, offset: number): void {
    const end = offset + 4
    if (end > this.data.length) {
      this.ensure(end)
    }
    this.data[offset] = value
    this.data[offset + 1] = value >> 8
    this.data[offset + 2] = value >> 16
    this.data[offset + 3] = value >> 24
    if (end > this.length) this.length = end
  }

  writeUint64(value: number, offset: number): void {
    const requiredEnd = offset + 8
    if (requiredEnd > this.data.length) {
      this.ensure(requiredEnd)
    }
    writeUint64(this.data, value, offset)
    if (requiredEnd > this.length) this.length = requiredEnd
  }

  reserveUint32(): number {
    const index = this.length
    const end = index + 4
    if (end > this.data.length) {
      this.ensure(end)
    }
    this.length = end
    return index
  }

  reserveUint64(): number {
    const index = this.length
    const end = index + 8
    if (end > this.data.length) {
      this.ensure(end)
    }
    this.length = end
    return index
  }

  // Core array methods restored for type safety and performance
  push(byte: number): void {
    return this.pushUint8(byte)
  }

  subarray(begin: number = 0, end: number = this.length): Uint8Array {
    return this.view.subarray(begin, end)
  }

  slice(start?: number, end?: number): Uint8Array {
    return this.view.slice(start, end)
  }
}

// Methods delegated to the underlying Uint8Array view
type DelegatedProps = (typeof delegateMethods)[number]

export interface AutoSizedUint8Array extends Pick<Uint8Array, DelegatedProps> {
  [Symbol.iterator](): IterableIterator<number>
  reverse(): this
  sort(compareFn?: (a: number, b: number) => number): this
}

// Runtime method injection
for (const method of delegateMethods) {
  ;(AutoSizedUint8Array.prototype as any)[method] = function (
    this: AutoSizedUint8Array,
    ...args: any[]
  ) {
    return (this.view as any)[method](...args)
  }
}

const mutatingDelegateMethods = ['reverse', 'sort']
for (const method of mutatingDelegateMethods) {
  ;(AutoSizedUint8Array.prototype as any)[method] = function (
    this: AutoSizedUint8Array,
    ...args: any[]
  ) {
    ;(this.view as any)[method](...args)
    return this
  }
}

;(AutoSizedUint8Array.prototype as any)[Symbol.iterator] = function (
  this: AutoSizedUint8Array,
) {
  return this.view[Symbol.iterator]()
}
