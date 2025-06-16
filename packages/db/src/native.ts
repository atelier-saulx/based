// @ts-ignore
import db from '../../basedDbNative.cjs'

// Can't import these from utils or it would be a cyclic import.
const DECODER = new TextDecoder('utf-8')
const ENCODER = new TextEncoder()

const selvaIoErrlog = new Uint8Array(256)
var compressor = db.createCompressor() // put on threadCtx
var decompressor = db.createDecompressor()

function SelvaIoErrlogToString(buf: Uint8Array) {
  let i: number
  let len = (i = buf.indexOf(0)) >= 0 ? i : buf.byteLength
  return DECODER.decode(selvaIoErrlog.slice(0, len))
}

// add worker CTX HERE
// then add it to every function
// worker should allways be here
// then add ThreadCtx to modify ctx and query ctx

const native = {
  threadCtx: null, // add compressors here as well!
  historyAppend(history: any, typeId: number, nodeId: number, dbCtx: any) {
    return db.historyAppend(history, typeId, nodeId, dbCtx)
  },
  historyCreate(pathname: string, mainLen: number): any {
    const pathBuf = ENCODER.encode(pathname + '\0')
    return db.historyCreate(pathBuf, mainLen + 16 - (mainLen % 16))
  },

  workerCtxInit: (): void => {
    return db.workerCtxInit()
  },

  externalFromInt(address: BigInt): any {
    return db.externalFromInt(address)
  },

  intFromExternal(external: any): BigInt {
    return db.intFromExternal(external)
  },

  modify: (
    data: Uint8Array,
    types: Uint8Array,
    dbCtx: any,
    dirtyBlocksOut: Float64Array,
  ): any => {
    db.modify(data, types, dbCtx, dirtyBlocksOut)
  },

  getQueryBuf: (q: Uint8Array, dbCtx: any): ArrayBuffer | null => {
    const x = db.getQueryBuf(dbCtx, q)
    return x
  },

  start: () => {
    return db.start()
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

  updateSchemaType: (prefix: number, buf: Uint8Array, dbCtx: any) => {
    return db.updateSchema(prefix, buf, dbCtx)
  },

  getTypeInfo: (typeId: number, dbCtx: any) => {
    return db.getTypeInfo(typeId, dbCtx)
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
}

global.__basedDb__native__ = native
export default native
