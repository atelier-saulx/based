import test from '../shared/test.js'
import { deepEqual } from '../shared/assert.js'
import { testDb } from '../shared/index.js'

const gender = ['male', 'female']
const status = ['sent', 'delivered', 'failed']

await test('multiple group by', async (t) => {
  const db = await testDb(t, {
    types: {
      report: {
        props: {
          date: 'timestamp',
          customer: {
            ref: 'customer',
            prop: 'reports',
          },
          smsStatus: status,
        },
      },
      customer: {
        props: {
          name: 'string',
          gender: gender,
          age: 'uint8',
          reports: {
            items: {
              ref: 'report',
              prop: 'customer',
            },
          },
        },
      },
    },
  })

  const c1 = db.create('customer', {
    name: 'Homer',
    gender: 'male',
    age: 10,
  })
  const c2 = db.create('customer', {
    name: 'Margie',
    gender: 'female',
    age: 20,
  })

  const dtFormat = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeZone: 'UTC',
  })

  const d1 = db.create('report', {
    date: new Date('2022-01-01'),
    customer: c1,
    smsStatus: 'sent',
  })
  const d2 = db.create('report', {
    date: new Date('2022-01-01'),
    customer: c2,
    smsStatus: 'sent',
  })
  const d3 = db.create('report', {
    date: new Date('2022-01-02'),
    customer: c1,
    smsStatus: 'sent',
  })
  const d4 = db.create('report', {
    date: new Date('2022-01-02'),
    customer: c2,
    smsStatus: 'sent',
  })
  const d5 = db.create('report', {
    date: new Date('2022-01-02'),
    customer: c2,
    smsStatus: 'delivered',
  })
  const d6 = db.create('report', {
    date: new Date('2022-01-02'),
    customer: c2,
    smsStatus: 'failed',
  })

  // get report count by date
  const r1 = await db
    .query('report')
    .count()
    .groupBy('date', { display: dtFormat })
    .get()

  deepEqual(
    r1,
    { '02/01/2022': { count: 4 }, '01/01/2022': { count: 2 } },
    'report count by date',
  )

  // get report count by date per genre
  //await db.query('customer').avg('age').groupBy('gender').get()
  const r2 = await db
    .query('customer')
    .include('name', (q) => q('reports').count())
    .get()

  console.dir(r2, { depth: null })
})
