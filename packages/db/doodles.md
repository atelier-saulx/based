Optimize single to many refs:

```ts
for (const { writer, body, id } of many) {
  db.update('article', id, {
    writer,
    body,
  })
}
```

could be rewritten as:

```ts
const writers = {}
for (const { writer, body, id } of many) {
  writers.set(writer)
  db.update('article', id, {
    body,
  })
}

// {
//     [writer]: {
//         articles: new Set(id)
//     }
// }
```

conclusion: lets not
