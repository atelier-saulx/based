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
          cost: 'number',
        },
      },
      customer: {
        props: {
          name: 'string',
          gender: gender,
          age: 'uint8',
          region: 'string',
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
    age: 50,
    region: 'south',
  })
  const c2 = db.create('customer', {
    name: 'Margie',
    gender: 'female',
    age: 49,
    region: 'east',
  })
  const c3 = db.create('customer', {
    name: 'Lisa Marie',
    gender: 'female',
    age: 7,
    region: 'east',
  })
  const c4 = db.create('customer', {
    name: 'Bart',
    gender: 'male',
    age: 9,
    region: 'central',
  })
  const c5 = db.create('customer', {
    name: 'Jessica Lovejoy',
    gender: 'female',
    age: 8,
    region: 'central',
  })

  const dtFormat = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeZone: 'UTC',
  })

  const d1 = db.create('report', {
    date: new Date('2022-01-01'),
    customer: c1,
    smsStatus: 'sent',
    cost: 1.99,
  })
  const d2 = db.create('report', {
    date: new Date('2022-01-01'),
    customer: c2,
    smsStatus: 'sent',
    cost: 0.85,
  })
  const d3 = db.create('report', {
    date: new Date('2022-01-02'),
    customer: c1,
    smsStatus: 'sent',
    cost: 1.99,
  })
  const d4 = db.create('report', {
    date: new Date('2022-01-02'),
    customer: c2,
    smsStatus: 'sent',
    cost: 0.99,
  })
  const d5 = db.create('report', {
    date: new Date('2022-01-02'),
    customer: c2,
    smsStatus: 'delivered',
    cost: 0.85,
  })
  const d6 = db.create('report', {
    date: new Date('2022-01-02'),
    customer: c2,
    smsStatus: 'failed',
    cost: 0.5,
  })

  //   // get report count by date
  //   const r1 = await db
  //     .query2('report')
  //     .count()
  //     .groupBy('date', { display: dtFormat })
  //     .get()

  //   deepEqual(
  //     r1,
  //     { '02/01/2022': { count: 4 }, '01/01/2022': { count: 2 } },
  //     'report count by date',
  //   )

  //   // get report count by date per genre
  //   //await db.query2('customer').avg('age').groupBy('gender').get()
  //   const r2 = await db
  //     .query2('customer')
  //     .include('name', (q) => q('reports').count())
  //     .get()

  //   console.dir(r2, { depth: null })

  // get sum of sms costs group by sms status per customer
  // const r3 = await db
  //   .query('customer')
  //   .include('name')
  //   .sum('reports.cost')
  //   .groupBy('reports.smsStatus')
  //   .get()

  // console.dir(r3, { depth: null })

  //
  const r4 = await db
    .query('customer')
    .avg('age')
    .groupBy('region', 'gender')
    .get()

  console.dir(r4, { depth: null })

  deepEqual(
    r4,

    {
      central: {
        //@ts-ignore
        female: { age: { avg: 8 } },
        male: { age: { avg: 9 } },
      },
      south: {
        //@ts-ignore
        // female: { age: { avg: 0 } },  // no data, no key
        male: { age: { avg: 50 } },
      },
      east: {
        //@ts-ignore
        female: { age: { avg: 28 } },
        // male: { age: { avg: 0 } }, // no data, no key
      },
    },
    'avg customers age group by region and gender',
  )
})
