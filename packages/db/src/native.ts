// @ts-ignore
import db from '@based/db/native'
import { DECODER, ENCODER } from '@based/utils'

const selvaIoErrlog = new Uint8Array(256)
var compressor = db.createCompressor()
var decompressor = db.createDecompressor()

function SelvaIoErrlogToString(buf: Uint8Array) {
  let i: number
  let len = (i = buf.indexOf(0)) >= 0 ? i : buf.byteLength
  return DECODER.decode(selvaIoErrlog.slice(0, len))
}

const native = {
  cnt: 0,
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

  modify: (
    data: Uint8Array,
    dbCtx: any,
  ): number | null => {
    console.dir(data, { depth: 10 })
    return db.modify(data, dbCtx)
  },

  getQueryBuf: (q: Uint8Array, dbCtx: any): ArrayBuffer | null => {
    const x = db.getQueryBuf(dbCtx, q)
    return x
  },

  getQueryBufThread: (q: Uint8Array, dbCtx: any): ArrayBuffer | null => {
    const x = db.getQueryBufThread(dbCtx, q)
    return x
  },

  modifyThread: (q: Uint8Array, dbCtx: any): null => {
    const x = db.modifyThread(q, dbCtx)
    return x
  },

  getQueryResults(dbCtx: any): ArrayBuffer[] {
    // what to return?
    const x = db.getQueryResults(dbCtx)
    return x
  },

  getModifyResults(dbCtx: any): ArrayBuffer {
    // what to return?
    const x = db.getModifyResults(dbCtx)
    return x
  },

  start: () => {
    let x = db.start((id: number, buffer: ArrayBuffer) => {
      // maybe dont add the id...
      // use enum
      // native.cnt++
      // console.log('im a little derp', new Uint8Array(xxx), x)
      if (id === 1) {
        // can be a bit nicer
        const r = native.getQueryResults(x)
        console.log('QUERY RESULTS')
        // console.log(native.getQueryResults(x))
      } else if (id === 2) {
        const r = native.getModifyResults(x)
        console.log('MODIFY RESULTS', new Uint8Array(r))
      }
    })
    return x
  },

  stop: (dbCtx: any) => {
    return db.stop(dbCtx)
  },

  saveCommon: (path: string, dbCtx: any): number => {
    const pathBuf = ENCODER.encode(path + '\0')
    return db.saveCommon(pathBuf, dbCtx)
  },

  saveBlock: (
    path: string,
    typeCode: number,
    start: number,
    dbCtx: any,
    hashOut: Uint8Array,
  ): number => {
    const pathBuf = ENCODER.encode(path + '\0')
    return db.saveBlock(pathBuf, typeCode, start, dbCtx, hashOut)
  },

  loadCommon: (path: string, dbCtx: any): void => {
    const pathBuf = ENCODER.encode(path + '\0')
    const err: number = db.loadCommon(pathBuf, dbCtx, selvaIoErrlog)
    if (err) {
      throw new Error(
        `Failed to load common. selvaError: ${err} cause:\n${SelvaIoErrlogToString(selvaIoErrlog)}`,
      )
    }
  },

  loadBlock: (path: string, dbCtx: any): void => {
    const pathBuf = ENCODER.encode(path + '\0')
    const err: number = db.loadBlock(pathBuf, dbCtx, selvaIoErrlog)
    if (err) {
      throw new Error(
        `Failed to load a range "${path}". selvaError: ${err} cause:\n${SelvaIoErrlogToString(selvaIoErrlog)}`,
      )
    }
  },

  delBlock: (dbCtx: any, typeId: number, block: number) => {
    db.delBlock(dbCtx, typeId, block)
  },

  setSchemaType: (dbCtx: any, prefix: number, buf: Uint8Array) => {
    return db.setSchemaType(dbCtx, prefix, buf)
  },

  setSchemaIds: (ids: Uint32Array, dbCtx: any) => {
    return db.setSchemaIds(ids, dbCtx)
  },

  getSchemaIds: (dbCtx: any): Uint32Array => {
    return new Uint32Array(db.getSchemaIds(dbCtx))
  },

  getNodeRangeHash: (
    typeId: number,
    start: number,
    end: number,
    bufOut: Uint8Array,
    dbCtx: any,
  ) => {
    return db.getNodeRangeHash(typeId, start, end, bufOut, dbCtx)
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

  membarSyncRead: () => {
    db.membarSyncRead()
  },

  membarSyncWrite: () => {
    db.membarSyncWrite()
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
