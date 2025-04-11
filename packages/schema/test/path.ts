import test from 'node:test'
import { throws } from 'node:assert'
import { parse } from '@based/schema'

await test('path', () => {
  parse({
    types: {
      club: {
        props: {
          logo: {
            type: 'string',
          },
          teams: {
            items: {
              ref: 'team',
              prop: 'club',
            },
          },
        },
      },
      team: {
        props: {
          logo: {
            type: 'string',
            path: 'club.logo',
          },
          club: {
            ref: 'club',
            prop: 'teams',
          },
        },
      },
    },
  })

  await throws(() => {
    parse({
      types: {
        club: {
          props: {
            logoWithDifferentType: {
              type: 'boolean',
            },
            teams: {
              items: {
                ref: 'team',
                prop: 'club',
              },
            },
          },
        },
        team: {
          props: {
            logo: {
              type: 'string',
              path: 'club.logoWithDifferentType',
            },
            club: {
              ref: 'club',
              prop: 'teams',
            },
          },
        },
      },
    })
  }, 'Mismatching types not allowed')
})
