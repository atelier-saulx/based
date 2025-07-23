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

  const t1 = await db.create('team', {
    name: 'my team',
  })
  await db.create('libraryFile', {
    fileType: 'document',
    team: t1,
  })
  await db.create('libraryFile', {
    fileType: 'media',
    team: t1,
  })

  const t2 = await db.create('team', {
    name: 'team 2',
  })
  await db.create('libraryFile', {
    fileType: 'media',
    team: t2,
  })

  await db.create('team', {
    name: 'team 3',
  })

  deepEqual(
    await db
      .query('team', 1)
      .include((s) =>
        s('files').filter('fileType', '=', 'document').include('id'),
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
    'filtering edges with nested syntax, single node',
  )

  //deepEqual(
  //  await db
  //    .query('team')
  //    .filter('$files.fileType', '=', 'document')
  //    .get(),
  //  [
  //    {
  //      id: 1,
  //      files: [
  //        {
  //          id: 1,
  //        },
  //      ],
  //    },
  //  ],
  //  'filtering edges with nested syntax',
  //)

  deepEqual(
    await db
      .query('libraryFile')
      .filter('fileType', '=', 'document')
      .include('id', 'team.id')
      .get(),
    [
      {
        id: 1,
        team: { id: 1 },
      }
    ],
  )

  deepEqual(
    await db
      .query('team')
      .filter('files', 'exists')
      .include((s) =>
        s('files').filter('fileType', '=', 'document').include('id'),
      )
      .get(),
    [
      {
        id: 1,
        files: [
          {
            id: 1,
          },
        ],
      },
      { id: 2, files: [] } // RFE is there a way to filter out this?
    ],
    'filtering edges with branched query',
  )

  // db.query("team").include("*", "**").get().inspect(100);
  // db.query("libraryFile").include("*", "**").get().inspect(100);
})
