# @based/schema

```ts
const schema = {
  // types
  definitions: {
    user: {
      type: 'node', // object ? (like json-ld => Object Type)
      properties: {
        name: {
          type: 'string',
        },
        age: {
          type: 'int8',
        },
      },
    },

    article: {
      properties: {
        contributors: {
          elements: {
            ref: 'user',
          },
        },
        plan: {
          enum: ['FREE', 'PAID'],
        },
      },
    },

    recipe: {
      '@context': 'https://schema.org/',
      '@type': 'Recipe',
    },
  },

  // do global properties (formerly root stuff)
  properties: {
    globalCount: {
      type: 'int32',
    },
    lastArticle: {
      type: 'article',
    },
  },
}

const obj = {
  '@context': {
    // birthday:
  },
  '@type': 'Person',
  name: 'Janet',
}

db.set({
  globalCount: 4,
})

db.create('user')

db.query().include('globalCount').get()

db.query('user').include('contributors').get()
```
