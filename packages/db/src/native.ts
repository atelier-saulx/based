// @ts-ignore
import db from '@based/db/native'
import { DECODER } from '@based/utils'

const selvaIoErrlog = new Uint8Array(256)
var compressor = db.createCompressor()
var decompressor = db.createDecompressor()

function SelvaIoErrlogToString(buf: Uint8Array) {
  let i: number
  let len = (i = buf.indexOf(0)) >= 0 ? i : buf.byteLength
  return DECODER.decode(selvaIoErrlog.slice(0, len))
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

  start: (bridge: (id: number, payload: any) => void) => {
    return db.start(bridge)
  },

  stop: (dbCtx: any) => {
    return db.stop(dbCtx)
  },

  setSchemaIds: (ids: Uint32Array, dbCtx: any) => {
    return db.setSchemaIds(ids, dbCtx)
  },

  getSchemaIds: (dbCtx: any): Uint32Array => {
    return new Uint32Array(db.getSchemaIds(dbCtx))
  },

  createCompressor() {
    return db.createCompressor()
  },

  compressRaw: (
    compressor: any,
    buf: Uint8Array,
    offset: number,
    stringSize: number,
  ) => {
    return db.compress(compressor, buf, offset, stringSize)
  },

  compress: (buf: Uint8Array, offset: number, stringSize: number) => {
    return db.compress(compressor, buf, offset, stringSize)
  },

  decompress: (
    input: Uint8Array,
    output: Uint8Array,
    offset: number,
    len: number,
  ) => {
    return db.decompress(decompressor, input, output, offset, len)
  },

  crc32: (buf: Uint8Array) => {
    return db.crc32(buf)
  },

  createSortIndex: (buf: Uint8Array, dbCtx: any) => {
    return db.createSortIndex(dbCtx, buf)
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

  stringToUint8Array: (
    s: string,
    dst: Uint8Array,
    offset: number = 0,
    terminated: boolean = false,
  ): number => {
    return db.stringToUint8Array(s, dst, offset, terminated)
  },

  selvaStrerror: (err: number) => {
    return db.selvaStrerror(err)
  },

  selvaLangAll: (): string => {
    return db.selvaLangAll()
  },

  colvecTest: (
    dbCtx: any,
    typeId: number,
    field: number,
    nodeId: number,
    len: number,
  ) => {
    return db.colvecTest(dbCtx, typeId, field, nodeId, len)
  },
}

global.__basedDb__native__ = native
export default native
