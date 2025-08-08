# Enum

```js
await db.setSchema({
  types: {
    pokemon: {
      props: {
        type: {
          type: 'enum',
          enum: ['normal', 'fire', 'water', 'electric', 'grass', 'flying', 'bug', 'rock'],
          default: 'normal',
        },
      },
    },
  },
})
```
