const db: any = {}

// get users with name and their published articles
db.query('users').include('name', 'articles[status:published].headline')

// OR
db.query('users').include((select) => {
  select('name')
  select('articles').filter('status', 'published').include('headline')
})

// OR
db.query('users').include('name', (select) => {
  select('articles').filter('status', 'published').include('headline')
})

const res = [
  {
    id: 'us1',
    name: 'Youri',
    articles: [
      {
        id: 'ar1',
        headline: 'Youri wins eurovision!',
      },
    ],
  },
]

// edge example
db.query('users').include('name', 'articles.headline', 'articles.@rating')

const res2 = [
  {
    id: 'us1',
    name: 'Youri',
    articles: [
      {
        id: 'ar1',
        headline: 'Youri wins eurovision!',
        edge: {
          rating: Infinity,
        },
      },
    ],
  },
]

// find users that have an article rated higher than 5
db.query('users')
  .include('name', 'articles.headline', 'articles.@rating')
  .filter('articles.@rating', '>', 5) // any

// find users that have all articles rated higher than 5
db.query('users')
  .include('name', 'articles.headline', 'articles.@rating')
  .filter('articles.@rating', '>', 5, { match: 'all' }) // any
//.filter('articles.@rating', '<=', 5, { match: 0 }) // any
// .filter((traverse) => {
//   return traverse('articles').count('@rating', '<=', 5).is(0)
// }) // any
// .filterNot('articles.@rating', '<=', 5) // none

export {}
