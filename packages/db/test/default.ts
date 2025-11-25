import { BasedDb } from '../src/db.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'
import { convertToTimestamp } from '../src/utils/index.js'

const derp = new Set([
  '$nice',
  '$role',
  '$count',
  '$score',
  '$flag',
  '$amount',
  '$big',
  '$huge',
  '$max',
  '$label',
  '$bin',
  '$timestamp',
  '$enum',
])

const defaultTimestamp = '2023-03-15T12:00:00.000Z'
const defaultJson = { enabled: true, value: 10 }
const defaultBinary = new Uint8Array([1, 2, 3])
const defaultText = { en: 'Default Label' }

await test('edges', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  // Add all supported data types as edge properties (no date/text)
  await db.setSchema({
    types: {
      user: {
        props: {
          friends: {
            items: {
              ref: 'user',
              prop: 'friends',
              $nice: { type: 'boolean', default: true },
              $role: { enum: ['admin', 'derp'], default: 'admin' },
              $count: { type: 'number', default: 0 },
              $score: { type: 'uint8', default: 42 },
              $flag: { type: 'int8', default: -1 },
              $amount: { type: 'int16', default: 1234 },
              $big: { type: 'uint16', default: 4321 },
              $huge: { type: 'int32', default: 123456 },
              $max: { type: 'uint32', default: 654321 },
              $label: { type: 'string', default: 'default label' },
              $bin: { type: 'binary', default: new Uint8Array([1, 2, 3]) },
              // $json: { type: 'json', default: { foo: 'bar', num: 1 } },
              $timestamp: { type: 'timestamp', default: 1680000000000 },
              $enum: { enum: ['a', 'b', 'c'], default: 'a' },
            },
          },
        },
      },
    },
  })

  const userId = await db.create('user', {
    friends: [db.create('user')],
  })

  deepEqual(await db.query('user', userId).include('friends.**').get(), {
    id: 2,
    friends: [
      {
        id: 1,
        friends: [
          {
            id: 2,
            $nice: true,
            $role: 'admin',
            $count: 0,
            $score: 42,
            $flag: -1,
            $amount: 1234,
            $big: 4321,
            $huge: 123456,
            $max: 654321,
            $timestamp: 1680000000000,
            $enum: 'a',
            $label: 'default label',
            $bin: new Uint8Array([1, 2, 3]),
          },
        ],
      },
    ],
  })

  await db.update('user', userId, {
    friends: {
      update: [{ id: 1, $role: 'derp' }],
    },
  })

  deepEqual(await db.query('user', userId).include('friends.**').get(), {
    id: 2,
    friends: [
      {
        id: 1,
        friends: [
          {
            id: 2,
            $nice: true,
            $role: 'derp',
            $count: 0,
            $score: 42,
            $flag: -1,
            $amount: 1234,
            $big: 4321,
            $huge: 123456,
            $max: 654321,
            $timestamp: 1680000000000,
            $enum: 'a',
            $label: 'default label',
            $bin: new Uint8Array([1, 2, 3]),
          },
        ],
      },
    ],
  })

  await db.update('user', userId, {
    friends: {
      update: [{ id: 1, $nice: false }],
    },
  })

  deepEqual(await db.query('user', userId).include('friends.**').get(), {
    id: 2,
    friends: [
      {
        id: 1,
        friends: [
          {
            id: 2,
            $nice: false,
            $role: 'derp',
            $count: 0,
            $score: 42,
            $flag: -1,
            $amount: 1234,
            $big: 4321,
            $huge: 123456,
            $max: 654321,
            $timestamp: 1680000000000,
            $enum: 'a',
            $label: 'default label',
            $bin: new Uint8Array([1, 2, 3]),
          },
        ],
      },
    ],
  })
})

await test('separate', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    locales: {
      en: {},
      fi: {},
      fr: {},
    },
    types: {
      user: {
        props: {
          avatar: {
            type: 'binary',
            default: defaultBinary,
          },
          name: {
            type: 'string',
            default: 'Default Name',
          },
          flap: {
            type: 'text',
            default: {
              en: 'Untitled',
              fi: 'Nimeton',
              fr: 'Sans nom',
            },
          },
        },
      },
    },
  })

  const userId = await db.create('user', {})

  deepEqual(
    await db.query('user', userId).include('*', '**').get(),
    {
      id: userId,
      flap: {
        en: 'Untitled',
        fi: 'Nimeton',
        fr: 'Sans nom',
      },
      name: 'Default Name',
      avatar: defaultBinary,
    },
    'Default name',
  )

  const userId2 = await db.create('user', {
    flap: {
      en: 'Flap',
    },
  })

  deepEqual(
    await db.query('user', userId2).include('*', '**').get(),
    {
      id: userId2,
      flap: {
        en: 'Flap',
        fi: 'Nimeton',
        fr: 'Sans nom',
      },
      name: 'Default Name',
      avatar: defaultBinary,
    },
    'Default name',
  )
})

await test('default values for all props in user type', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    locales: {
      en: {},
    },
    types: {
      user: {
        props: {
          isNice: {
            type: 'boolean',
            default: true,
          },
          name: {
            type: 'string',
            default: 'Default Name',
          },
          count: {
            type: 'uint32',
            default: 42,
          },
          eventTime: {
            type: 'timestamp',
            default: defaultTimestamp,
          },
          level: {
            enum: ['low', 'medium', 'high'],
            default: 'medium',
          },
          config: {
            type: 'json',
            default: defaultJson,
          },
          avatar: {
            type: 'binary',
            default: defaultBinary,
          },
          slug: {
            type: 'alias',
            default: 'default-slug',
          },
          label: {
            type: 'text',
            default: defaultText,
          },
          friends: {
            type: 'references',
            items: {
              ref: 'user',
              prop: 'friends',
            },
            // default: [], // something in there
          },
          meta: {
            props: {
              rating: {
                type: 'uint8',
                default: 5,
              },
              notes: {
                type: 'string',
                default: 'Default Note',
              },
            },
          },
        },
      },
    },
  })

  const userId = await db.create('user', {})

  deepEqual(
    await db.query('user', userId).include('*', '**').get(),
    {
      id: userId,
      isNice: true,
      name: 'Default Name',
      count: 42,
      eventTime: convertToTimestamp(defaultTimestamp),
      level: 'medium',
      config: defaultJson,
      avatar: defaultBinary,
      slug: 'default-slug',
      label: defaultText,
      friends: [],
      meta: { rating: 5, notes: 'Default Note' },
    },
    'User created with all default values',
  )

  const userNullId = await db.create('user', {
    name: null,
    count: null,
    isNice: null,
    config: null,
    avatar: null,
    level: null,
    label: null,
    meta: { rating: null },
  })

  deepEqual(
    await db.query('user', userNullId).get(),
    {
      id: 2,
      label: { en: 'Default Label' },
      isNice: true,
      count: 42,
      eventTime: 1678881600000,
      level: 'medium',
      meta: { rating: 5, notes: 'Default Note' },
      name: 'Default Name',
      config: { enabled: true, value: 10 },
      avatar: new Uint8Array([1, 2, 3]),
      slug: 'default-slug',
    },
    'User created with explicit null overrides',
  )
})

await test('negative default values for numeric types', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          negativeNumber: {
            type: 'number',
            default: -42,
          },
          negativeInt16: {
            type: 'int16',
            default: -1234,
          },
          negativeInt32: {
            type: 'int32',
            default: -123456,
          },
          // int8 already tested with negative value in edges test
          // uint types shouldn't have negative defaults
        },
      },
    },
  })

  const userId = await db.create('user', {})

  deepEqual(
    await db.query('user', userId).get(),
    {
      id: userId,
      negativeNumber: -42,
      negativeInt16: -1234,
      negativeInt32: -123456,
    },
    'User created with negative default values',
  )

  const userOverrideId = await db.create('user', {
    negativeNumber: -100,
    negativeInt16: -2000,
    negativeInt32: -500000,
  })

  deepEqual(
    await db.query('user', userOverrideId).get(),
    {
      id: 2,
      negativeNumber: -100,
      negativeInt16: -2000,
      negativeInt32: -500000,
    },
    'User created with overridden negative values',
  )
})

await test('object', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      snurp: {
        preferences: {
          type: 'object',
          props: {
            units: ['metric', 'imperial'],
            theme: ['light', 'dark'],
            toursEnabled: { type: 'boolean', default: true },
            analyticsEnabled: { type: 'boolean', default: false },
          },
        },
      },
    },
  })

  const snurpId = await db.create('snurp', {})

  deepEqual(
    await db.query('snurp', snurpId).get(),
    {
      id: snurpId,
      preferences: {
        units: undefined,
        theme: undefined,
        toursEnabled: true,
        analyticsEnabled: false,
      },
    },
    'empty object has default values',
  )

  const snurpCustomId = await db.create('snurp', {
    preferences: {
      units: 'imperial',
      theme: 'dark',
      toursEnabled: false,
      analyticsEnabled: true,
    },
  })

  deepEqual(await db.query('snurp', snurpCustomId).get(), {
    id: 2,
    preferences: {
      units: 'imperial',
      theme: 'dark',
      toursEnabled: false,
      analyticsEnabled: true,
    },
  })
})
