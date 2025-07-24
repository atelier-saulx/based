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

  //   await db
  //     .query('team')
  //     .include('files')
  //     .filter('files.fileType', '=', 'document')
  //     .get()
  //     .inspect(100)

  db.stop()
})

await test('03', async (t) => {
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

  const tdoc = db.create('team', { name: 'team with only documents' })
  const tmedia = db.create('team', { name: 'team with only media' })
  const tboth = db.create('team', { name: 'team with both' })

  db.create('libraryFile', { fileType: 'document', team: tdoc })
  db.create('libraryFile', { fileType: 'media', team: tmedia })
  db.create('libraryFile', { fileType: 'document', team: tboth })
  db.create('libraryFile', { fileType: 'media', team: tboth })

  //   await db.query('team').include('*', '**').get().inspect(100)
  //   await db.query('libraryFile').include('*', '**').get().inspect(100)

  const teams = await db
    .query('team')
    .include('name', (select) =>
      select('files').filter('fileType', '=', 'document').include('team.id'),
    )
    .get()
    .toObject()

  console.log(teams.filter((f) => f.files.length > 0))

  db.stop()
})

await test('04', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop())

  await db.setSchema({
    types: {
      movie: {
        name: 'string',
        genre: ['Comedy', 'Thriller', 'Drama', 'Crime'],
        actors: {
          items: {
            ref: 'actor',
            prop: 'actors',
            $rating: 'uint16',
          },
        },
      },
      actor: {
        name: 'string',
        rating: 'uint16',
        movies: {
          items: {
            ref: 'movie',
            prop: 'movies',
          },
        },
      },
    },
  })

  const a1 = db.create('actor', {
    name: 'Uma Thurman',
    rating: 999,
  })
  const a2 = db.create('actor', {
    name: 'Jonh Travolta',
    rating: 100,
  })

  const m1 = await db.create('movie', {
    name: 'Kill Bill',
    actors: [
      {
        id: a1,
        $rating: 55,
      },
    ],
  })
  const m2 = await db.create('movie', {
    name: 'Pulp Fiction',
    actors: [
      {
        id: a1,
        $rating: 63,
      },
      {
        id: a2,
        $rating: 77,
      },
    ],
  })

  await db
    .query('movie')
    .include('name')
    .include('actors.$rating')
    .include('actors.name', 'actors.rating')
    .get()
    .inspect(10)
})
