import test from 'node:test'
import { throws } from 'node:assert'
import { parseSchema } from '@based/schema'

test('references', () => {
  parseSchema({
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
    parseSchema({
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
    parseSchema({
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
    parseSchema({
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
  parseSchema({
    types: {
      article: {
        props: {
          author: {
            ref: 'author',
            prop: 'articles',
            $role: {
              enum: ['admin', 'collaborator'],
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

  throws(() => {
    parseSchema({
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
