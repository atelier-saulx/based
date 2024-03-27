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
db.query('*', 'article')
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
    123123123321,
  ])

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

`
data types

references (+ edge)
reference

Uint

float

// 128 bits
string
string fixed length string
`

// 2 bytes for type

// primary INDEX
