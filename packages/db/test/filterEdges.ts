import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('filter edges', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })

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

  let t1 = await db.create('team', {
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

  await db.create('team', {
    name: 'team 2',
  })
  await db.create('team', {
    name: 'team 3',
  })

  deepEqual(
    await db
      .query('team')
      .include('files')
      .filter('$files.fileType', '=', 'document')
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
    ],
    'filtering edges with nested sintax',
  )

  deepEqual(
    await db
      .query('team')
      .include((q) => q('files').filter('fileType', '=', 'document'))
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
    ],
    'filtering edges with branched query',
  )

  // db.query("team").include("*", "**").get().inspect(100);
  // db.query("libraryFile").include("*", "**").get().inspect(100);
})
