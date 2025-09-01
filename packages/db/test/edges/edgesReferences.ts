import { BasedDb } from '../../src/index.js'
import test from '../shared/test.js'
import { deepEqual } from '../shared/assert.js'

await test('multi reference', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          email: 'string',
          name: 'string',
          smurp: 'string',
          articles: {
            items: {
              ref: 'article',
              prop: 'contributors',
            },
          },
          location: {
            props: {
              long: 'number',
              lat: 'number',
            },
          },
        },
      },
      country: {
        props: {
          code: { type: 'string', maxBytes: 2 },
          name: 'string',
        },
      },
      article: {
        props: {
          name: 'string',
          contributors: {
            type: 'references',
            items: {
              ref: 'user',
              prop: 'articles',
              $derp: 'uint8',
              $age: 'uint32',
              $plonki: 'uint32',
              $friend: {
                ref: 'user',
              },
              $countries: {
                items: {
                  ref: 'country',
                },
              },
            },
          },
        },
      },
    },
  })

  const mrSnurp = db.create('user', {
    name: 'Mr snurp',
    location: {
      long: 42.12,
      lat: 32.14,
    },
  })

  const mrYur = db.create('user', {
    name: 'Mr Yur',
  })

  const mrDerp = db.create('user', {
    name: 'Mr Derp',
  })

  const mrDerp2 = db.create('user', {
    name: 'Mr Derp2',
  })

  const mrDerp3 = db.create('user', {
    name: 'Mr Derp3',
  })

  await db.drain()

  await db.create('article', {
    name: 'The wonders of Strudel',
    contributors: [
      {
        id: mrSnurp,
        $friend: mrDerp3, // id 5
        $derp: 99,
        $age: 66,
      },
    ],
  })

  deepEqual(
    await db
      .query('article')
      .include('contributors.$age')
      .get()
      .then((v) => v.toObject()),
    [{ id: 1, contributors: [{ id: 1, $age: 66 }] }],
    'age 66',
  )

  deepEqual(
    await db
      .query('article')
      .include('contributors.$friend.name', 'contributors.$friend.location')
      .get(),
    [
      {
        id: 1,
        contributors: [
          {
            id: 1,
            $friend: {
              id: 5,
              location: { long: 0, lat: 0 },
              name: 'Mr Derp3',
            },
          },
        ],
      },
    ],
    'Friend include name/location',
  )

  deepEqual(
    await db.query('article').include('contributors.$friend').get(),
    [
      {
        id: 1,
        contributors: [
          {
            id: 1,
            $friend: {
              id: 5,
              location: { long: 0, lat: 0 },
              name: 'Mr Derp3',
              email: '',
              smurp: '',
            },
          },
        ],
      },
    ],
    'Friend include all',
  )
})

await test('multiple references', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      country: {
        props: {
          code: { type: 'string', maxBytes: 2 },
          name: 'string',
          users: { items: { ref: 'user', prop: 'nationality' } },
        },
      },
      user: {
        props: {
          name: 'string',
          nationality: { ref: 'country', prop: 'users' },
          articles: {
            items: {
              ref: 'article',
              prop: 'contributors',
            },
          },
        },
      },
      article: {
        props: {
          name: 'string',
          contributors: {
            type: 'references',
            items: {
              ref: 'user',
              prop: 'articles',
              $countries: {
                items: {
                  ref: 'country',
                },
              },
            },
          },
        },
      },
    },
  })

  const uk = await db.create('country', {
    name: 'United Kingdom',
    code: 'uk',
  })

  const de = await db.create('country', {
    name: 'Germany',
    code: 'de',
  })

  const nl = await db.create('country', {
    name: 'Netherlands',
    code: 'nl',
  })

  const mrDerp = await db.create('user', {
    name: 'Mr Derp',
    nationality: nl,
  })

  const mrFlap = await db.create('user', {
    name: 'Mr Falp',
    nationality: de,
  })

  await db.create('article', {
    name: 'The wonders of Strudel',
    contributors: [
      {
        id: mrDerp,
        $countries: [uk, de],
      },
    ],
  })

  await db.create('article', {
    name: 'The secrets of sourkraut',
    contributors: [
      {
        id: mrFlap,
        $countries: [nl, de],
      },
    ],
  })

  deepEqual(
    await db
      .query('article')
      .include('contributors.id')
      .get()
      .then((v) => v.toObject()),
    [
      { id: 1, contributors: [{ id: mrDerp }] },
      { id: 2, contributors: [{ id: mrFlap }] },
    ],
  )

  deepEqual(
    await db
      .query('article')
      .include('contributors.id', 'contributors.$countries.id')
      .get()
      .then((v) => v.toObject()),
    [
      {
        id: 1,
        contributors: [{ id: mrDerp, $countries: [{ id: 1 }, { id: 2 }] }],
      },
      {
        id: 2,
        contributors: [{ id: mrFlap, $countries: [{ id: 3 }, { id: 2 }] }],
      },
    ],
  )

  deepEqual(
    await db
      .query('article')
      .include('contributors.id', 'contributors.$countries.code')
      .get()
      .then((v) => v.toObject()),
    [
      {
        id: 1,
        contributors: [
          {
            id: mrDerp,
            $countries: [
              { id: 1, code: 'uk' },
              { id: 2, code: 'de' },
            ],
          },
        ],
      },
      {
        id: 2,
        contributors: [
          {
            id: mrFlap,
            $countries: [
              { id: 3, code: 'nl' },
              { id: 2, code: 'de' },
            ],
          },
        ],
      },
    ],
  )

  deepEqual(
    await db
      .query('article')
      .include('contributors.id', 'contributors.$countries')
      .get()
      .then((v) => v.toObject()),
    [
      {
        id: 1,
        contributors: [
          {
            id: mrDerp,
            $countries: [
              { id: 1, code: 'uk', name: 'United Kingdom' },
              { id: 2, code: 'de', name: 'Germany' },
            ],
          },
        ],
      },
      {
        id: 2,
        contributors: [
          {
            id: mrFlap,
            $countries: [
              { id: 3, code: 'nl', name: 'Netherlands' },
              { id: 2, code: 'de', name: 'Germany' },
            ],
          },
        ],
      },
    ],
  )

  deepEqual(
    await db
      .query('article')
      .include((t) => {
        t('contributors').include('$countries').include('name').sort('name')
      })
      .get()
      .then((v) => v.toObject()),
    [
      {
        id: 1,
        contributors: [
          {
            id: 1,
            $countries: [
              { id: 1, code: 'uk', name: 'United Kingdom' },
              { id: 2, code: 'de', name: 'Germany' },
            ],
            name: 'Mr Derp',
          },
        ],
      },
      {
        id: 2,
        contributors: [
          {
            id: 2,
            $countries: [
              { id: 3, code: 'nl', name: 'Netherlands' },
              { id: 2, code: 'de', name: 'Germany' },
            ],
            name: 'Mr Falp',
          },
        ],
      },
    ],
  )

  deepEqual(
    await db
      .query('article')
      .include((t) => {
        t('contributors').include('name').filter('nationality', '=', nl)
      })
      .get()
      .then((v) => v.toObject()),
    [
      {
        id: 1,
        contributors: [
          {
            id: 1,
            name: 'Mr Derp',
          },
        ],
      },
      {
        id: 2,
        contributors: [],
      },
    ],
  )

  deepEqual(
    await db
      .query('article')
      .include((t) => {
        t('contributors')
          .include('name')
          .include('$countries')
          .sort('name')
          .filter('nationality', '=', nl)
      })
      .get()
      .then((v) => v.toObject()),
    [
      {
        id: 1,
        contributors: [
          {
            id: 1,
            name: 'Mr Derp',
            $countries: [
              { id: 1, code: 'uk', name: 'United Kingdom' },
              { id: 2, code: 'de', name: 'Germany' },
            ],
          },
        ],
      },
      {
        id: 2,
        contributors: [],
      },
    ],
  )

  deepEqual(
    await db
      .query('article')
      .include((s) => {
        s('contributors')
          .include('name')
          .include((s) => {
            s('$countries').include('code')
          })
          .sort('name')
          .filter('nationality', '=', nl)
      })
      .get()
      .toObject(),
    [
      {
        id: 1,
        contributors: [
          {
            id: 1,
            name: 'Mr Derp',
            $countries: [
              { id: 1, code: 'uk' },
              { id: 2, code: 'de' },
            ],
          },
        ],
      },
      { id: 2, contributors: [] },
    ],
  )

  deepEqual(
    await db
      .query('article')
      .include((s) => {
        s('contributors')
          .include('name')
          .include((s) => {
            s('$countries').include('code').filter('code', '=', 'de')
          })
          .sort('name')
          .filter('nationality', '=', nl)
      })
      .get()
      .then((v) => v.toObject()),
    [
      {
        id: 1,
        contributors: [
          {
            id: 1,
            name: 'Mr Derp',
            $countries: [{ id: 2, code: 'de' }],
          },
        ],
      },
      { id: 2, contributors: [] },
    ],
  )

  deepEqual(
    await db
      .query('article')
      .include((s) => {
        s('contributors')
          .include('name')
          .include((s) => {
            s('$countries').include('code').sort('code')
          })
          .sort('name')
          .filter('nationality', '=', nl)
      })
      .get()
      .then((v) => v.toObject()),
    [
      {
        id: 1,
        contributors: [
          {
            id: 1,
            name: 'Mr Derp',
            $countries: [
              { id: 2, code: 'de' },
              { id: 1, code: 'uk' },
            ],
          },
        ],
      },
      { id: 2, contributors: [] },
    ],
  )
})

await test('simple references', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      round: {
        name: 'alias',
      },
      sequence: {
        name: 'alias',
      },
      scenario: {
        name: 'alias',
      },
      phase: {
        name: 'alias',
        round: {
          ref: 'round',
          prop: 'phases',
        },
        scenarios: {
          items: {
            ref: 'scenario',
            prop: 'phases',
            $sequence: {
              ref: 'sequence',
            },
          },
        },
      },
    },
  })

  const phaseId = await db.create('phase', { name: 'phase' })
  const scenarioId1 = await db.create('scenario', { name: 'scenario' })
  // const scenarioId2 = await db.create('scenario', { name: 'scenario' })
  // const scenarioId3 = await db.create('scenario', { name: 'scenario' })
  const sequenceId = await db.create('sequence', { name: 'sequence' })

  await db.save()

  await db.update('phase', phaseId, {
    scenarios: {
      add: [
        {
          id: scenarioId1,
          $sequence: sequenceId,
        },
      ],
    },
  })

  deepEqual(await db.query('phase').include('scenarios').get().inspect(), [
    { id: 1, scenarios: [{ id: scenarioId1, name: 'scenario' }] },
  ])
})

await test('many to many', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  t.after(() => t.backup(db))

  await db.start()

  await db.setSchema({
    types: {
      phase: {
        name: 'string',
        scenarios: {
          items: {
            ref: 'phase',
            prop: 'scenarios',
            $name: {
              type: 'string',
            },
          },
        },
      },
    },
  })

  const phaseId = await db.create('phase', { name: 'phase' })
  const phaseId2 = await db.create('phase', { name: 'phase' })
  const phaseId3 = await db.create('phase', { name: 'phase' })

  await db.update('phase', phaseId, {
    scenarios: { add: [{ id: phaseId2, $name: 'a' }] },
  })

  // await db.query('phase').include('scenarios').get().

  deepEqual(await db.query('phase').include('scenarios').get(), [
    { id: 1, scenarios: [{ id: 2, name: 'phase' }] },
    { id: 2, scenarios: [{ id: 1, name: 'phase' }] },
    { id: 3, scenarios: [] },
  ])

  await db.update('phase', phaseId, {
    scenarios: { add: [{ id: phaseId3, $name: 'b' }] },
  })

  await db.drain()

  deepEqual(await db.query('phase').include('scenarios').get(), [
    {
      id: 1,
      scenarios: [
        { id: 2, name: 'phase' },
        { id: 3, name: 'phase' },
      ],
    },
    { id: 2, scenarios: [{ id: 1, name: 'phase' }] },
    { id: 3, scenarios: [{ id: 1, name: 'phase' }] },
  ])
})
