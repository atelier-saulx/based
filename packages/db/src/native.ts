// @ts-ignore
import db from '../../nativebla.cjs'

export default {
  markMerkleBlock: (buf: Buffer): any => {
    // pstart,
  },

  externalFromInt(address: BigInt): any {
    return db.externalFromInt(address)
  },

  intFromExternal(external: any): BigInt {
    return db.intFromExternal(external)
  },

  modify: (buffer: Buffer, dbCtx: any): any => {
    return db.modify(buffer, dbCtx)
  },

  getQueryBuf: (q: Buffer, dbCtx: any): Buffer | null => {
    return db.getQueryBuf(dbCtx, q)
  },

  start: (path: string, readOnly: boolean, id: number) => {
    const buf = Buffer.concat([Buffer.from(path), Buffer.from([0])])
    return db.start(buf, readOnly, id)
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

  getTypeInfo: (typeId: number, defCtx: any) => {
    return db.getTypeInfo(typeId, defCtx)
  },

  getNodeRangeHash: (
    typeId: number,
    start: number,
    end: number,
    bufOut: Buffer,
    defCtx: any,
  ) => {
    return db.getNodeRangeHash(typeId, start, end, bufOut, defCtx)
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

  compress: (buf: Buffer, offset: number, stringSize: number) => {
    return db.compress(buf, offset, stringSize)
  },

  decompress: (input: Buffer, output: Buffer, offset: number, len: number) => {
    return db.decompress(input, output, offset, len)
  },
}
