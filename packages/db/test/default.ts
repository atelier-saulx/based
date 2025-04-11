import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

// Define default values for clarity and reuse
const defaultTimestamp = 1678886400000 // Specific date: 2023-03-15T12:00:00.000Z
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
          // Binary
          // avatar: {
          //   type: 'binary',
          //   default: defaultBinary,
          // },
          // Alias
          slug: {
            type: 'alias',
            default: 'default-slug',
          },
          label: {
            type: 'text',
            default: defaultText,
          },
          // References (default to empty array)
          // friends: {
          //   type: 'references',
          //   items: {
          //     ref: 'user', // Self-reference for simplicity in this test
          //     prop: 'friends',
          //   },
          //   default: [],
          // },
          // Nested Object
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
          // Note: 'reference' type default doesn't make sense for an ID.
          // Note: 'cardinality' type default doesn't make sense.
        },
      },
    },
  })

  // Create a user without providing any fields, relying on defaults
  const userId = await db.create('user', {})

  // Verify all default values are set correctly
  deepEqual(
    await db.query('user', userId).get(),
    {
      id: userId,
      isNice: true,
      name: 'Default Name',
      count: 42,
      eventTime: defaultTimestamp,
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

  // Test explicit null override for a few types within the user
  const userNullId = await db.create('user', {
    name: null, // Should become ''
    count: null, // Should become 0
    isNice: null, // Should become false
    config: null, // Should become null
    avatar: null, // Should become null
    level: null, // Should become undefined
    label: null, // Should become {}
    meta: { rating: null }, // Inner null, outer default applies
  })

  deepEqual(
    await db.query('user', userNullId).get(),
    {
      id: userNullId,
      isNice: false, // Overridden
      name: '', // Overridden
      count: 0, // Overridden
      eventTime: defaultTimestamp, // Default
      level: undefined, // Overridden
      config: null, // Overridden
      avatar: null, // Overridden
      slug: 'default-slug', // Default
      label: {}, // Overridden
      friends: [], // Default
      meta: { rating: 0, notes: 'Default Note' }, // Partially overridden
    },
    'User created with explicit null overrides',
  )
})
