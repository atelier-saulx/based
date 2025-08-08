# Vectors

## vector

```ts
await db.setSchema({
  types: {
    data: {
      props: {
        row: {
          type: 'vector',
          size: 5,
        },
      },
    },
  },
})
```

## colvec

```ts
await db.setSchema({
  types: {
    col: {
      blockCapacity: 10_000,
      insertOnly: true,
      props: {
        vec: { type: 'colvec', size: 8 },
      },
    },
  },
})
```

```mermaid
block-beta
  columns 1
  block:BLOCKS:1
    columns 3
    block:B1:1
      node1_b1["node_1_f1"]
      node2_b1["node_2_f1"]
      node3_b1["node_n_f1"]
    end
    block:B2:1
      node1_b2["node_1_f1"]
      node2_b2["node_2_f1"]
      node3_b2["node_n_f1"]
    end
    block:B3:1
      node1_b3["node_1_f1"]
      node2_b3["node_2_f1"]
      node3_b3["node_n_f1"]
    end
  B1-->B2
  B2-->B3
  end
  style BLOCKS fill:#0000,stroke-width:0
```

`colvec` fields are stored on `size * blockCapacity` sized arrays in-memory.
