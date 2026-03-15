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
          deliveredDate: 'timestamp',
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
    deliveredDate: new Date('2022-01-02'),
    customer: c1,
    smsStatus: 'sent',
    cost: 1.99,
  })
  const d2 = db.create('report', {
    date: new Date('2022-01-01'),
    deliveredDate: new Date('2022-01-01'),
    customer: c2,
    smsStatus: 'sent',
    cost: 0.85,
  })
  const d3 = db.create('report', {
    date: new Date('2022-01-02'),
    deliveredDate: new Date('2022-01-03'),
    customer: c1,
    smsStatus: 'sent',
    cost: 1.99,
  })
  const d4 = db.create('report', {
    date: new Date('2022-01-02'),
    deliveredDate: new Date('2022-01-02'),
    customer: c2,
    smsStatus: 'sent',
    cost: 0.99,
  })
  const d5 = db.create('report', {
    date: new Date('2022-01-02'),
    deliveredDate: new Date('2022-01-02'),
    customer: c2,
    smsStatus: 'delivered',
    cost: 0.85,
  })
  const d6 = db.create('report', {
    date: new Date('2022-01-02'),
    deliveredDate: new Date('2022-01-02'),
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

  //   // get sum of sms costs group by sms status per customer
  //   const r3 = await db
  //     .query2('customer')
  //     .include('name')
  //     .sum('reports.cost')
  //     .groupBy('reports.smsStatus')
  //     .get()

  //   console.dir(r3, { depth: null })

  //
  const r4 = await db
    .query('customer')
    .avg('age')
    .groupBy('region', 'gender')
    .get()

  // console.dir(r4, { depth: null })

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

  const r5 = await db
    .query('report')
    .avg('cost')
    .groupBy('smsStatus', 'date', { display: dtFormat })
    .get()

  deepEqual(
    r5,

    {
      failed: {
        //@ts-ignore
        '02/01/2022': { cost: { avg: 0.5 } },
      },
      sent: {
        //@ts-ignore
        '01/01/2022': { cost: { avg: 1.42 } },
        '02/01/2022': { cost: { avg: 1.49 } },
      },
      delivered: {
        //@ts-ignore
        '02/01/2022': { cost: { avg: 0.85 } },
      },
    },
    'avg sms cost group by sms status and date',
  )

  const r6 = await db
    .query('report')
    .avg('cost')
    .groupBy('date', { display: dtFormat })
    .groupBy('deliveredDate', { display: dtFormat })
    .get()

  deepEqual(
    r6,

    {
      '02/01/2022': {
        //@ts-ignore
        '02/01/2022': { cost: { avg: 0.7799999999999999 } },
        '03/01/2022': { cost: { avg: 1.99 } },
      },
      '01/01/2022': {
        //@ts-ignore
        '02/01/2022': { cost: { avg: 1.99 } },
        '01/01/2022': { cost: { avg: 0.85 } },
      },
    },
    'avg sms cost group by date and delivered date',
  )
})

await test('group By multiple edges', async (t) => {
  const db = await testDb(t, {
    types: {
      movie: {
        name: 'string',
        genre: ['Comedy', 'Thriller', 'Drama', 'Crime'],
        actors: {
          items: {
            ref: 'actor',
            prop: 'movies',
            $rating: 'uint16',
            $hating: 'uint16',
            $role: 'string',
            $roleType: ['Lead', 'Supporting', 'Cameo', 'Extra', 'Voiceover'],
            $salary: 'uint16',
            $hired: 'timestamp',
          },
        },
      },
      actor: {
        name: 'string',
        strong: 'uint16',
        strong2: 'uint16',
        movies: {
          items: {
            ref: 'movie',
            prop: 'actors',
          },
        },
      },
    },
  })

  const a1 = db.create('actor', {
    name: 'Uma Thurman',
    strong: 10,
    strong2: 80,
  })
  const a2 = db.create('actor', {
    name: 'Jonh Travolta',
    strong: 5,
    strong2: 40,
  })

  const m1 = await db.create('movie', {
    name: 'Kill Bill',
    genre: 'Thriller',
    actors: [
      {
        id: a1,
        $rating: 55,
        $hating: 5,
        $role: 'Supporting',
        $roleType: 'Lead',
        $salary: 12000,
        $hired: new Date('2025-01-01'),
      },
    ],
  })
  const m2 = await db.create('movie', {
    name: 'Pulp Fiction',
    genre: 'Crime',
    actors: [
      {
        id: a1,
        $rating: 63,
        $hating: 7,
        $role: 'Mia Wallace',
        $roleType: 'Lead',
        $salary: 300,
        $hired: new Date('1994-12-11'),
      },
      {
        id: a2,
        $rating: 77,
        $hating: 3,
        $role: 'Vincent Vega',
        $roleType: 'Lead',
        $salary: 300,
        $hired: new Date('1994-12-11'),
      },
    ],
  })

  const r1 = await db
    .query('movie')
    .avg('actors.$rating')
    .groupBy('actors.$roleType')
    .groupBy('actors.$salary', { step: 500 })
    .get()

  deepEqual(
    r1,

    [
      {
        id: 1,
        actors: {
          //@ts-ignore
          Lead: { '12000': { $rating: { avg: 55 } } },
        },
      },
      {
        id: 2,
        actors: {
          //@ts-ignore
          Lead: { '300': { $rating: { avg: 70 } } },
        },
      },
    ],
    'avg movie rating (Edge) group by actors role type and salary range (Edges)',
  )

  const r2 = await db
    .query('movie')
    .sum('actors.strong')
    .groupBy('actors.name')
    .get()

  deepEqual(
    r2,
    [
      {
        id: 1,
        actors: {
          //@ts-ignore
          'Uma Thurman': { strong: { sum: 10 } },
        },
      },
      {
        id: 2,
        actors: {
          //@ts-ignore
          'Uma Thurman': { strong: { sum: 10 } },
          'Jonh Travolta': { strong: { sum: 5 } },
        },
      },
    ],
    'sum movie actors strong group by actors name (References)',
  )

  const r3 = await db
    .query('movie')
    .avg('actors.$rating')
    .groupBy('genre')
    .get()

  deepEqual(
    r3,

    {
      Thriller: {
        //@ts-ignore
        $rating: { avg: 55 },
      },
      //@ts-ignore
      Crime: {
        //@ts-ignore
        $rating: { avg: 70 }, // 63 + 77 / 2
      },
    },
    'avg movie rating (Edge) group by genre (main Property)',
  )

  const r4 = await db
    .query('movie')
    .avg('actors.$rating')
    .groupBy('genre')
    .groupBy('actors.$roleType')
    .get()

  deepEqual(
    r4,
    {
      //@ts-ignore
      Thriller: {
        //@ts-ignore
        Lead: { $rating: { avg: 55 } },
      },
      //@ts-ignore
      Crime: {
        //@ts-ignore
        Lead: { $rating: { avg: 70 } },
      },
    },
    'avg movie rating (Edge) group by genre (main Property) and actors role type (Edges)',
  )
})
