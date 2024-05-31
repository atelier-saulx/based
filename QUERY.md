# based-db

## .query(selector:string)

```ts
// by type
db.query('article')

// by id
db.query('ar1')

// by field
db.query('ar1.contributors')

// by alias
db.query('article[url:world-politics]')
```

## .include(fields:string[] | Function)

```ts
// by field names
db.query('article').include('name')

// by references
db.query('article').include('contributors.name')

// with edge value
db.query('article').include('name', 'contributors.@role')

// with reference by index
db.query('article').include('name', 'contributors[0].name')

// with reference by alias
db.query('article').include('name', 'contributors[email:lorem@ipsum.com].name')

// advanced include
db.query('article').include((select) => {
  select('name')
  select('contributors')
    .filter('email', '=', 'lorem@ipsum.com')
    .include('name', 'email', '@role')
})
```

## .language(lang:string)

```ts
// select specific language
db.query('article').language('en')
```

## .filter(field:string, operatorOrValue:string|number, value: string|number, opts)

```ts
// compare
db.query('article').filter('views', 10)
db.query('article').filter('views', '=', 10)
db.query('article').filter('views', '=', [10, 11])
db.query('article').filter('views', '!=', 10)
db.query('article').filter('views', '>', 10)
db.query('article').filter('views', '>=', 10)
db.query('article').filter('views', '<', 10)
db.query('article').filter('views', '<=', 10)

// has for references/sets
db.query('article').filter('contributors', 'has', 'us1')
db.query('article').filter('contributors', '!has', 'us1')

// has for strings (or includes?)
db.query('article').filter('headline', 'has', 'database')

// search for strings
db.query('article').filter('headline', 'search', 'database', {
  distance: 2,
  transform: 'normalize',
})

// views === 10 || (views === 25 && status === published)
db.query('article')
  .filter('views', '=', 10)
  .or('views', '=', 25)
  .and('status', 'published')

db.query('article').filter((filter) => {
  filter('views', '=', 10).or('views', '=', 25).and('status', 'published')
})
```

## .sort('string', opts)

```ts
// default sort asc
db.query('article').sort('headline')

// desc
db.query('article').sort('headline', {
  order: 'desc',
})

// group it
db.query('article').sort('publishedAt', {
  order: 'desc',
  resolution: 'year',
})
```

## .traverse(field:string)

```ts
// traverse a field
db.query('article').traverse('contributors')

// recursive
db.query('article').traverse(
  (traverse) => traverse('contributors').traverse('articles'),
  { recursive: 2 },
)
```

## .get(transformFn)

```ts
// default get
const results = await db.query('article').get()

// get with transform
const results = await db
  .query('article')
  .get(({ name, headline, contributors }) => {
    return {
      name,
      title: headline,
      authors: contributors,
    }
  })
```

## .subscribe(transformFn)

```ts
// subscribe
const unsubscribe = db
  .query('article')
  .subscribe(({ name, headline, contributors }) => {
    console.info('🚀', { name, headline, contributors })
  })

// unsubscribe
unsubscribe()
```

## use in react \*idea

```tsx
const MyComponent = ({ id }) => {
  const { data, loading, error } = useQuery(
    (db) => db.query(id).include('headline', 'abstract', 'contributors'),
    [id],
  )

  if (loading) {
    return null
  }

  return (
    <>
      <h1>{data.headline}</h1>
      <p>{data.abstract}</p>
      <ul>
        {data.contributors.map(({ id, name }) => (
          <li key={id}>{name}</li>
        ))}
      </ul>
    </>
  )
}
```

// ADD TRIM FN FOR STRING IN INCLUDE
