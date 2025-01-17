import { BasedDbQuery } from '../BasedDbQuery.js'
import { BasedQueryResponse } from '../BasedIterable.js'
import { includeFields } from '../query.js'
import { defToBuffer } from '../toBuffer.js'
import { QueryDef } from '../types.js'
import { checkTotalBufferSize } from '../validation.js'

export type OnData = (res: BasedQueryResponse) => any

export type OnError = (err: Error) => any

export type OnClose = () => BasedDbQuery

export const subscribe = (
  q: BasedDbQuery,
  onData: OnData,
  onError: OnError,
): OnClose => {
  //
  // maybe add checksum
  // bla

  let prevValue: any
  let zeit: any
  let closed = false

  if (!q.def.include.stringFields.size && !q.def.references.size) {
    includeFields(q.def, ['*'])
  }
  const b = defToBuffer(q.db, q.def)
  checkTotalBufferSize(b)

  const close = () => {
    closed = true
    if (zeit) {
      clearTimeout(zeit)
    }
    return q
  }

  const runQuery = () => {
    const d = performance.now()
    q.db.server
      .getQueryBuf(Buffer.concat(b))
      .then((res) => {
        if (!closed) {
          if (res instanceof Error) {
            onError(res)
          } else {
            const result = Buffer.from(res)
            if (
              !prevValue ||
              result.byteLength != prevValue.byteLength ||
              !result.equals(prevValue)
            ) {
              onData(
                new BasedQueryResponse(q.def, result, performance.now() - d),
              )
            }
            prevValue = result
          }
          if (zeit) {
            clearTimeout(zeit)
          }
          zeit = setTimeout(() => {
            runQuery()
          }, 200)
        }
      })
      .catch((err) => {
        console.error(err)
      })
  }

  runQuery()

  return close
}
