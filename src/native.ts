import { ENCODER } from './utils/uint8.js'
import db from './zigAddon.js'

var compressor = db.createCompressor()
var decompressor = db.createDecompressor()

export function* idGenerator(): Generator<number> {
  let i = Number.MAX_SAFE_INTEGER

  while (true) {
    if (i >= Number.MAX_SAFE_INTEGER) {
      i = 1
    } else {
      i++
    }

    yield i
  }
}

const native = {
  addMultiSubscription: (dbCtx: any, typeId: number): void => {
    return db.addMultiSubscription(dbCtx, typeId)
  },

  removeMultiSubscription: (dbCtx: any, typeId: number): void => {
    return db.removeMultiSubscription(dbCtx, typeId)
  },

  removeIdSubscription: (dbCtx: any, value: Uint8Array): void => {
    return db.removeIdSubscription(dbCtx, value)
  },

  addIdSubscription: (dbCtx: any, value: Uint8Array): void => {
    return db.addIdSubscription(dbCtx, value)
  },

  getMarkedIdSubscriptions: (dbCtx: any): ArrayBuffer | null => {
    return db.getMarkedIdSubscriptions(dbCtx)
  },

  getMarkedMultiSubscriptions: (dbCtx: any): ArrayBuffer | null => {
    return db.getMarkedMultiSubscriptions(dbCtx)
  },

  externalFromInt(address: BigInt): any {
    return db.externalFromInt(address)
  },

  intFromExternal(external: any): BigInt {
    return db.intFromExternal(external)
  },

  getQueryBufThread: (q: Uint8Array, dbCtx: any): ArrayBuffer | null => {
    const x = db.getQueryBufThread(dbCtx, q)
    return x
  },

  modifyThread: (q: Uint8Array, dbCtx: any): null => {
    const x = db.modifyThread(q, dbCtx)
    return x
  },

  start: (bridge: (id: number, payload: any) => void, nrThreads: number) => {
    return db.start(bridge, nrThreads)
  },

  stop: (dbCtx: any) => {
    return db.stop(dbCtx)
  },

  createCompressor() {
    return db.createCompressor()
  },

  compressRaw: (
    compressor: any,
    buf: Uint8Array,
    offset: number,
    stringSize: number,
  ): number => {
    if (buf.byteLength - offset < 2 * stringSize) {
      return 0
    }
    return db.compress(compressor, buf, offset, stringSize)
  },

  // buf needs to be 2x stringSize!
  compress: (buf: Uint8Array, offset: number, stringSize: number): number => {
    if (buf.byteLength - offset < 2 * stringSize) {
      return 0
    }
    return db.compress(compressor, buf, offset, stringSize)
  },

  decompressRaw: (
    decompressor: any,
    input: Uint8Array,
    output: Uint8Array,
    offset: number,
    len: number,
  ): void => {
    return db.decompress(decompressor, input, output, offset, len)
  },

  decompress: (
    input: Uint8Array,
    output: Uint8Array,
    offset: number,
    len: number,
  ): void => {
    return db.decompress(decompressor, input, output, offset, len)
  },

  crc32: (buf: Uint8Array) => {
    return db.crc32(buf)
  },

  destroySortIndex: (buf: Uint8Array, dbCtx: any) => {
    return db.destroySortIndex(dbCtx, buf)
  },

  xxHash64: (buf: Uint8Array, target: Uint8Array, index: number) => {
    return db.xxHash64(buf, target, index)
  },

  equals: (a: Uint8Array, b: Uint8Array): boolean => {
    return !!db.equals(a, b)
  },

  stringByteLength: (s: string): number => {
    return db.stringByteLength(s)
  },

  selvaStrerror: (err: number) => {
    return db.selvaStrerror(err)
  },

  selvaLangAll: (): string => {
    return db.selvaLangAll()
  },
}

global.__basedDb__native__ = native
export default native
