import native from '../../native.js'
import {
  writeDoubleLE,
  writeFloatLE,
  writeUint64,
  writeInt64,
} from '../../utils/index.js'

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

  private ensureCapacity(requiredCapacity: number): void {
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
    const requiredEnd = offset + array.length
    if (requiredEnd > this.data.length) {
      this.ensureCapacity(requiredEnd)
    }
    this.data.set(array, offset)
    if (requiredEnd > this.length) this.length = requiredEnd
  }

  flush(): void {
    this.length = 0
  }

  fill(value: number, start: number = 0, end: number = this.length): this {
    if (end > this.length) {
      if (end > this.data.byteLength) {
        this.ensureCapacity(end)
      }
      this.length = end
    }
    this.data.fill(value, start, end)
    return this
  }

  copyWithin(target: number, start: number, end: number = this.length): this {
    // Calculate required size conservatively if indices are positive
    if (target >= 0 && start >= 0 && end >= 0 && end > start) {
      const count = end - start
      const requiredEnd = target + count
      if (requiredEnd > this.data.byteLength) {
        this.ensureCapacity(requiredEnd)
      }
      if (requiredEnd > this.length) {
        this.length = requiredEnd
      }
    }
    this.data.copyWithin(target, start, end)
    return this
  }

  get(index: number): number | undefined {
    return index >= 0 && index < this.length ? this.data[index] : undefined
  }

  pushU8(value: number): void {
    const requiredEnd = this.length + 1
    if (requiredEnd > this.data.length) {
      this.ensureCapacity(requiredEnd)
    }
    this.data[this.length] = value
    this.length = requiredEnd
  }

  setU8(value: number, offset: number): void {
    const requiredEnd = offset + 1
    if (requiredEnd > this.data.length) {
      this.ensureCapacity(requiredEnd)
    }
    this.data[offset] = value
    if (requiredEnd > this.length) this.length = requiredEnd
  }

  pushU16(value: number): void {
    const requiredEnd = this.length + 2
    if (requiredEnd > this.data.length) {
      this.ensureCapacity(requiredEnd)
    }
    this.data[this.length] = value
    this.data[this.length + 1] = value >> 8
    this.length = requiredEnd
  }

  setU16(value: number, offset: number): void {
    const requiredEnd = offset + 2
    if (requiredEnd > this.data.length) {
      this.ensureCapacity(requiredEnd)
    }
    this.data[offset] = value
    this.data[offset + 1] = value >> 8
    if (requiredEnd > this.length) this.length = requiredEnd
  }

  pushU32(value: number): void {
    const requiredEnd = this.length + 4
    if (requiredEnd > this.data.length) {
      this.ensureCapacity(requiredEnd)
    }
    this.data[this.length] = value
    this.data[this.length + 1] = value >> 8
    this.data[this.length + 2] = value >> 16
    this.data[this.length + 3] = value >> 24
    this.length = requiredEnd
  }

  pushDouble(value: number): void {
    const requiredEnd = this.length + 8
    if (requiredEnd > this.data.length) {
      this.ensureCapacity(requiredEnd)
    }
    writeDoubleLE(this.data, value, this.length)
    this.length = requiredEnd
  }

  pushF32(value: number): void {
    const requiredEnd = this.length + 4
    if (requiredEnd > this.data.length) {
      this.ensureCapacity(requiredEnd)
    }
    writeFloatLE(this.data, value, this.length)
    this.length = requiredEnd
  }

  pushU64(value: number): void {
    const requiredEnd = this.length + 8
    if (requiredEnd > this.data.length) {
      this.ensureCapacity(requiredEnd)
    }
    writeUint64(this.data, value, this.length)
    this.length = requiredEnd
  }

  pushI64(value: number): void {
    const requiredEnd = this.length + 8
    if (requiredEnd > this.data.length) {
      this.ensureCapacity(requiredEnd)
    }
    writeInt64(this.data, value, this.length)
    this.length = requiredEnd
  }

  pushString(value: string): number {
    const maxBytes = native.stringByteLength(value)
    const requiredEnd = this.length + maxBytes
    if (requiredEnd > this.data.length) {
      this.ensureCapacity(requiredEnd)
    }
    const { written } = ENCODER.encodeInto(
      value,
      this.data.subarray(this.length),
    )
    this.length += written!
    return written
  }

  setU32(value: number, offset: number): void {
    const requiredEnd = offset + 4
    if (requiredEnd > this.data.length) {
      this.ensureCapacity(requiredEnd)
    }
    this.data[offset] = value
    this.data[offset + 1] = value >> 8
    this.data[offset + 2] = value >> 16
    this.data[offset + 3] = value >> 24
    if (requiredEnd > this.length) this.length = requiredEnd
  }

  reserveU32(): number {
    const index = this.length
    const requiredEnd = index + 4
    if (requiredEnd > this.data.length) {
      this.ensureCapacity(requiredEnd)
    }
    this.length = requiredEnd
    return index
  }

  reserveU64(): number {
    const index = this.length
    const requiredEnd = index + 8
    if (requiredEnd > this.data.length) {
      this.ensureCapacity(requiredEnd)
    }
    this.length = requiredEnd
    return index
  }

  setSizeU32(start: number) {
    this.setU32(this.length - start - 4, start)
  }

  // Core array methods restored for type safety and performance
  push(byte: number): void {
    return this.pushU8(byte)
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
