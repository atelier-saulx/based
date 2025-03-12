// @ts-ignore
import db from '../../basedDbNative.cjs'

const selvaIoErrlog = new Uint8Array(256)
const textEncoder = new TextEncoder()
var compressor: any = null
var decompressor: any = null

function SelvaIoErrlogToString(buf: Uint8Array) {
    let i: number;
    let len = (i = buf.indexOf(0)) >= 0 ? i : buf.byteLength

    return new TextDecoder().decode(selvaIoErrlog.slice(0, len));
}

export default {
  historyAppend(history: any, typeId: number, nodeId: number, dbCtx: any) {
    return db.historyAppend(history, typeId, nodeId, dbCtx)
  },
  historyCreate(pathname: string, mainLen: number): any {
    const pathBuf = textEncoder.encode(pathname + '\0')
    return db.historyCreate(
      pathBuf,
      mainLen + 16 - (mainLen % 16),
    )
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

  modify: (data: Buffer, types: Buffer, dbCtx: any): any => {
    db.modify(data, types, dbCtx)
  },

  getQueryBuf: (q: Buffer, dbCtx: any): ArrayBuffer | null => {
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
    const pathBuf = textEncoder.encode(path + '\0')
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
    const pathBuf = textEncoder.encode(path + '\0')
    return db.saveRange(pathBuf, typeCode, start, end, dbCtx, hashOut)
  },

  loadCommon: (path: string, dbCtx: any): void => {
    const pathBuf = textEncoder.encode(path + '\0')
    const err: number = db.loadCommon(pathBuf, dbCtx, selvaIoErrlog)
    if (err) {
      throw new Error(`Failed to load common. selvaError: ${err} cause:\n${SelvaIoErrlogToString(selvaIoErrlog)}`)
    }
  },

  loadRange: (path: string, dbCtx: any): void => {
    const pathBuf = textEncoder.encode(path + '\0')
    const err: number = db.loadRange(pathBuf, dbCtx, selvaIoErrlog)
    if (err) {
      throw new Error(`Failed to load a range. selvaError: ${err} cause:\n${SelvaIoErrlogToString(selvaIoErrlog)}`)
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
    bufOut: Buffer,
    dbCtx: any,
  ) => {
    return db.getNodeRangeHash(typeId, start, end, bufOut, dbCtx)
  },

  createHash: () => {
    const state = db.hashCreate()
    const hash = {
      update: (buf: Buffer) => {
        db.hashUpdate(state, buf)
        return hash
      },
      digest: (encoding?: BufferEncoding): Buffer | string => {
        const buf = Buffer.allocUnsafe(16)
        db.hashDigest(state, buf)
        return encoding ? buf.toString(encoding) : buf
      },
      reset: () => {
        db.hashReset(state)
      },
    }

    return hash
  },

  // needs to pass dbCtx: any
  compress: (buf: Buffer, offset: number, stringSize: number) => {
    if (compressor === null) {
      compressor = db.createCompressor()
    }
    return db.compress(compressor, buf, offset, stringSize)
  },

  decompress: (input: Buffer, output: Buffer, offset: number, len: number) => {
    if (decompressor === null) {
      decompressor = db.createDecompressor()
    }
    return db.decompress(decompressor, input, output, offset, len)
  },

  crc32: (buf: Buffer) => {
    return db.crc32(buf)
  },

  createSortIndex: (buf: Buffer, dbCtx: any) => {
    return db.createSortIndex(dbCtx, buf)
  },

  destroySortIndex: (buf: Buffer, dbCtx: any) => {
    return db.destroySortIndex(dbCtx, buf)
  },

  xxHash64: (buf: Buffer, target: Buffer, index: number) => {
    return db.xxHash64(buf, target, index)
  },
}
