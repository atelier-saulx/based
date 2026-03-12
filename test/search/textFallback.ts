import { deepEqual, testDb } from '../shared/index.js'
import test from '../shared/test.js'

await test('textFallback', async (t) => {
  const db = await testDb(t, {
    locales: {
      en: true,
      nl: { fallback: ['en'] },
    },
    types: {
      project: {
        props: {
          createdAt: {
            type: 'timestamp',
            on: 'create',
          },
          title: { type: 'string', localized: true },
          description: { type: 'string', localized: true },
          abstract: { type: 'string', localized: true },
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
