import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'
import { convertToTimestamp } from '@saulx/utils'

const defaultTimestamp = '2023-03-15T12:00:00.000Z'
const defaultJson = { enabled: true, value: 10 }
const defaultBinary = new Uint8Array([1, 2, 3])
const defaultText = { en: 'Default Label' }

await test('default values for all props in user type', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return t.backup(db)
  })

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
          // avatar: {
          //   type: 'binary',
          //   default: defaultBinary,
          // },
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
              ref: 'user', // Self-reference for simplicity in this test
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
    await db.query('user', userId).include('*', '**').get().inspect(),
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
      id: userNullId,
      isNice: false,
      name: '',
      count: 0,
      eventTime: convertToTimestamp(defaultTimestamp),
      level: undefined,
      config: null,
      avatar: null,
      slug: 'default-slug',
      label: {},
      friends: [],
      meta: { rating: 0, notes: 'Default Note' },
    },
    'User created with explicit null overrides',
  )
})
