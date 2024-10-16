import test from 'node:test'
import { parse } from '@based/schema'

test('alias', () => {
  parse({
    types: {
      article: {
        props: {
          friendlyUrl: {
            type: 'alias',
          },
          body: {
            type: 'string',
          },
        },
      },
    },
  })

  // /*
  const db: any = {}
  db.updateSchema({
    types: {
      article: {
        props: {
          friendlyUrl: {
            type: 'alias',
          },
          body: {
            type: 'string',
          },
        },
      },
    },
  })

  // will remove alias from previous, if it already exists
  db.create('article', {
    friendlyUrl: '/my-best-article',
    body: 'part',
  })

  // // will create it if not there, will update if it is
  // db.upsert('article', '[friendlyUrl=/my-best-article]', {
  //   body: 'part',
  // })

  // will create it if not there, will update if it is
  db.upsert(
    'article',
    // target
    {
      friendlyUrl: '/my-best-article', // alias
      // externalId: '9087fd'
    },
    // update
    {
      body: 'part',
    },
  )

  // will throw if it does not exist
  db.update(
    'article',
    {
      // OR
      friendlyUrl: '/my-best-article', // alias
      externalId: '9087fd',
    },
    {
      body: 'part',
    },
  )

  // */
})
