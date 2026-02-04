import { BasedDb } from '../../src/index.js'
import { deepEqual, equal } from '../shared/assert.js'
import test from '../shared/test.js'
import { setTimeout } from 'node:timers/promises'

await test('simple', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.destroy())

  await db.setSchema({
    locales: {
      en: { required: true },
      fr: { required: true },
      nl: { required: true },
      el: { required: true },
      he: { required: true },
      it: { required: true },
      lv: { required: true },
      lb: { required: true },
      ro: { required: true },
      sl: { required: true },
      es: { required: true },
      de: { required: true },
      cs: { required: true },
      et: { required: true },
    },
    types: {
      user: {
        props: {
          name: { type: 'string' },
          email: { type: 'string' },
          age: { type: 'uint32' },
          story: { type: 'string' },
          test: { ref: 'typeTest', prop: 'q' },
          alias: { type: 'alias' },
        },
      },
      typeTest: {
        props: {
          a: { type: 'string' },
          b: { type: 'number' },
          c: { type: 'boolean' },
          //d: { type: 'object' },
          e: { type: 'timestamp' },
          f: { type: 'binary' },
          g: { type: 'alias' },
          h: { type: 'text' },
          i: { type: 'json' },
          j: { type: 'cardinality' },
          k: { type: 'int8' },
          l: { type: 'int16' },
          m: { type: 'uint16' },
          n: { type: 'int32' },
          o: { type: 'uint32' },
          //p: { type: 'references', ref: 'typeTest', prop: 'reference' },
          q: { type: 'reference', ref: 'user', prop: 'test' },
          r: { type: 'enum', enum: ['a', 'b', 'c'] },
          s: { type: 'vector', size: 1, baseType: 'float32' },
          //t: { type: 'set' },
        },
      },
    },
  })

  db.create('user', {
    name: 'youzi',
    email: 'youzi@yazi.yo',
    alias: 'best',
  })
  db.create('user', {
    name: 'youri',
    email: 'youri@yari.yo',
    alias: 'alsobest',
  })
  db.create('typeTest', {})

  await db.drain()
  await db.save()

  const db2 = new BasedDb({
    path: t.tmp,
  })
  await db2.start()
  t.after(() => db2.destroy())

  const a = await db.query('user').get().toObject()
  const b = await db2.query('user').get().toObject()
  deepEqual(b, a)

  const c = await db.create('user', { name: 'jerp' })
  const d = await db2.create('user', { name: 'jerp' })
  equal(c, 3)
  equal(d, 3)

  await db2.save()

  const user1 = await db2.create('user', { name: 'jerp' })

  await db2.save()

  const user2 = await db2.create('user', { name: 'jerp' })

  await db2.save()
})

await test('empty root', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start()
  t.after(() => db.destroy())

  await db.setSchema({
    types: {
      user: {
        props: {
          name: { type: 'string' },
          email: { type: 'string' },
          age: { type: 'uint32' },
          story: { type: 'string' },
        },
      },
    },
  })

  await db.save()
  await setTimeout(1e3)
})

await test('refs', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.destroy())

  await db.setSchema({
    types: {
      group: {
        props: {
          name: { type: 'string' },
          users: {
            items: {
              ref: 'user',
              prop: 'group',
            },
          },
        },
      },
      user: {
        props: {
          name: { type: 'string' },
          email: { type: 'string' },
          group: {
            ref: 'group',
            prop: 'users',
          },
        },
      },
    },
  })

  const grp = db.create('group', {
    name: 'best',
  })
  db.create('user', {
    name: 'youzi',
    email: 'youzi@yazi.yo',
    group: grp,
  })

  db.create('user', {
    name: 'youri',
    email: 'youri@yari.yo',
    group: grp,
  })

  await db.drain()
  await db.save()

  const db2 = new BasedDb({
    path: t.tmp,
  })
  t.after(() => db2.destroy())
  await db2.start()

  const users1 = await db.query('user').include('group').get().toObject()
  const users2 = await db2.query('user').include('group').get().toObject()

  deepEqual(users1, users2)
})

await test('auto save', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.destroy())

  await db.setSchema({
    types: {
      group: {
        props: {
          name: { type: 'string' },
          users: {
            items: {
              ref: 'user',
              prop: 'group',
            },
          },
        },
      },
      user: {
        props: {
          name: { type: 'string' },
          email: { type: 'string' },
          group: {
            ref: 'group',
            prop: 'users',
          },
        },
      },
    },
  })
})

await test('text', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.destroy())

  await db.setSchema({
    locales: {
      en: {},
      fi: { fallback: ['en'] },
    },
    types: {
      article: {
        props: {
          title: { type: 'text' },
          body: { type: 'text' },
        },
      },
    },
  })

  // Text: Wikipedia CC BY-SA 4.0
  db.create('article', {
    title: {
      en: 'Galileo Galilei',
      fi: 'Galileo Galilei',
    },
    body: {
      en: "Galileo di Vincenzo Bonaiuti de' Galilei (15 February 1564 – 8 January 1642), commonly referred to as Galileo Galilei (/ˌɡælɪˈleɪoʊ ˌɡælɪˈleɪ/, US also /ˌɡælɪˈliːoʊ -/; Italian: [ɡaliˈlɛːo ɡaliˈlɛːi]) or mononymously as Galileo, was an Italian astronomer, physicist and engineer, sometimes described as a polymath. He was born in the city of Pisa, then part of the Duchy of Florence. Galileo has been called the father of observational astronomy, modern-era classical physics, the scientific method, and modern science.",
      fi: 'Galileo Galilei (15. helmikuuta 1564 Pisa, Firenzen herttuakunta – 8. tammikuuta 1642 Arcetri, Toscanan suurherttuakunta) oli italialainen tähtitieteilijä, filosofi ja fyysikko. Hänen merkittävimmät saavutuksensa liittyvät tieteellisen menetelmän kehitykseen aristoteelisesta nykyiseen muotoonsa. Häntä on kutsuttu tieteen, klassisen fysiikan ja tähtitieteen isäksi.',
    },
  })
  db.create('article', {
    title: {
      en: 'Pope Urban VIII',
      fi: 'Urbanus VIII',
    },
    body: {
      en: 'Pope Urban VIII (Latin: Urbanus VIII; Italian: Urbano VIII; baptised 5 April 1568 – 29 July 1644), born Maffeo Vincenzo Barberini, was head of the Catholic Church and ruler of the Papal States from 6 August 1623 to his death, in July 1644.\nHe was also an opponent of Copernicanism and was involved in the Galileo affair, which saw the astronomer tried for heresy.',
      fi: 'Paavi Urbanus VIII, syntymänimeltään Maffeo Barberini, (huhtikuu 1568 – 29. heinäkuuta 1644) oli paavina 6. elokuuta 1623 – 29. heinäkuuta 1644.\nUrbanus VIII:n paaviuden aikana Galileo Galilei kutsuttiin vuonna 1633 Roomaan vastamaan syytöksiin harhaoppisuudesta',
    },
  })

  await db.drain()
  await db.save()

  const db2 = new BasedDb({
    path: t.tmp,
  })
  t.after(() => db2.destroy())
  await db2.start()

  const articles1 = await db.query('article').get().toObject()
  const articles2 = await db2.query('article').get().toObject()
  deepEqual(articles1, articles2)
})

await test.skip('db is drained before save', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })
  await db.setSchema({
    types: {
      book: {
        props: {
          name: { type: 'string', max: 16 },
          isbn: { type: 'string', max: 13 },
          owner: { ref: 'person', prop: 'books' },
        },
      },
      person: {
        props: {
          name: { type: 'string', max: 16 },
          age: { type: 'uint32' },
          bf: { ref: 'person', prop: 'bf' },
          books: { items: { ref: 'book', prop: 'owner' } },
        },
      },
    },
  })

  t.after(() => db.destroy())

  const people = await Promise.all([
    db.create('person', {
      name: 'Slim',
    }),
    db.create('person', {
      name: 'Slick',
    }),
    db.create('person', {
      name: 'Joe',
    }),
  ])
  db.update('person', people[1], {
    bf: people[2],
  })

  for (let i = 0; i < 5; i++) {
    db.create('book', {
      name: `book ${i}`,
      isbn: '9789295055025',
      owner: people[i % people.length],
    })
  }
  await db.save()
  for (let i = 0; i < 5; i++) {
    db.create('book', {
      name: `book ${1000 + i}`,
      isbn: '9789295055025',
      owner: people[i % people.length],
    })
  }
  await db.save()

  const db2 = new BasedDb({
    path: t.tmp,
  })
  t.after(() => db2.destroy())
  await db2.start()

  deepEqual(
    await db2.query('person').include('name', 'books').get().toObject(),
    await db.query('person').include('name', 'books').get().toObject(),
  )
})

await test('create', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })
  await db.setSchema({
    types: {
      person: {
        props: {
          name: { type: 'string', max: 8 },
          alias: { type: 'alias' },
        },
      },
    },
  })

  t.after(() => db.destroy())

  db.create('person', {
    name: 'Joe',
  })
  await db.drain()
  await db.save()
  db.create('person', {
    name: 'John',
  })
  await db.drain()
  await db.save()
  db.create('person', {
    name: 'Neo',
    alias: 'haxor',
  })
  await db.drain()
  await db.save()
  db.create('person', {
    name: 'trinity',
    alias: 'haxor',
  })
  await db.drain()
  await db.save()

  // load the same db into a new instance
  const db2 = new BasedDb({
    path: t.tmp,
  })
  await db2.start()
  t.after(() => db2.destroy())

  deepEqual(
    await db2.query('person').get().toObject(),
    await db.query('person').get().toObject(),
  )
})

await test('upsert', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.destroy())

  await db.setSchema({
    types: {
      person: {
        props: {
          name: { type: 'string', max: 8 },
          age: { type: 'uint8' },
          alias: { type: 'alias' },
        },
      },
    },
  })
  const joe = db.create('person', {
    name: 'Joe',
    alias: 'boss',
  })
  await db.drain()
  await db.save()
  await db.upsert('person', { alias: 'boss' }, { age: 42 })
  await db.drain()
  await db.save()

  // load the same db into a new instance
  const db2 = new BasedDb({
    path: t.tmp,
  })
  await db2.start()
  t.after(() => db2.destroy())

  deepEqual(await db.query('person').get(), [
    { id: 1, name: 'Joe', age: 42, alias: 'boss' },
  ])
  deepEqual(await db2.query('person').get(), [
    { id: 1, name: 'Joe', age: 42, alias: 'boss' },
  ])
})

await test('alias blocks', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.destroy())

  await db.setSchema({
    types: {
      person: {
        props: {
          name: { type: 'string', max: 8 },
          alias: { type: 'alias' },
        },
      },
    },
  })

  for (let i = 0; i < 100_000; i++) {
    db.create('person', {
      name: 'Joe',
    })
  }
  await db.drain()
  await db.save()
  const john = await db.create('person', {
    name: 'John',
    alias: 'bf',
  })
  await db.drain()
  await db.save()
  db.update('person', 1, { alias: 'bf' })
  for (let id = 2; id < john; id++) {
    db.delete('person', id)
  }
  await db.drain()
  await db.save()

  // load the same db into a new instance
  const db2 = new BasedDb({
    path: t.tmp,
  })
  await db2.start()
  t.after(() => db2.destroy())

  deepEqual(
    await db2.query('person').get().toObject(),
    await db.query('person').get().toObject(),
  )
})

await test('simulated periodic save', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.destroy())

  await db.setSchema({
    types: {
      book: {
        props: {
          name: { type: 'string', max: 16 },
          isbn: { type: 'string', max: 13 },
          owner: { ref: 'person', prop: 'books' },
        },
      },
      person: {
        props: {
          name: { type: 'string', max: 16 },
          age: { type: 'uint32' },
          bf: { ref: 'person', prop: 'bf' },
          books: { items: { ref: 'book', prop: 'owner' } },
          alias: { type: 'alias' },
        },
      },
    },
  })

  // create some people
  const people = await Promise.all([
    db.create('person', {
      name: 'Slim',
      alias: 'slim',
    }),
    db.create('person', {
      name: 'Slick',
      alias: 'slick',
    }),
    db.create('person', {
      name: 'Joe',
      alias: 'joe',
    }),
    db.create('person', {
      name: 'Ben',
      alias: 'boss',
    }),
    db.create('person', {
      name: 'Steve',
    }),
  ])

  db.update('person', people[1], {
    bf: people[2],
  })

  // create some books
  for (let i = 0; i < 1000; i++) {
    db.create('book', {
      name: `book ${i}`,
      isbn: '9789295055025',
      owner: people[i % people.length],
    })
  }
  await db.drain()
  await db.save()

  // more books
  for (let i = 0; i < 1000; i++) {
    db.create('book', {
      name: `book ${1000 + i}`,
      isbn: '9789295055025',
      owner: people[i % people.length],
    })
  }
  await db.drain()
  await db.save()

  // change a node using an alias
  db.upsert('person', { alias: 'slim' }, { name: 'Shady' })
  await db.drain()

  await db.save()

  // replace alias
  db.create('person', {
    name: 'Slide',
    alias: 'slick',
  })
  await db.drain()
  await db.save()

  // move alias
  await db.update('person', people[4], {
    alias: 'boss',
  })

  await db.drain()
  await db.save()

  // load the same db into a new instance
  const db2 = new BasedDb({
    path: t.tmp,
  })
  await db2.start()
  t.after(() => db2.destroy())

  // Change node using alias saved
  deepEqual(
    await db
      .query('person')
      .filter('alias', 'includes', 'slim')
      .include('alias', 'name')
      .get()
      .toObject(),
    [{ id: 1, alias: 'slim', name: 'Shady' }],
  )
  deepEqual(
    await db2
      .query('person')
      .filter('alias', 'includes', 'slim')
      .include('alias', 'name')
      .get()
      .toObject(),
    [{ id: 1, alias: 'slim', name: 'Shady' }],
  )

  // Replace alias saved
  deepEqual(
    await db
      .query('person')
      .filter('alias', 'includes', 'slick')
      .include('alias', 'name')
      .get()
      .toObject(),
    [{ id: 6, alias: 'slick', name: 'Slide' }],
  )
  deepEqual(
    await db2
      .query('person')
      .filter('alias', 'includes', 'slick')
      .include('alias', 'name')
      .get()
      .toObject(),
    [{ id: 6, alias: 'slick', name: 'Slide' }],
  )

  // Move alias saved
  deepEqual(
    await db
      .query('person')
      .filter('alias', 'includes', 'boss')
      .include('alias', 'name')
      .get()
      .toObject(),
    [{ id: 5, name: 'Steve', alias: 'boss' }],
  )
  deepEqual(
    await db2
      .query('person')
      .filter('alias', 'includes', 'boss')
      .include('alias', 'name')
      .get()
      .toObject(),
    [{ id: 5, name: 'Steve', alias: 'boss' }],
  )

  // All have the same books
  deepEqual(
    await db2
      .query('person')
      .include('name', 'alias', 'books')
      .get()
      .toObject(),
    await db.query('person').include('name', 'alias', 'books').get().toObject(),
  )
})

await test('edge val', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      round: {
        name: 'alias',
      },
      sequence: {
        name: 'alias',
      },
      scenario: {
        name: 'alias',
      },
      phase: {
        name: 'alias',
        round: {
          ref: 'round',
          prop: 'phases',
        },
        scenarios: {
          items: {
            ref: 'scenario',
            prop: 'phases',
            $sequence: {
              ref: 'sequence',
            },
          },
        },
      },
    },
  })

  const sequence1 = await db.create('sequence', {})
  const sequence2 = await db.create('sequence', {})
  const scenario1 = await db.create('scenario', {})
  const scenario2 = await db.create('scenario', {})
  const phase = await db.create('phase', {
    scenarios: [
      {
        id: scenario1,
        $sequence: sequence1,
      },
    ],
  })
  await db.save()
  db.update('phase', phase, {
    scenarios: {
      add: [
        {
          id: scenario2,
          $sequence: sequence2,
        },
      ],
    },
  })
  //await db.query('phase').include('scenarios.$sequence').get().inspect()
  await db.save()

  await db.update('phase', phase, {
    scenarios: {
      delete: [scenario1],
    },
  })
  //await db.query('phase').include('scenarios.$sequence').get().inspect()
})

await test('no mismatch', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop(true))

  await db.setSchema({
    types: {
      user: {
        props: {
          name: { type: 'string' },
        },
      },
    },
  })

  await db.create('user', {
    name: 'xxx',
  })

  await db.save()

  const db2 = new BasedDb({
    path: t.tmp,
  })

  t.after(() => t.backup(db2))

  await db2.start()
  await db2.create('user', {
    name: 'xxx',
  })

  await db2.create('user', {
    name: 'xxx2',
  })

  await db2.save()
})
