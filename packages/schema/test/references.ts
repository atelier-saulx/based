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
      event: {
        props: {
          createdAt: {
            type: 'timestamp',
            on: 'create',
          },
        },
      },
      article: {
        props: {
          author: {
            ref: 'author',
            prop: 'articles',
            $role: {
              enum: ['admin', 'collaborator'],
            },
            $relatedEvent: {
              ref: 'event',
            },
            $enum: ['zzz'],
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

  throws(() => {
    parse({
      types: {
        article: {
          props: {
            author: {
              ref: 'author',
              prop: 'articles',
              $role: ['admin', 'collaborator'],
            },
          },
        },
        author: {
          props: {
            articles: {
              items: {
                ref: 'article',
                prop: 'author',
                $role: ['admin', 'collaborator'],
              },
            },
          },
        },
      },
    })
  }, 'Only allow edge definition on one side')
})
