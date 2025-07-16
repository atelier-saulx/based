import test from 'node:test'
import { parse } from '@based/schema'

await test('query', () => {
  parse({
    types: {
      author: {
        props: {
          top10Articles: {
            items: {
              ref: 'article',
            },
            query: (query: any) =>
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
            query: (query: any) =>
              query().filter('status', 'published').boolean(),
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
