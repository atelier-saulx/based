import { BasedDb } from '../../src/index.js'
import test from '../shared/test.js'
import { deepEqual, equal } from '../shared/assert.js'

await test('single reference', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })
  t.after(() => t.backup(db))
  await db.setSchema({
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

  await db.query('article').include('*', '**').get().inspect()
  await db.query('_article_author:user_articles').include('*').get().inspect()
  deepEqual(
    [...db.server.verifTree.types()].map((type) => type.typeId),
    [2, 3, 4],
  )
  deepEqual(db.server.dirtyRanges.size, 3)
})

await test('json type edge', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })
  t.after(() => db.stop())

  await db.setSchema({
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
    .toObject()

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
