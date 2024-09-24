import test from 'node:test'
import { throws } from 'node:assert'
import { parseSchema } from '@based/schema'

test('path', () => {
  parseSchema({
    types: {
      club: {
        props: {
          logo: {
            type: 'string',
          },
          teams: {
            // type: 'references',
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

  throws(() => {
    parseSchema({
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
