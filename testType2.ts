import { testDb } from './test/shared/test.js'
import type { DbClient } from './src/sdk.js'

async function main() {
  const drip = ['dope', 'cringe', 'meh']
  const db = await testDb({} as any, {
    locales: {
      en: {},
      it: { fallback: ['en'] },
      fi: { fallback: ['en'] },
    },
    types: {
      user: {
        props: {
          rating: 'uint32',
          name: 'string',
        },
      },
    },
  })

  const res = await db
    .query('user')
    .filter('name', 'includes', '')
    .include('name')
    .get()
  let b: { id: number; name: string }[] = res
}
