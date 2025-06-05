import { BasedDb } from '../src/index.js'
import test from './shared/test.js'

await test('textFallback', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    locales: {
      en: true, // do not know what required means
      nl: { fallback: 'en' },
    },
    types: {
      project: {
        props: {
          createdAt: {
            type: 'timestamp',
            on: 'create',
          },
          title: { type: 'text' },
          description: { type: 'text' },
          abstract: { type: 'text' },
        },
      },
    },
  })

  await db.create(
    'project',
    {
      title: 'Het Krakeel',
      abstract:
        'Wij, Jeroen, Sonja, Dionne, Michiel en Ad willen met gelijkgestemde huishoudens een kleinschalig woonproject ontwikkelen en bouwen in een landelijke omgeving waar ruimte is voor een moestuin, fruitbomen, een bijenvolk, kippen, konijnen, wormen- en insectenhotel, ruimte om te spelen en om samen te zijn.',
    },
    { locale: 'nl' },
  )

  await db.create(
    'project',
    {
      title: 'Buurzaam',
      abstract:
        'Wij, Jeroen, Sonja, Dionne, Michiel en Ad willen met gelijkgestemde huishoudens een kleinschalig woonproject ontwikkelen en bouwen in een landelijke omgeving waar ruimte is voor een moestuin, fruitbomen, een bijenvolk, kippen, konijnen, wormen- en insectenhotel, ruimte om te spelen en om samen te zijn.',
    },
    { locale: 'nl' },
  )

  await db.create(
    'project',
    {
      title: 'Minitopia Poeldonk',
      abstract:
        'Tiny Houses Crabbehof is begonnen in 2021 en bestaat uit tien zelfbouwkavels in Dordrecht. De tiny houses mogen hier voor een periode van tien jaar staan en zijn aangesloten op water, elektra en riolering. Verder vind je hier een fietsenstalling, een gemeenschapp',
    },
    { locale: 'nl' },
  )

  let searchTerms = ['a', 'ab', 'abc', 'abcd']

  for (const term of searchTerms) {
    await db.query('project').search(term, 'title', 'abstract').get().inspect()
  }

  searchTerms = ['kr', 'kra', 'krak', 'krake', 'krakee']

  for (let i = 0; i < 1000; i++) {
    searchTerms.push('F')
  }

  const q = []
  for (const term of searchTerms) {
    q.push(
      (async () => {
        await db
          .query('project')
          .search(term, 'title', 'abstract')
          .get()
          .inspect()
      })(),
    )
  }
  await Promise.all(q)
})
