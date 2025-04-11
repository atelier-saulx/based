import test from 'node:test'
import { deepEqual, throws } from 'node:assert'
import { parse } from '@based/schema'

await test('references', (t) => {
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
    props: {
      articles: {
        items: {
          ref: 'article',
        },
      },
    },
    types: {
      article: {
        name: 'string',
      },
    },
  })

  deepEqual(
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
          props: {},
        },
      },
    }).schema,
    {
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
              readOnly: true,
              items: {
                ref: 'article',
                prop: 'writer',
              },
            },
          },
        },
      },
    },
  )

  const { schema } = parse({
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

  deepEqual(schema, {
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
        props: {
          articles: {
            readOnly: true,
            items: {
              ref: 'article',
              prop: 'writers',
            },
          },
        },
      },
    },
  })

  await throws(() => {
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

  await throws(() => {
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

  await throws(() => {
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

  await throws(() => {
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
            // @ts-ignore
            articles: {
              // @ts-ignore
              items: {
                // @ts-ignore
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

await test('edges', () => {
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

  await throws(() => {
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
