```typescript
//
const results = db
  .query('article')
  .include(['name', 'publishDate'])
  .filter(
    ['sections', 'has', ['se123', 'se321']],
    ['published', '=', true],
    ['publishedDate', '>', 'now - 1week']
  )
  .range(0, 100)

// string: 'search', 'includes', '!includes', '=', '!=', 'exists', '!exists', 'like', '!like  // Levenshtein distance
//

// references: 'has', '!has', '=', '!=', 'exists', '!exists' // EDGE BOYS
// reference: '=', '!=', 'exists', '!exists'

/*
{
  distance: 2,
  transform: 'normalize',
}


{

  $refs: {
    bla: {
      type: 'object
    }
  },
  // bla
§
  types: {
    root: {
      properties: {
        topArticle: {
          type: 'article',
        }

        bestPeople: {
          type: 'user',
          list: true,
          edge: { enum: ['contributor', 'leecher'], unique: true }
        }

        count: {
          type: 'number',
        }
      }
    }

    vote: {
      properties: {
        amount: { type: 'number' }
        article: { type: 'article' }
      }
    },

    article: {
      writer: { type: 'user' },
      fields: {
        votes: { type: 'vote', multi: true, edge: { type: 'string' }, field: 'article' }
      }
    }

    user: {
      fields: {
      }
    }

  }

}

*/

const searchTerm = 'ukrain e'

const results = db
  .query('article')
  .include('name', 'publishDate', 'contributors.name', 'people[0].name')
  .filter('published', true)
  .filter(['title', 'abstract'], 'search', searchTerm)

  // count, sum, avarage, median, unique, min, max
  .filter('countries.votes', '>', 5, { aggregate: 'min' })
  .filter('countries.votes', '<', 10, { aggregate: 'max' })

  .filter('countries.votes', '>', 5e6, {
    aggregate: 'count',
  })

  // edge value is number
  .filter('votes[0].amount', '>', 10)

  .filter('votes[0].amount', '..', [1, 2])

  // now - 1s
  // now + 1w
  //

  //   // val = bla
  // .filter('countries.votes(=bla)')
  // // key = bla
  // .filter('countries.votes(.bla)')
  // // val = bla
  // .filter('countries.votes[=bla]')
  // // key = bla
  // .filter('countries.votes[bla]')

  // edge value is { type: 'number', }
  .filter('countries.votes[1]', '>', 5)

  // edge value is { type: 'string' }
  .filter('countries.votes[bla].price', '>', 5)

  // edge value is { type: 'objct', prop:{ x, y } }
  .filter('countries.votes[x]', '>', 5)
  .filter('countries.votes[y]', '>', 5)

  // edge value is { type: 'number' }
  .filter('countries.votes[]', '>', 5)

  // edge value is enum [contributor / llecher]
  .filter('bestPeople[contributor].articles', '>', 10)

  .filter('contributors.name', '=', ['ale', 'jim'])
  .filter('publishDate', '>', 'now')
  .filter((filter) =>
    filter('snurp', true).and('gurp', false).or('name', '=', 'yuzi')
  )
  .sort('publishedDate', 'desc')
  .range(0, 100)

db.query('article')
  .include('name', 'publishDate', 'tags')
  .includeReferences('contributors', (contributors) =>
    contributors
      .include('name', 'age')
      .filter('age', '>', 12)
      .includeReferences('friends', (friends) => {
        friends.include('age')
      })
  )
  .includeReferences('sections', (sections) => {
    sections.include(['name', 'age']).filter(['age', '>', 12])
  })

db.query('article').filter(['publishedDate', '>', 'now-1week'])

// not nessecary traverse escpases context
// .traverseReferences('contributors', (contributors) =>
//   contributors
//     .include(['name', 'age'])
//     .filter(['age', '>', 12])
//     .includeReferences('friends', (friends) => friends.include(['age']))

//     // can be written as
//     .include('friends.age')

//     .sort('articles.length')
//     .range(0, 10),
// )

db.query('article')
  .traverse('children', 'contributors', 'bla', true)
  .include('name', 'bank')
  .filter('name', 'includes', 'A')
  .range(0, 10)

db.query('article')
  .filter('publishedDate', '>', 'now-1week')
  .traverse('contributors.creditcards')
  .include('name', 'bank')
  .filter('name', 'includes', 'A')
  .range(0, 10)

// edge filters
db.query('article')
  .filter(['publishedDate', '>', 'now-1week'])
  .traverse('contributors.creditcards')
  .filter(['name', 'includes', 'A'])
  .traverse('bank.country')
  .include('name', 'code', { transactions: 'count(transactions)' })
  .references('banks', (banks) =>
    banks.sort('transactions').include('website', 'name').range(0, 10)
  )

// countries: [ { name: 'netherlands', code: 'NL', transactions: 1e6, banks: [{name: 'ing', website: 'ing.nl'}] }  ]
// can go trough traverse
// traverse is essentialy a collect

db.query('article')
  .filter('publishedDate', '>', 'now-1week')
  .sort('hits', 'desc')
  .range(0, 100)
  .include('img.src', 'title', 'abstract', 'section.title', 'articleType.title')

db.query('article')
  .filter('publishedDate', '>', 'now-1week')
  .sort('hits', 'desc')
  .range(0, 100)
  .traverse('contributors')
  .range(0, 10)
  .include('name', 'avatar.src')

db.query('article')
  .filter('publishedDate', '>', 'now-1week')
  .sort('hits', 'desc')
  .traverse('contributors')
  .range(0, 10)

db.query('contributor')
  .filter(['articles.publishDate', '>', 'now-1week', '>', 0])
  .sort('sum(articles.hits)')
  .range(0, 10)

db.query('contributor')
  .filter(['articles', '>', 0])
  .sort('sum(articles.hits)')
  .range(0, 10)

db.query('contributor')
  .filter(['articles', '>', 0])
  .sort('articles')
  .range(0, 10)

db.query('article')
  .filter(['publishedDate', '>', 'now-1week'])
  .traverse('contributors.creditcards')
  .include(['name', 'bank'])
  .filter(['name', 'includes', 'A'])
  .range(0, 10)

db.query('article.contributors.creditcards')
  .include(['name', 'bank'])
  .filter(['name', 'includes', 'A'])
  .range(0, 10)

db.query('ar1.avatar') // gets all

db.query('ar1').exclude(['name']) // [{ id: 'ar1', }]

db.query('article')
  .traverse('contributors')
  .include(['name', 'bank'])
  .filter(['name', 'includes', 'A'])
  .range(0, 10)

// with conditionals
db.query('co1.articles')
  .filter(
    ['sections', 'has', ['se123', 'se321']],
    ['published', '=', true],
    ['publishedDate', '>', 'now - 1week']
  )
  // .or('publishedDate', '>', 'now - 1h')
  .include('id', 'name', 'publishDate')
  .range(0, 100)

db.query('article')
  .language('en')
  .filter(
    ['publishedDate', '>', 'now-1week'],
    ['section', 'includes', sections],
    ['articleType', 'includes', articleTypes]
  )
  .exclude('body')
  .references('section', (section) =>
    section.filter('hidden', '=', false).include('title')
  )
  .references('articleType', (articleType) =>
    articleType.filter('hidden', '=', false).include('title')
  )
  .sort(mostRead ? 'hits' : 'publishedDate')
  .range(0, 10)

db.query('articleType').filter('hidden', 'is', false).include('title.en')

db.query('section').filter('hidden', 'is', false).include('title.en')

// const data = await client
//   .query("db", {
//     $id: "te896706b5",
//     ancestors: {
//       id: true,
//       $list: {
//         $find: {
//           $recursive: true,
//           $traverse: {
//             $any: "parents",
//           },
//           $filter: [
//             {
//               $field: "archived",
//               $operator: "!=",
//               $value: true,
//             },
//           ],
//         },
//       },
//     },
//   })
// .get();

db.query('te896706b5').filter('members[admin]', 'has', user.id).boolean()
```

// .include('section.title', 'articleType.title')
