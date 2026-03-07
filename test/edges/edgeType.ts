import test from '../shared/test.js'
import { deepEqual, equal } from '../shared/assert.js'
import {
  countDirtyBlocks,
  testDbServer,
  testDbClient,
} from '../shared/index.js'

await test('single reference', async (t) => {
  const server = await testDbServer(t)
  const db = await testDbClient(server, {
    types: {
      user: {
        props: {
          name: 'string',
          derp: 'uint8',
          articles: {
            items: {
              ref: 'article',
              prop: 'author',
            },
          },
        },
      },
      article: {
        props: {
          name: 'string',
          author: {
            type: 'reference',
            ref: 'user',
            prop: 'articles',
            $note: { type: 'string', maxBytes: 20 },
          },
        },
      },
    },
  })

  const mr = await Promise.all([
    db.create('user', { name: 'Mr Drol' }),
    db.create('user', { name: 'Mr Derp' }),
  ])

  await db.create('article', {
    name: 'The wonders of Strudel',
    author: {
      id: mr[0],
      $note: 'funny',
    },
  })

  deepEqual(await countDirtyBlocks(server), 3)
})

await test('json type edge', async (t) => {
  const server = await testDbServer(t, { noBackup: true })
  const db = await testDbClient(server, {
    types: {
      workspace: {
        name: 'string',
      },
      serviceAccount: {
        username: 'alias',
        passwordHash: 'string',
        expiresAt: 'timestamp',

        workspaces: {
          items: {
            ref: 'workspace',
            prop: 'serviceAccounts',
            $permissionsString: 'string',
            $permissionsJson: 'json',
          },
        },
      },
    },
  })

  const workspaceId = await db.create('workspace', { name: 'Workspace A' })
  const serviceAccountId = await db.create('serviceAccount', {
    username: 'service-account-1',
    workspaces: [
      {
        id: workspaceId,
        $permissionsString: JSON.stringify({ key: 'value' }),
        $permissionsJson: { key: 'value' },
      },
    ],
  })
  const retrieved = await db
    .query('serviceAccount', serviceAccountId)
    .include(
      'id',
      'workspaces.id',
      'workspaces.$permissionsString',
      'workspaces.$permissionsJson',
    )
    .get()

  equal(retrieved?.workspaces.length, 1, 'Expected to have length 1')
  deepEqual(
    retrieved,
    {
      id: 1,
      workspaces: [
        {
          id: 1,
          $permissionsString: '{"key":"value"}',
          $permissionsJson: { key: 'value' },
        },
      ],
    },
    'Expected json + string to be equal',
  )
})
