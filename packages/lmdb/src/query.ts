import { BasedDb, FieldDef, SchemaTypeDef, getDbiHandler } from './index.js'
import dbZig from './db.js'

type Operation = '=' | 'has'

/*
-> 0 next field -> FIELD
// -> base 62
-> 1 =
-> 2 !=
-> 3 >
-> 4 <
-> 5 refCheck (get id + field after) -> FIELD
-> 6 go back to previous id (start next operation)
// can also look like 6 -> 6 (2 back)
———————————————
-> 7 has [len][len] x4 HAS  // 0,2,3
———————————————
-> 8 exist 
-> 9 !exist
———————————————
// ————— number
// boolean 0|1
// int default 0
// enum default 0 (undefined)
// number + timestamp 1 extra byte for extra info e.g. undefined
*/

const zeroChar = '0'.charCodeAt(0)

const operationToByte = (op: Operation) => {
  if (op === '=') {
    return 1
  }
  // 2 is non fixed length check
  if (op === 'has') {
    return 7
  }
  return 0
}

const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

export class Query {
  db: BasedDb
  type: SchemaTypeDef
  id: number | void
  conditions: Map<number, Buffer[]>
  offset: number
  limit: number
  totalConditionSize: number = 0
  constructor(db: BasedDb, target: string, previous?: Query) {
    this.db = db
    let typeDef = this.db.schemaTypesParsed[target]
    if (typeDef) {
      this.type = typeDef
    } else {
      // is ID check prefix
    }
  }

  filter(filter: [string, Operation, any]) {
    if (this.id) {
    } else {
      const field = <FieldDef>this.type.dbMap.tree[filter[0]]
      let fieldIndexChar: number
      let buf: Buffer

      if (field.seperate === true) {
        fieldIndexChar = CHARS[field.index % 62].charCodeAt(0)

        if (field.type === 'string') {
          const op = operationToByte(filter[1])
          if (op === 1) {
            const matches = Buffer.from(filter[2])
            buf = Buffer.allocUnsafe(3 + matches.byteLength)
            buf[0] = 2
            buf.writeInt16LE(matches.byteLength, 1)
            buf.set(matches, 3)
          }
        } else if (field.type === 'references') {
          const op = operationToByte(filter[1])
          if (op === 1) {
            const matches = filter[2]
            const len = matches.length
            buf = Buffer.alloc(3 + len * 4)
            buf[0] = 2
            buf.writeInt16LE(len * 4, 1)
            for (let i = 0; i < len; i++) {
              buf.writeInt32LE(matches[i], i * 4 + 3)
            }
          } else if (op === 7) {
            const matches = filter[2]
            const len = matches.length
            buf = Buffer.alloc(3 + len * 4)
            buf[0] = op
            buf.writeInt16LE(len, 1)
            for (let i = 0; i < len; i++) {
              buf.writeInt32LE(matches[i], i * 4 + 3)
            }
          }
        }
      } else {
        fieldIndexChar = zeroChar
        if (field.type === 'integer') {
          const op = operationToByte(filter[1])
          if (op === 1) {
            buf = Buffer.alloc(9)
            buf[0] = op
            buf.writeInt16LE(4, 1)
            buf.writeInt16LE(field.start, 3)
            buf.writeInt32LE(filter[2], 5)
          }
        }
      }

      this.conditions ??= new Map()
      let arr = this.conditions.get(fieldIndexChar)
      if (!arr) {
        this.totalConditionSize += 3
        arr = []
        this.conditions.set(fieldIndexChar, arr)
      }
      this.totalConditionSize += buf.byteLength
      arr.push(buf)

      return this
    }
  }

  range(offset: number, limit: number): Query {
    this.offset = offset
    this.limit = limit
    return this
  }

  get(): { items: number[]; total: number; offset: number; limit: number } {
    if (this.conditions) {
      const conditions = Buffer.allocUnsafe(this.totalConditionSize)
      let lastWritten = 0
      this.conditions.forEach((v, k) => {
        console.log('GO PUT', k, 'c', v)
        conditions[lastWritten] = k
        let sizeIndex = lastWritten + 1
        lastWritten += 3
        let conditionSize = 0
        for (const condition of v) {
          conditionSize += condition.byteLength
          conditions.set(condition, lastWritten)
          lastWritten += condition.byteLength
        }
        conditions.writeInt16LE(conditionSize, sizeIndex)
      })

      console.log('---> conditions', new Uint8Array(conditions))

      const start = this.offset ?? 0
      const end = this.limit ?? 1e3

      console.info('helloo', 'power', conditions)
      const x = dbZig.power(
        conditions,
        this.type.dbMap.prefix,
        this.type.meta.lastId,
        start,
        end, // def 1k ?
      )

      const arr = new Array(x.byteLength / 4)

      for (let i = 0; i < x.byteLength; i += 4) {
        arr[i / 4] = x.readUint32LE(i)
      }

      return {
        items: arr,
        total: this.type.meta.total,
        offset: start,
        limit: end,
      }
    } else {
    }
  }
}

export const query = (db: BasedDb, target: string) => {
  const q = new Query(db, target)

  return q
}
