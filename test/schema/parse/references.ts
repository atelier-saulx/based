import { deepEqual, test, throws } from '../../shared/index.js'
import { parse } from '@based/sdk'

await test('references', async () => {
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

  parse({
    types: {
      article: {
        name: 'string',
      },
    },
  })

  const {
    schema: { hash, ...rest },
  } = parse({
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
        props: {},
      },
    },
  })

  deepEqual(rest, {
    types: {
      article: {
        props: {
          writer: {
            type: 'reference',
            ref: 'author',
            prop: 'articles',
          },
        },
      },
      author: {
        props: {
          articles: {
            type: 'references',
            items: {
              type: 'reference',
              ref: 'article',
              prop: 'writer',
            },
          },
        },
      },
    },
  })

  const {
    schema: { hash: hash2, ...rest2 },
  } = parse({
    types: {
      article: {
        props: {
          writers: {
            items: {
              ref: 'author',
              prop: 'articles',
            },
          },
        },
      },
      author: {
        props: {},
      },
    },
  })

  deepEqual(rest2, {
    types: {
      article: {
        props: {
          writers: {
            type: 'references',
            items: {
              type: 'reference',
              ref: 'author',
              prop: 'articles',
            },
          },
        },
      },
      author: {
        props: {
          articles: {
            type: 'references',
            items: {
              type: 'reference',
              ref: 'article',
              prop: 'writers',
            },
          },
        },
      },
    },
  })

  throws(async () => {
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

  throws(async () => {
    parse({
      types: {
        myType: {
          // @ts-expect-error
          myRefs: {
            items: {
              ref: 'user',
            },
          },
        },
      },
    })
  }, 'Disallow missing type for refs')

  throws(async () => {
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

  throws(async () => {
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
                // @ts-expect-error
                required: true,
                ref: 'article',
                prop: 'author',
              },
            },
          },
        },
      },
    })
  }, 'Disallow incorrect location of required prop')
})

await test('edges', async () => {
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
})

await test('references no auto on same prop', async (t) => {
  parse({
    types: {
      contributor: {
        name: 'string',
      },
      vote: {
        props: {
          choice: {
            ref: 'contributor',
            prop: 'votes',
          },
        },
      },
    },
  })

  throws(async () => {
    parse({
      types: {
        contributor: {
          name: 'string',
        },
        vote: {
          props: {
            choice: {
              ref: 'contributor',
              prop: 'votes',
            },
          },
        },
        test: {
          props: {
            test: {
              ref: 'contributor',
              prop: 'votes',
            },
          },
        },
      },
    })
  }, 'Disallow auto on same prop')
})
