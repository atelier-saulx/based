```typescript
//
const results = db
  .query('article')
  .include(['name', 'publishDate'])
  .filter(
    ['sections', 'has', ['se123', 'se321']],
    ['published', '=', true],
    ['publishedDate', '>', 'now - 1week'],
  )
  .range(0, 100)

db.query('article')
  .include(['name', 'publishDate', 'tags'])
  .includeReferences('contributors', (contributors) =>
    contributors
      .include(['name', 'age'])
      .filter(['age', '>', 12])
      .includeReferences('friends', (friends) => {
        friends.include(['age'])
      }),
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
  .filter(['publishedDate', '>', 'now-1week'])
  .traverse('contributors.creditcards')
  .include(['name', 'bank'])
  .filter(['name', 'includes', 'A'])
  .range(0, 10)

db.query('article')
  .filter(['publishedDate', '>', 'now-1week'])
  .traverse('contributors.creditcards')
  .filter(['name', 'includes', 'A'])
  // edge filters
  .traverse('bank.country')
  .include('name', 'code', { transactions: 'count(transactions)' })
  .references(
    'banks',
    (banks) => banks.sort('transactions').include('number').range(0, 10),
    // can go trough traverse
  )

// traverse is essentialy a collect

db.query('article')
  .filter('publishedDate', '>', 'now-1week')
  .sort('hits', 'desc')
  .range(0, 100)
  .traverse('contributors')
  .range(0, 10)

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

db.query('ar1').exclude(['name'])

db.query('article')
  .traverse('contributors')
  .include(['name', 'bank'])
  .filter(['name', 'includes', 'A'])
  .range(0, 10)

// with conditionals
db.query('co1.articles')
  .include('id', 'name', 'publishDate')
  .filter(
    [
      ['sections', 'has', ['se123', 'se321']],
      ['published', '=', true],
      ['publishedDate', '>', 'now - 1week'],
    ],
    'OR', // .or()
    ['publishedDate', '>', 'now - 1h'],
  )
  .range(0, 100)
```
