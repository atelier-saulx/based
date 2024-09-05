import test from 'node:test'
import { throws } from 'node:assert'
import { parse } from '@based/schema'

test('references', () => {
  parse({
    types: {
      article: {
        props: {
          author: {
            ref: 'author',
            inverseProp: 'articles',
          },
        },
      },
      author: {
        props: {
          articles: {
            items: {
              ref: 'article',
              inverseProp: 'author',
            },
          },
        },
      },
    },
  })

  throws(() => {
    parse({
      types: {
        author: {
          props: {
            articles: {
              items: {
                ref: 'article',
                inverseProp: 'author',
              },
            },
          },
        },
      },
    })
  }, 'Disallow missing type for ref')

  throws(() => {
    parse({
      props: {
        myRefs: {
          items: {
            ref: 'user',
            inverseProp: 'author',
          },
        },
      },
    })
  }, 'Disallow missing type for refs')

  throws(() => {
    parse({
      types: {
        article: {
          props: {
            author: {
              ref: 'author',
              inverseProp: 'articles',
            },
          },
        },
        author: {
          props: {
            articles: {
              items: {
                ref: 'article',
                inverseProp: 'author',
              },
            },
          },
        },
        author2: {
          props: {
            articles: {
              items: {
                ref: 'article',
                inverseProp: 'author',
              },
            },
          },
        },
      },
    })
  }, 'Disallow mixed ref types')
})
