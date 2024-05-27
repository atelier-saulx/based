const db: any = {}

// NOW
db.set({
  $id: 'ma1',
  ref: {
    $id: 'da1',
    $edgeMeta: { note: 'very cool', antiNote: 'not very cool' },
  },
  description: { en: 'The most boring' },
})

// CREATE
db.set({
  type: 'article',
  title: 'youzi',
})

// UPDATE
db.set({
  $id: 'ar123',
  title: 'youzi',
})

// CREATE
db.create(
  'article',
  {
    title: 'youzi',
  },
  {
    language: 'en',
  }
)

// UPDATE
db.query('ar123').set({
  title: 'youzi',
})

// BATCH UPDATE
db.query('article').filter('createdAt', '>', 23987429).set({
  status: 'new',
})

// ALIASES
// CREATE
db.create(
  'article',
  {
    title: 'youzi',
  },
  {
    alias: '5034987539-f0s897df-fsd98f7',
    language: 'en',
  }
)

// QUERY
db.query('article').filter('publishedAt', '>', 298462)

db.query('article', {
  alias: '5034987539-f0s897df-fsd98f7',
})

/*
{
  article: {
    properties: {
      externalId: {
        type: 'alias'
      },

    }
  },
  email: {
    depentant
  }
}

{
  aliases: []
}

{
  type: 'article',
  $alias: '9d8fs7f9',
  title: 'youzi',
  published: true
}




*/

db.create('article', {
  externalId: '98sd760d97d',
})

db.query('article').filter('externalId', '=', [
  '98sd760d97d',
  'gs987d',
  'gfd07gd',
])

db.get({
  $alias: 'smurk',
})

db.get({
  things: {
    $list: {
      $find: {
        $traverse: 'descendants',
        $filter: {
          $field: 'aliases',
          $operator: 'has',
          $value: ['98sd760d97d', 'gs987d', 'gfd07gd'],
        },
      },
    },
  },
})

export {}
