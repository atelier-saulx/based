// @ts-ignore
import db from '../../nativebla.cjs'

export default {
  modify: (buffer: Buffer, len: number): any => {
    return db.modify(buffer, len)
  },
  getQuery: (
    conditions: Buffer,
    prefix: string,
    lastId: number,
    offset: number,
    limit: number, // def 1k ?
    includeBuffer: Buffer,
  ): any => {
    return db.getQuery(conditions, prefix, lastId, offset, limit, includeBuffer)
  },
  getQuerySort: (
    conditions: Buffer,
    prefix: string,
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
        prefix,
        lastId,
        offset,
        limit,
        includeBuffer,
        sort,
      )
    } else {
      return db.getQuerySortAsc(
        conditions,
        prefix,
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
    prefix: string,
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
          prefix,
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
          prefix,
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
        prefix,
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
        prefix,
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
    prefix: string,
    id: number,
    includeBuffer: Buffer,
  ): any => {
    return db.getQueryById(conditions, prefix, id, includeBuffer)
  },
  getQueryByIds: (
    conditions: Buffer,
    prefix: string,
    ids: Buffer,
    includeBuffer: Buffer,
  ): any => {
    return db.getQueryByIds(conditions, prefix, ids, includeBuffer)
  },

  stat: () => {
    return db.stat()
  },

  start: (path: string, readOnly: boolean = false) => {
    return db.start(path, readOnly)
  },

  stop: () => {
    return db.stop()
  },

  tester: () => {
    return db.tester()
  },
}
