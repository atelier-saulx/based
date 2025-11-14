import { deepEqual } from 'assert'
import { BasedDb } from '../src/index.ts'
import test from './shared/test.ts'

await test('copy', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        name: 'string',
      },
      page: {
        name: 'string',
        copiedByYouzi: 'boolean',
        sequence: {
          ref: 'sequence',
          prop: 'pages',
        },
      },
      sequence: {
        name: 'string',
        copiedByYouzi: 'boolean',
        edition: {
          ref: 'edition',
          prop: 'sequences',
        },
      },
      edition: {
        name: 'string',
        copiedByYouzi: 'boolean',
        createdBy: {
          ref: 'user',
          prop: 'users',
        },
        versionOf: {
          ref: 'edition',
          prop: 'versions',
        },
      },
    },
  })

  const edition1 = await db.create('edition', {
    name: 'my cool edition',
    createdBy: await db.create('user', { name: 'youzi' }),
    sequences: [
      await db.create('sequence', {
        name: 'seq 1',
        pages: [
          await db.create('page', {
            name: 'imma page',
          }),
        ],
      }),
    ],
  })

  await db.copy('edition', edition1, {
    copiedByYouzi: true,
    versionOf({ id }) {
      return id
    },
    name({ name }) {
      return name + ' (edition copy)'
    },
    sequences({ sequences }) {
      return sequences.map(({ id }) => {
        return db.copy('sequence', id, {
          copiedByYouzi: true,
          name({ name }) {
            return name + ' (sequence copy)'
          },
          pages({ pages }) {
            return pages.map(({ id }) =>
              db.copy('page', id, {
                copiedByYouzi: true,
                name({ name }) {
                  return name + ' (page copy)'
                },
              }),
            )
          },
        })
      })
    },
  })

  const res = await db
    .query('edition')
    .include('*', 'versionOf', 'versions', 'sequences', 'sequences.pages')
    .get()
    .toObject()

  deepEqual(res, [
    {
      id: 1,
      copiedByYouzi: false,
      name: 'my cool edition',
      versionOf: null,
      versions: [
        {
          copiedByYouzi: true,
          id: 2,
          name: 'my cool edition (edition copy)',
        },
      ],
      sequences: [
        {
          id: 1,
          copiedByYouzi: false,
          name: 'seq 1',
          pages: [{ id: 1, copiedByYouzi: false, name: 'imma page' }],
        },
      ],
    },
    {
      id: 2,
      copiedByYouzi: true,
      name: 'my cool edition (edition copy)',
      versionOf: { id: 1, copiedByYouzi: false, name: 'my cool edition' },
      versions: [],
      sequences: [
        {
          id: 2,
          copiedByYouzi: true,
          name: 'seq 1 (sequence copy)',
          pages: [
            { id: 2, copiedByYouzi: true, name: 'imma page (page copy)' },
          ],
        },
      ],
    },
  ])
})
