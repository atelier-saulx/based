import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('filter edges', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop())

  await db.setSchema({
    types: {
      team: {
        props: {
          name: 'string',
        },
      },
      libraryFile: {
        props: {
          fileType: ['document', 'media'],
          team: {
            ref: 'team',
            prop: 'files',
          },
        },
      },
    },
  })

  let t1 = db.create('team', {
    name: 'my team',
  })

  const doc = db.create('libraryFile', {
    fileType: 'document',
    team: t1,
  })

  db.create('libraryFile', {
    fileType: 'media',
    team: t1,
  })

  const t2 = db.create('team', {
    name: 'team 2',
  })
  const t3 = db.create('team', {
    name: 'team 3',
  })

  const doc2 = db.create('libraryFile', {
    fileType: 'document',
    team: t3,
  })

  deepEqual(
    await db
      .query('team', 1)
      .include((q) =>
        q('files').filter('fileType', '=', 'document').include('id'),
      )
      .get(),
    {
      id: 1,
      files: [
        {
          id: 1,
        },
      ],
    },
    'filtering edges with branched query assuming there is only one value',
  )

  deepEqual(
    await db
      .query('team')
      .filter('files', 'exists')
      .include((s) =>
        s('files').filter('fileType', '=', 'document').include('id'),
      )
      .filter('files', 'exists')
      .include((s) =>
        s('files').filter('fileType', '=', 'document').include('id'),
      )
      .get(),
    [
      { id: 1, files: [{ id: 1 }] },
      { id: 3, files: [{ id: 3 }] },
    ],
    'filtering edges with branched query',
  )
})

await test('filter references', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop())

  await db.setSchema({
    types: {
      team: {
        props: {
          name: 'string',
        },
      },
      libraryFile: {
        props: {
          fileType: ['document', 'media'],
          teams: {
            items: {
              ref: 'team',
              prop: 'files',
            },
          },
        },
      },
    },
  })

  let t1 = db.create('team', {
    name: 'my team',
  })

  const doc = db.create('libraryFile', {
    fileType: 'document',
    teams: [t1],
  })

  db.create('libraryFile', {
    fileType: 'media',
    teams: [t1],
  })

  const t2 = db.create('team', {
    name: 'team 2',
  })
  const t3 = db.create('team', {
    name: 'team 3',
  })

  const doc2 = db.create('libraryFile', {
    fileType: 'document',
    teams: [t3],
  })
  //   await db.query('team').include('*', '**').get().inspect(100)
  //   await db.query('libraryFile').include('*', '**').get().inspect(100)

  await db
    .query('team')
    .include('files')
    .filter('files.fileType', '=', 'document')
    .get()
    .inspect(100)

  db.stop()
})
