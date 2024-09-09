import test from 'node:test'
import { throws } from 'node:assert'
import { parse } from '@based/schema'

test('references', () => {
  parse({
    types: {
      article: {
        props: {
          writer: {
            ref: 'author',
            prop: 'articles',
          },
        },
      },
      author: {
        props: {
          articles: {
            items: {
              ref: 'article',
              prop: 'writer',
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
                prop: 'author',
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
              prop: 'articles',
            },
          },
        },
        author: {
          props: {
            articles: {
              items: {
                ref: 'article',
                prop: 'author',
              },
            },
          },
        },
        author2: {
          props: {
            articles: {
              items: {
                ref: 'article',
                prop: 'author',
              },
            },
          },
        },
      },
    })
  }, 'Disallow mixed ref types')
})

test('edges', () => {
  parse({
    types: {
      article: {
        props: {
          author: {
            ref: 'author',
            prop: 'articles',
            edge: {
              props: {
                role: {
                  enum: ['admin', 'collaborator'],
                },
              },
            },
          },
        },
      },
      author: {
        props: {
          articles: {
            items: {
              ref: 'article',
              prop: 'author',
            },
          },
        },
      },
    },
  })
})
