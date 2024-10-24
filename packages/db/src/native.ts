// @ts-ignore
import db from '../../nativebla.cjs'

export default {
  markMerkleBlock: (buf: Buffer): any => {
    // pstart,
  },

  modify: (buffer: Buffer, len: number, dbCtx: any): any => {
    return db.modify(buffer, len, dbCtx)
  },

  getQueryBuf: (q: Buffer, dbCtx: any): Buffer | null => {
    return db.getQueryBuf(dbCtx, q)
  },

  start: (path: string, dumpPath: string, readOnly: boolean, id: number) => {
    const buf = Buffer.concat([Buffer.from(path), Buffer.from([0])])
    const dumpPathBuf = dumpPath
      ? Buffer.concat([Buffer.from(dumpPath), Buffer.from([0])])
      : null
    return db.start(buf, readOnly, dumpPathBuf, id)
  },

  stop: (id: number, dbCtx: any) => {
    return db.stop(id, dbCtx)
  },

  save: (path: string, dbCtx: any): number => {
    const buf = Buffer.concat([Buffer.from(path), Buffer.from([0])])
    return db.save(buf, dbCtx)
  },

  isSaveReady: (pid: number, path: string): boolean => {
    const errBuf = Buffer.alloc(80)
    try {
      const buf = Buffer.concat([Buffer.from(path), Buffer.from([0])])
      return db.isSaveReady(pid, buf, errBuf)
    } catch (err) {
      console.log('ERROR SAVE READY', errBuf.toString())
      throw err
    }
  },

  saveCommon: (path: string, dbCtx: any): number => {
    const buf = Buffer.concat([Buffer.from(path), Buffer.from([0])])
    return db.save(buf, dbCtx)
  },

  saveRange: (
    path: string,
    typeCode: number,
    start: number,
    end: number,
    dbCtx: any,
  ): number => {
    const buf = Buffer.concat([Buffer.from(path), Buffer.from([0])])
    return db.saveRange(buf, typeCode, start, end, dbCtx)
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
}
