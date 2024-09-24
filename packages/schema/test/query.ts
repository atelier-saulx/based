import test from 'node:test'
import { throws } from 'node:assert'
import { parseSchema } from '@based/schema'

test('query', () => {
  parseSchema({
    types: {
      author: {
        props: {
          top10Articles: {
            items: {
              ref: 'article',
            },
            query: (query) =>
              query('articles').sort('views', 'desc').range(0, 10),
          },
          articles: {
            items: {
              ref: 'article',
              prop: 'author',
            },
          },
        },
      },
      article: {
        props: {
          author: {
            ref: 'author',
            prop: 'articles',
          },
          published: {
            type: 'boolean',
            query: (query) => query().filter('status', 'published').boolean(),
          },
          status: {
            enum: ['published', 'draft', 'archived'],
          },
          views: {
            type: 'number',
            min: 0,
            max: Infinity,
            step: 1,
          },
        },
      },
    },
  })
})
