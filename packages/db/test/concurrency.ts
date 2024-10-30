import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual, equal } from './shared/assert.js'
import { euobserver } from './shared/examples.js'

await test('concurrency', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    // maxModifySize: 10e4,
    concurrency: 1,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  db.putSchema({
    types: {
      article: {
        props: {
          body: 'string',
        },
      },
      letter: {
        props: {
          body: 'string',
        },
      },
      paper: {
        props: {
          body: 'string',
        },
      },
      user: {
        props: {
          name: { type: 'string' },
          flap: 'uint32',
          email: { type: 'string', max: 15 },
          age: 'uint32',
          snurp: { type: 'string' },
          burp: 'uint32',
          location: {
            props: {
              label: { type: 'string' },
              x: 'uint32',
              y: 'uint32',
            },
          },
        },
      },
    },
  })

  db.create('user', {
    age: 99,
    burp: 66,
    snurp: 'derp derp',
    email: 'merp_merp@once.net',
    location: {
      label: 'BLA BLA',
    },
  })

  await db.drain()

  deepEqual(db.query('user').get().toObject(), [
    {
      id: 1,
      name: '',
      flap: 0,
      email: 'merp_merp@once.net',
      age: 99,
      snurp: 'derp derp',
      burp: 66,
      location: { label: 'BLA BLA', x: 0, y: 0 },
    },
  ])

  console.time('create stuff')
  let articles = 1_000_000
  while (articles--) {
    db.create('article', {
      body: 'nice body ' + articles,
    })
  }

  db.drain()
  let letters = 1_000_000
  while (letters--) {
    db.create('letter', {
      body: 'nice body ' + letters,
    })
  }

  db.drain()
  let papers = 1_000_000
  while (papers--) {
    db.create('paper', {
      body: 'nice body ' + papers,
    })
  }

  db.drain()
  let users = 1_000_000
  while (users--) {
    db.create('user', {
      name: 'nice name ' + users,
    })
  }

  await db.drain()
  console.timeEnd('create stuff')
})
