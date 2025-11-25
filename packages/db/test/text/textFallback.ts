import { BasedDb } from '../../src/index.js'
import { deepEqual } from '../shared/index.js'
import test from '../shared/test.js'

await test('textFallback', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    maxModifySize: 1e6,
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

  await db.create(
    'project',
    {
      title: 'English house!',
      abstract:
        'Tiny Houses Crabbehof is begonnen in 2021 en bestaat uit tien zelfbouwkavels in Dordrecht. De tiny houses mogen hier voor een periode van tien jaar staan en zijn aangesloten op water, elektra en riolering. Verder vind je hier een fietsenstalling, een gemeenschapp',
    },
    { locale: 'en' },
  )

  // local second argument
  // false (block all fallbacks) or lang fallback
  // await db.query('project').locale('nl').get().inspect(10)

  deepEqual(
    await db
      .query('project')
      .locale('nl')
      .include('title')
      .filter('title', 'includes', 'English')
      .get(),
    [
      {
        id: 4,
        title: 'English house!',
      },
    ],
    'Filter /w fallback',
  )

  deepEqual(
    await db
      .query('project')
      .locale('nl')
      .include('title')
      .search('English', 'title')
      .get(),
    [
      {
        id: 4,
        title: 'English house!',
        $searchScore: 0,
      },
    ],
    'Search',
  )
})
