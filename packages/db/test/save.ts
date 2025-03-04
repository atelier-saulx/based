import { BasedDb } from '../src/index.js'
import { deepEqual, equal } from './shared/assert.js'
import test from './shared/test.js'
import { setTimeout } from 'node:timers/promises'

await test('save', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })
  t.after(() => {
    return db.destroy()
  })

  await db.putSchema({
    props: {
      coolname: 'string',
      users: {
        items: {
          ref: 'user',
        },
      },
    },
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

  db.create('user', {
    name: 'youzi',
    email: 'youzi@yazi.yo',
  })

  db.create('user', {
    name: 'youri',
    email: 'youri@yari.yo',
  })

  await db.drain()
  await db.save()
  const db2 = new BasedDb({
    path: t.tmp,
  })

  t.after(() => {
    return db2.destroy()
  })

  await db2.start()
  const a = await db.query('user').get().toObject()
  const b = await db2.query('user').get().toObject()

  //console.log(a, b)
  deepEqual(a, b)

  const c = await db.create('user', { name: 'jerp' })
  const d = await db2.create('user', { name: 'jerp' })
  equal(c, 3)
  equal(d, 3)

  await db2.save()

  const user1 = await db2.create('user', { name: 'jerp' })

  await db2.save()

  const user2 = await db2.create('user', { name: 'jerp' })
  await db2.update({
    coolname: 'xxx',
    users: [user1, user2],
  })

  await db2.save()

  await db2.update({
    coolname: 'xxx',
    users: [user1],
  })

  await db2.save()
})

await test('save empty root', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start()

  t.after(() => {
    return db.destroy()
  })

  await db.putSchema({
    props: {
      rando: { type: 'string' },
    },
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

await test('save refs', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => {
    return db.destroy()
  })

  await db.putSchema({
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
  t.after(() => {
    return db2.destroy()
  })
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

  t.after(() => {
    return db.destroy()
  })

  await db.putSchema({
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

await test('save text', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => {
    return db.destroy()
  })

  await db.putSchema({
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
  t.after(() => {
    return db2.destroy()
  })
  await db2.start()

  const articles1 = await db.query('article').get().toObject()
  const articles2 = await db2.query('article').get().toObject()
  deepEqual(articles1, articles2)
})
