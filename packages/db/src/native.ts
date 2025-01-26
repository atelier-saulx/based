// @ts-ignore
import db from '../../basedDbNative.cjs'

var compressor: any = null
var decompressor: any = null

export default {
  workerCtxInit: (): void => {
    return db.workerCtxInit()
  },

  markMerkleBlock: (buf: Buffer): any => {
    // pstart,
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

  getQueryBuf: (q: Buffer, dbCtx: any): Buffer | null => {
    return db.getQueryBuf(dbCtx, q)
  },

  start: (id: number) => {
    return db.start(id)
  },

  stop: (dbCtx: any) => {
    return db.stop(dbCtx)
  },

  saveCommon: (path: string, dbCtx: any): number => {
    const buf = Buffer.concat([Buffer.from(path), Buffer.from([0])])
    return db.saveCommon(buf, dbCtx)
  },

  saveRange: (
    path: string,
    typeCode: number,
    start: number,
    end: number,
    dbCtx: any,
    hashOut: Buffer,
  ): number => {
    const buf = Buffer.concat([Buffer.from(path), Buffer.from([0])])
    return db.saveRange(buf, typeCode, start, end, dbCtx, hashOut)
  },

  loadCommon: (path: string, dbCtx: any): number => {
    const buf = Buffer.concat([Buffer.from(path), Buffer.from([0])])
    return db.loadCommon(buf, dbCtx)
  },

  loadRange: (path: string, dbCtx: any): number => {
    const buf = Buffer.concat([Buffer.from(path), Buffer.from([0])])
    return db.loadRange(buf, dbCtx)
  },

  updateSchemaType: (prefix: number, buf: Buffer, dbCtx: any) => {
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
}
