// @ts-ignore
import db from '../../nativebla.cjs'
import { schema2selva, SchemaTypeDef } from './schemaTypeDef.js'

export default {
  modify: (buffer: Buffer, len: number): any => {
    return db.modify(buffer, len)
  },

  getQuery: (
    conditions: Buffer,
    typeId: number,
    lastId: number,
    offset: number,
    limit: number, // def 1k ?
    includeBuffer: Buffer,
  ): any => {
    return db.getQuery(conditions, typeId, lastId, offset, limit, includeBuffer)
  },

  getQuerySort: (
    conditions: Buffer,
    typeId: number,
    lastId: number,
    offset: number,
    limit: number, // def 1k ?
    includeBuffer: Buffer,
    sort: Buffer,
    sortOrder: 0 | 1,
  ): any => {
    if (sortOrder === 1) {
      return db.getQuerySortDesc(
        conditions,
        typeId,
        lastId,
        offset,
        limit,
        includeBuffer,
        sort,
      )
    } else {
      return db.getQuerySortAsc(
        conditions,
        typeId,
        lastId,
        offset,
        limit,
        includeBuffer,
        sort,
      )
    }
  },

  getQueryIdsSort: (
    conditions: Buffer,
    typeId: number,
    lastId: number,
    offset: number,
    limit: number, // def 1k ?
    ids: Buffer,
    includeBuffer: Buffer,
    sort: Buffer,
    sortOrder: 0 | 1,
    low: number,
    high: number,
  ): any => {
    if (ids.length > 512 * 4) {
      if (sortOrder === 1) {
        return db.getQueryIdsSortAscLarge(
          conditions,
          typeId,
          lastId,
          offset,
          limit,
          ids,
          includeBuffer,
          sort,
        )
      } else {
        return db.getQueryIdsSortDescLarge(
          conditions,
          typeId,
          lastId,
          offset,
          limit,
          ids,
          includeBuffer,
          sort,
        )
      }
    }
    if (sortOrder === 1) {
      return db.getQueryIdsSortAsc(
        conditions,
        typeId,
        lastId,
        offset,
        limit,
        ids,
        includeBuffer,
        sort,
        low,
        high,
      )
    } else {
      return db.getQueryIdsSortDesc(
        conditions,
        typeId,
        lastId,
        offset,
        limit,
        ids,
        includeBuffer,
        sort,
        low,
        high,
      )
    }
  },

  getQueryById: (
    conditions: Buffer,
    typeId: number,
    id: number,
    includeBuffer: Buffer,
  ): any => {
    return db.getQueryById(conditions, typeId, id, includeBuffer)
  },

  getQueryByIds: (
    conditions: Buffer,
    typeId: number,
    ids: Buffer,
    includeBuffer: Buffer,
  ): any => {
    return db.getQueryByIds(conditions, typeId, ids, includeBuffer)
  },

  start: (path: string, dumpPath: string, readOnly: boolean) => {
    const buf = Buffer.concat([Buffer.from(path), Buffer.from([0])])
    const dumpPathBuf = dumpPath
      ? Buffer.concat([Buffer.from(dumpPath), Buffer.from([0])])
      : null
    return db.start(buf, readOnly, dumpPathBuf)
  },

  save: (path: string): number => {
    const buf = Buffer.concat([Buffer.from(path), Buffer.from([0])])
    return db.save(buf)
  },

  isSaveReady: (pid: number, path: string): boolean => {
    const errBuf = Buffer.alloc(80)
    try {
      const buf = Buffer.concat([Buffer.from(path), Buffer.from([0])])
      console.log(buf.toString())
      return db.isSaveReady(pid, buf, errBuf)
    } catch (err) {
      console.log('ERROR SAVE READY', errBuf.toString())
      throw err
    }
  },

  stop: () => {
    return db.stop()
  },

  getTypeInfo: (type: number) => {
    return db.getTypeInfo(type)
  },

  updateSchemaType: (prefix: number, buf: Buffer) => {
    return db.updateSchema(prefix, buf)
  },
}
