import { BasedDb, FieldDef, SchemaTypeDef } from './index.js'
import dbZig from './db.js'

type Operation = '='

/*
-> 0 next field -> FIELD
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

const operationToByte = (op: Operation) => {
  if (op === '=') {
    return 1
  }
  return 0
}

export class Query {
  db: BasedDb
  type: SchemaTypeDef
  id: number | void
  conditions: Buffer[]
  constructor(db: BasedDb, target: string) {
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

      if (field.seperate === true) {
      } else {
        if (field.type === 'integer') {
          // 1 byte [operation] (= 1)

          // 2 bytes [index to read]
          // 4 bytes [equal integer]

          const buf = Buffer.alloc(9)
          buf[0] = operationToByte(filter[1])
          buf.writeInt16LE(6, 1)
          // only for head
          buf.writeInt16LE(field.start, 3)
          buf.writeInt32LE(filter[2], 5)

          // 0 2 -> go to dbi 2

          this.conditions ??= []

          this.conditions.push(buf)
        }
      }

      return this
    }
  }
  get(): number[] {
    // run filter

    if (this.conditions) {
      console.info(new Uint8Array(this.conditions[0]), this.type.dbMap.prefix)

      // this.prefix
    }

    // typePrefix field shard

    // type [16bit integer u]
    // field [8bit integer u]
    // shard [16 bit integer u]
    //

    // 0-9
    // [30] [0] [00]

    // dbZig.query(filter, typePrefix, totalShards)

    // bla
    return []
  }
}

export const query = (db: BasedDb, target: string) => {
  const q = new Query(db, target)

  return q
}
