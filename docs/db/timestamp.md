# Timestamp

```js
await db.setSchema({
  types: {
    user: {
      props: {
        birthday: {
          type: 'timestamp',
        },
        createdAt: {
          type: 'timestamp',
          on: 'create',
        },
        updatedAt: {
          type: 'timestamp',
          on: 'update',
        },
      },
    },
  },
})
```
