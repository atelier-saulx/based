import { languages } from './defaults/languages.js'
import { contestants } from './defaults/contestants.js'
import { countries } from './defaults/countries.js'
import { dictionary } from './defaults/dictionary.js'
import { onboarding } from './defaults/onboarding.js'
import { privacy } from './defaults/privacy.js'
import { rounds } from './defaults/rounds.js'
import { sequences } from './defaults/sequences.js'
import { terms } from './defaults/terms.js'
import { info } from './defaults/info.js'
import { defaultViewers, defaultTranslator, defaultAdmins } from './users.js'

export default async (db) => {
  const semi1Voters = await db.upsert('scenario', { name: 'semi1Voters' })
  const semi2Voters = await db.upsert('scenario', { name: 'semi2Voters' })
  const rowVoters = await db.upsert('scenario', { name: 'rowVoters' })
  await db.upsert('scenario', { name: 'nonVoters' })

  // rowVoters
  const rowSequences = [
    'semi1-pre-countdown',
    'semi1-pre-voting',
    'semi1-showtime',
    'semi1-voting',
    'semi1-closed',
    'semi2-pre-countdown',
    'semi2-pre-voting',
    'semi2-showtime',
    'semi2-voting',
    'semi2-closed',
    'final-pre-countdown',
    'final-pre-voting',
    'final-showtime',
    'final-voting',
    'final-closed',
    'winner',
  ]

  // semi1Voters
  const semi1Sequences = [
    'semi1-countdown',
    'semi1-countdown',
    'semi1-showtime',
    'semi1-voting',
    'semi1-closed',
    'final-countdown',
    'final-countdown',
    'final-countdown',
    'final-countdown',
    'final-countdown',
    'final-countdown',
    'final-countdown',
    'final-showtime',
    'final-voting',
    'final-closed',
    'winner',
  ]

  // semi2Voters
  const semi2Sequences = [
    'semi2-countdown',
    'semi2-countdown',
    'semi2-countdown',
    'semi2-countdown',
    'semi2-countdown',
    'semi2-countdown',
    'semi2-countdown',
    'semi2-showtime',
    'semi2-voting',
    'semi2-closed',
    'final-countdown',
    'final-countdown',
    'final-showtime',
    'final-voting',
    'final-closed',
    'winner',
  ]

  for (let i = 0; i < 16; i++) {
    const phase = i + 1
    await db.upsert('phase', {
      name: `phase${phase}`,
      round: {
        upsert: {
          name: phase <= 5 ? 'semi1' : phase <= 10 ? 'semi2' : 'final',
        },
      },
      scenarios: {
        add: [
          {
            id: rowVoters,
            $sequence: await db.upsert('sequence', {
              name: rowSequences[i],
            }),
          },
          {
            id: semi1Voters,
            $sequence: await db.upsert('sequence', {
              name: semi1Sequences[i],
            }),
          },
          {
            id: semi2Voters,
            $sequence: await db.upsert('sequence', {
              name: semi2Sequences[i],
            }),
          },
        ],
      },
    })
  }

  for (const contestant of contestants) {
    await db.upsert('contestant', contestant)
  }

  for (const country of countries) {
    await db.upsert('country', country)
  }

  for (const sequence of sequences) {
    await db.upsert('sequence', sequence)
  }

  for (const email of defaultViewers) {
    await db.upsert('user', { email, role: 'viewer' })
  }

  for (const lang of languages) {
    await db.upsert('language', lang)
  }

  for (const round of rounds) {
    await db.upsert('round', round)
  }

  await db.update({ dictionary, terms, info, privacy, onboarding })

  for (const email of defaultTranslator) {
    await db.upsert('user', {
      email,
      role: 'translator',
      translatorOf: { upsert: [{ iso: 'it' }, { iso: 'nl' }] },
    })
  }

  for (const email of defaultAdmins) {
    await db.upsert('user', { email, role: 'admin' })
  }

  await db.update({
    preview: {
      upsert: {
        name: 'phase4',
      },
    },
    live: {
      upsert: {
        name: 'phase4',
      },
    },
  })
}
