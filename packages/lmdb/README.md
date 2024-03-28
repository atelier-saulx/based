# @based/db

```typescript
db.set({}, merge) // merge: true / false

db.get(key, fields) //

//

// query ID
// will make indexes based on what you are asking
//  from the top
//  from references field in a key

// 2 envs
// 1 indexes / config etc
// 1 raw data (also indexed on primary index thing)
// 255

// article publihedDate > march 2023
// sorted by publishDate
// published : true
db.query('*', 'article') // 1
  .sort(['publishDate', 'asc', 0, 100])
  .filter(['publishedDate', '>', 123123123321], ['published', '=', true])

// INDEX Article publishedDate
// INDEX Article published

// SUBSCRIBE DBI
// {sub id} -> lastUsed  INDEX, INDEX, INDEX
// DBI INDEX META INFO

// NODE=> "0:x", "1:y", "0:1:2z", "b"
db.query('root', 'article')
  .sort(['publishDate', 'asc', 0, 100])
  .filter(['sections', 'has', [ukraine, opinion]][('published', '=', true)], [
    'publishedDate',
    '>',
    123123023321,
  ])

db.query({
  from: '*',
  field: 'article',
  language: 'en',
  instance: 'articles',
})
  .sort({
    field: 'publishDate',
    order: 'asc',
  })
  .limit(100)
  .offset(0)
  .filter({
    field: 'published',
    function: '=',
    value: true,
  })
  .filter({
    field: 'publishDate',
    function: '>',
    value: 'now - 1week',
  })
  .filter({
    field: 'sections',
    function: 'has',
    value: ['ur123', 's123'],
    or: {
      field: 'published',
      function: '=',
      value: false,
    },
  })
  .fields(['id', 'name', 'publishDate'])

// ------------------------

db.query('article')
  .language('en')
  .sort('publishDate')
  .limit(100)
  .offset(0)
  .filter('published', true)
  .filter('publishDate', '>', 'now - 1week')
  .filter(['sections', 'has', ['ur123', 's123']], ['published', false])
  .select('id', 'name', 'publishDate')
  .select('contributors')
  .limit(5)
  .filter('smart', true)
  .select('email', 'name')

// => indexesQuery, itemTest

query('user')
  .filter('published', true)
  .or('flap', '>', 2)
  .sort('publishDate')
  .limit(10)
  .select('fullname', 'ranking')
  .contributors.filter('smart', true)
  .contributors.sort('articles')
  .contributors.limit(1)
  .contributos.select('name', 'birthday')
  .contributors.articles.sort('hits')
  .contributors.articles.limit(5)
  .contributors.articles.select('name', 'img')
  .subscribe((data) => {
    // type hint of fields... pretty hard
    console.log(data)
  })

// allways include
query('user')
  .published.is(true)
  .or.flap.largerThen(20)
  .publishDate.largerThen('now - 1 week')
  .sort('publishDate')
  .range(0, 10)
  .include('id', 'fullname', 'ranking')
  .contributors.smart.is(true)
  .contributors.sort('articles')
  .contributors.sort.hits.largerThen(20)
  .contributors.range(0, 1)
  .contributos.include('id', 'name', 'birthday')
  .contributors.articles.sort('hits')
  .contributors.articles.limit(5)
  .contributors.articles.include('id', 'name', 'img')
  .subscribe((data) => {
    // type hint of fields... pretty hard
    console.log(data)
    /*
      [{
        id: 123132,
        fullName: 'bla',
        ranking: 10,
        contributors: [{ 
          name: 'jim de blap', id: 123, birthday: 23112312,
          articles: [{
            id: 213123,
            name: "snrp",
            img: 'http://bla.com'"
          }]
        }]
      }]

    */
  })

// https://github.com/coderello/js-query-builder

// https://github.com/kristianmandrup/cypher-query

db.query('article')
  .limit(100)
  .sections.has(['ur123', 's123'])
  .or.published.is(false)
  .published.is(true)
  .publishDate.largerThen('now - 1week')
  .select('id', 'name', 'publishDate')

// select references (nested query / filter)

// add article ukraine article > sections [id]

// yes? yes!
// is it published ? yes
// is it larger then 123123023321
// run query

//  id: null //
// * article publishDate  12345000: [id,id,id]

// [coBR, episodes, startTime, 948327498] => ep1,ep2,ep5
// 0121 948327498 => ep1, ep2
// { type: 'references', edge: { type: 'integer' }, sortBy: 'edge' // 'start' }

// UKKRAINE -> articles 20k []
// UKRAINE -> 0 / 1 ->

// INDEX Article publishedDate
// INDEX Article published

//

// SUBSCRIBE DBI
// {sub id} -> lastUsed  INDEX, INDEX, INDEX
// DBI INDEX META INFO

// NODE=> "0:x", "1:y", "0:1:2z", "b"

db.updateSchema()

db.getSchema()
```

---

data types

references (+ edge)
reference

Uint

float

// 128 bits
string
string fixed length string

---

// 2 bytes for type

// primary INDEX
