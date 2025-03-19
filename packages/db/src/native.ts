// @ts-ignore
import db from '../../basedDbNative.cjs'
import { DECODER, ENCODER, bufToHex } from './utils.js'

const selvaIoErrlog = new Uint8Array(256)
var compressor = db.createCompressor()
var decompressor = db.createDecompressor()

function SelvaIoErrlogToString(buf: Uint8Array) {
  let i: number
  let len = (i = buf.indexOf(0)) >= 0 ? i : buf.byteLength

  return DECODER.decode(selvaIoErrlog.slice(0, len))
}

export default {
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

  modify: (data: Uint8Array, types: Uint8Array, dbCtx: any): any => {
    db.modify(data, types, dbCtx)
  },

  getQueryBuf: (q: Uint8Array, dbCtx: any): ArrayBuffer | null => {
    const x = db.getQueryBuf(dbCtx, q)
    return x
  },

  start: (id: number) => {
    return db.start(id)
  },

  stop: (dbCtx: any) => {
    return db.stop(dbCtx)
  },

  saveCommon: (path: string, dbCtx: any): number => {
    const pathBuf = ENCODER.encode(path + '\0')
    return db.saveCommon(pathBuf, dbCtx)
  },

  saveRange: (
    path: string,
    typeCode: number,
    start: number,
    end: number,
    dbCtx: any,
    hashOut: Uint8Array,
  ): number => {
    const pathBuf = ENCODER.encode(path + '\0')
    return db.saveRange(pathBuf, typeCode, start, end, dbCtx, hashOut)
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

  loadRange: (path: string, dbCtx: any): void => {
    const pathBuf = ENCODER.encode(path + '\0')
    const err: number = db.loadRange(pathBuf, dbCtx, selvaIoErrlog)
    if (err) {
      throw new Error(
        `Failed to load a range. selvaError: ${err} cause:\n${SelvaIoErrlogToString(selvaIoErrlog)}`,
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

  createHash: () => {
    const state = db.hashCreate()
    const hash = {
      update: (buf: Buffer | Uint8Array) => {
        db.hashUpdate(state, buf)
        return hash
      },
      digest: (encoding?: 'hex'): Uint8Array | string => {
        const buf = new Uint8Array(16)
        db.hashDigest(state, buf)
        if (encoding === 'hex') {
          return bufToHex(buf)
        } else {
          return buf
        }
      },
      reset: () => {
        db.hashReset(state)
      },
    }

    return hash
  },

  compress: (buf: Buffer | Uint8Array, offset: number, stringSize: number) => {
    return db.compress(compressor, buf, offset, stringSize)
  },

  decompress: (
    input: Buffer | Uint8Array,
    output: Buffer | Uint8Array,
    offset: number,
    len: number,
  ) => {
    return db.decompress(decompressor, input, output, offset, len)
  },

  crc32: (buf: Buffer | Uint8Array) => {
    return db.crc32(buf)
  },

  createSortIndex: (buf: Uint8Array, dbCtx: any) => {
    return db.createSortIndex(dbCtx, buf)
  },

  destroySortIndex: (buf: Uint8Array, dbCtx: any) => {
    return db.destroySortIndex(dbCtx, buf)
  },

  xxHash64: (
    buf: Buffer | Uint8Array,
    target: Buffer | Uint8Array,
    index: number,
  ) => {
    return db.xxHash64(buf, target, index)
  },

  base64encode: (dst: Uint8Array, src: Uint8Array, lineMax: number): Uint8Array => {
    return db.base64encode(dst, src, lineMax)
  },

  equals: (a: Uint8Array, b: Uint8Array): boolean => {
    return !!db.equals(a, b)
  },
}
