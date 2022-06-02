## Based Query Helper

---

## Usage

```javascript
import BasedQuery from './BasedQuery'

const db = new BasedQuery()

const { data, loading, error } = useData({
  me: db.get('use9122262', ['email', 'name']),
  users: db.select('*').find('user').sort('createdAt').limit(0, 4).list()
})
```

## Notes

Don't use in production. Still a work in progress and doesn't allow complex or nested queries.

---

## License

Licensed under the MIT License, Copyright © 2021-present [Saulx](https://www.saulx.com/)