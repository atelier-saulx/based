import { BasedDb, FieldDef, SchemaTypeDef } from '../index.js'
import { BasedQueryResponse } from './BasedQueryResponse.js'
import { Operation, operationToByte } from './types.js'
import { get } from './get.js'

export class Query {
  db: BasedDb
  type: SchemaTypeDef
  id: number | void
  conditions: Map<number, Buffer[]>
  offset: number
  limit: number
  includeFields: string[]
  mainIncludes: Map<number, number>
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

  filter(...filter: [string, Operation, any]) {
    if (this.id) {
      // bla
    } else {
      const field = <FieldDef>this.type.tree[filter[0]]
      let fieldIndexChar = field.field
      let buf: Buffer

      if (field.seperate === true) {
        if (field.type === 'string') {
          const op = operationToByte(filter[1])
          if (op === 1) {
            const matches = Buffer.from(filter[2])
            buf = Buffer.allocUnsafe(3 + matches.byteLength)
            buf[0] = 2
            buf.writeInt16LE(matches.byteLength, 1)
            buf.set(matches, 3)
          } else if (op === 7) {
            // TODO MAKE HAS
          }
        } else if (field.type === 'references') {
          const op = operationToByte(filter[1])
          const matches = filter[2]
          const len = matches.length
          buf = Buffer.alloc(3 + len * 4)
          if (op === 1) {
            buf[0] = 2
            buf.writeInt16LE(len * 4, 1)
            for (let i = 0; i < len; i++) {
              buf.writeInt32LE(matches[i], i * 4 + 3)
            }
          } else if (op === 7) {
            buf[0] = op
            buf.writeInt16LE(len, 1)
            for (let i = 0; i < len; i++) {
              buf.writeInt32LE(matches[i], i * 4 + 3)
            }
          }
        }
      } else {
        if (field.type === 'integer') {
          const op = operationToByte(filter[1])
          if (op === 1 || op === 3 || op === 4) {
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

  include(...fields: string[]) {
    this.includeFields = this.includeFields
      ? [...this.includeFields, ...fields]
      : fields

    return this
  }

  get(): BasedQueryResponse {
    return get(this)
  }

  subscribe(fn: (value: any, checksum: number, err: Error) => void) {
    console.log('hello sub')
    // sub will all wil fire on any field
    // maybe start with this?
    // this is also where we will create diffs
    // idea use  PROXY object as a view to the buffer
  }
}

export const query = (db: BasedDb, target: string) => new Query(db, target)
