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
          // 1 byte
          // 2 bytes
          // 4 bytes

          const buf = Buffer.alloc(7)
          buf[0] = operationToByte(filter[1])
          buf.writeInt16LE(field.start, 1)
          buf.writeInt32LE(filter[2], 3)

          this.conditions ??= []

          this.conditions.push(buf)

          //   console.info(new Uint8Array(buf.buffer))
        }
      }

      // const Buffer =
    }
  }
  get(): number[] {
    // run filter

    if (this.conditions) {
    }

    // const res = dbZig.getBatch4(key, db.dbiIndex.get(dbi))

    // bla
    return []
  }
}

export const query = (db: BasedDb, target: string) => {
  const q = new Query(db, target)

  return q
}
