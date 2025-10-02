// import { BasedDB } from '../sdk/dist/index.js'
// import { BasedDb } from '../db/dist/src/index.js'
// import { BasedDb } from '@based/db'
import { BasedDb, Schema } from '@based/sdk'
// import { Schema } from '@based/sdk/schema'

console.log('=== Basic SDK Usage ===')

const testSchema: Schema = {
  types: {
    trip: {
      pickup: 'timestamp',
      dropoff: 'timestamp',
      distance: 'number',
      vendorIduint8: 'uint8',
      vendorIdint8: 'int8',
      vendorIduint16: 'uint16',
      vendorIdint16: 'int16',
      vendorIduint32: 'int32',
      vendorIdint32: 'int32',
      vendorIdnumber: 'number',
    },
  },
}

const db = new BasedDb({
  path: './tmp',
})
await db.start({ clean: true })

await db.setSchema(testSchema)

db.create('trip', {
  vendorIduint8: 13,
  vendorIdint8: 13,
  vendorIduint16: 813,
  vendorIdint16: 813,
  vendorIduint32: 813,
  vendorIdint32: 813,
  vendorIdnumber: 813.813,
  pickup: new Date('11/12/2024 11:00'),
  dropoff: new Date('11/12/2024 11:10'),
  distance: 513.44,
})

await db.query('trip').sum('distance').groupBy('vendorIduint8').get().inspect()

db.stop()
