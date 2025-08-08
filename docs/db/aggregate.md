# Aggregations

This document provides a guide to creating aggregation queries. Aggregation queries allow you to perform calculations on your data and return summarized results.
Full query examples can be found in the [tests](https://github.com/atelier-saulx/based/blob/main/packages/db/test/aggregate.ts)

---

## Features Covered

### General Purpose Aggregate Functions

- **`sum()`**: Calculates the sum of numeric properties.
- **`count()`**: Counts the number of records.
- **`avg()`**: Computes the arithmetic mean of numeric properties.
- **`max()`**: Finds the maximum value of numeric properties.
- **`min()`**: Finds the minimum value of numeric properties.

### Statistical Aggregate Functions

- **`hmean()`**: Computes the harmonic mean of numeric properties.
- **`stddev()`**: Calculates the standard deviation of numeric properties. Default: Population Standard Deviation.
- **`var()`**: Computes the variance of numeric properties. Default: Population Variance.
- **`cardinality()`**: Estimate the count of distinct records.

### Grouping Operations

- **`groupBy()`**: Groups results based on the values of a specified property.

### Other features

- **Suports for standard Based DB operations** like `filter()`, `include()`, `limit()`, etc.
- **Support for various numeric types**: `uint8`, `int8`, `uint16`, `int16`, `uint32`, `int32`, `number`.
- **Branched Queries / Nested object notation** for properties.
- **Aggregations on references (relationships)**.
- **Grouping by enum types**.
- **Grouping by timestamp types**.
- **Grouping by with custom intervals**.

---

## Basic Aggregation Queries

You can perform aggregations directly on a collection of data.

### `sum()`

The `sum()` function calculates the total sum of specified numeric properties.

**Sum of a single property:**

To sum the `NL` property for all `vote` records:

```javascript
await db.query('vote').sum('NL').get().toObject()
```

**Sum of multiple properties:**

You can sum multiple properties in a single query:

```javascript
await db.query('vote').sum('NL', 'AU').get().toObject()
```

**Sum with filtering:**

Combine `sum()` with `filter()` to aggregate data that meets specific criteria:

```javascript
await db.query('vote').filter('country', '=', 'aa').sum('NL').get().toObject()
```

**Sum on nested properties:**

You can sum properties within nested objects using dot notation:

```javascript
await db.query('vote').sum('flap.hello').get().inspect()
```

yields: `{ flap: { hello: 100 } }`

**Handling empty result sets:**

If a query with `sum()` returns no matching records, the sum for the specified properties will be `0`:

```javascript
const nl1 = db.create('vote', {
  country: 'bb',
  flap: { hello: 100 },
  NL: 10,
})
const nl2 = db.create('vote', {
  country: 'aa',
  NL: 20,
})
const au1 = db.create('vote', {
  country: 'aa',
  AU: 15,
})
await db.query('vote').filter('country', '=', 'zz').sum('NL').get().toObject()
```

yields: `{ NL: 0 }`

This by desig behaviour also afects statistical functions as you can see in [Handling Numeric Types and `undefined` Values](#handling-numeric-types-and-undefined-values)

### `count()`

The `count()` function returns the total number of records that match the query.

**Returning sintax:**

Besides other aggregate functions returning sintax, Count returns with a "$" sign:

```javascript
await db.query('vote').count().get().inspect()
```

yields:

`{ $count: 3 }`

## Grouping Aggregations with `groupBy()`

The `groupBy()` function allows you to categorize your data based on a property and then apply aggregations to each group.

### `sum()` with `groupBy()`

**Grouping by a single property and summing:**

```javascript
await db.query('vote').sum('NL', 'AU').groupBy('country').get().toObject()
```

yields:
` { bb: { NL: 10, AU: 0 }, aa: { NL: 20, AU: 15 } }`

**`groupBy()` with no aggregation function:**

You can use `groupBy()` without an explicit aggregation function to simply categorize results:

```javascript
  await db.query('vote').groupBy('country').get().toObject(),
```

**Filtering and grouping:**

Filters can be applied before grouping:

```javascript
await db
  .query('vote')
  .filter('country', '=', 'bb')
  .groupBy('country')
  .count()
  .get()
  .toObject()
```

yields:

```
{ bb: { $count: 1 } }
```

---

## General Purpose and Statistical Aggregations

### `avg()` (Average)

Calculates the average value of specified numeric properties.

```javascript
  await db.query('vote').avg('NL', 'PT', 'FI').groupBy('region').get(),
```

yields:

```
  {
    bb: {
      NL: 16.5,
      PT: 21.5,
      FI: -500000.15,
    },
    aa: {
      NL: 46.5,
      PT: 46.5,
      FI: 0,
    },
    Great: {
      NL: 50,
      PT: 50,
      FI: -50.999,
    },
  },
```

### `stddev()` (Standard Deviation)

Computes the standard deviation of numeric properties. Considers that the dataset represents the statistical population.

```javascript
  await db.query('vote').stddev('NL', 'PL').groupBy('region').get(),
```

yields:

```{
    Brazil: {
      NL: 0,
    },
    bb: {
      NL: 6.5,
      PL: 11.5,
    },
    aa: {
      NL: 3.5,
      PL: 11.5,
    },
    Great: {
      NL: 0,
      PL: 0,
    },
  },
```

### `var()` (Variance)

Calculates the variance of numeric properties. Considers that the dataset represents the statistical population.

```javascript
  await db.query('vote').var('NL', 'PL').groupBy('region').get(),
```

yields:

```
  {
    bb: {
      NL: 42.25,
      PL: 132.25,
    },
    aa: {
      NL: 12.25,
      PL: 132.25,
    },
    Great: {
      NL: 0,
      PL: 0,
    },
  },
```

### `max()` (Maximum Value)

Finds the maximum value for specified numeric properties. Multiple props acts the same way as `ìnclude()`

```javascript
await db.query('vote').max('NL', 'NO', 'PT', 'FI').groupBy('region').get()
```

yields:

```
  {
    bb: {
      NL: 23,
      NO: -10,
      PT: 33,
      FI: 0,
    },
    aa: {
      NL: 50,
      NO: -43,
      PT: 50,
      FI: 0,
    },
    Great: {
      NL: 50,
      NO: -50,
      PT: 50,
      FI: -50.999,
    },
  },
```

### `min()` (Minimum Value)

Finds the minimum value for specified numeric properties.

```javascript
  await db.query('vote').min('NL', 'NO', 'PT', 'FI').groupBy('region').get(),
```

---

## Aggregations on Referenced Data

You can perform aggregations on data that is referenced by other records using the `include()` method. This is often referred to as "branched includes" or "branched queries".

### `sum()` on references

```javascript
await db
  .query('sequence')
  .include((select) => {
    select('votes').sum('NL', 'AU')
  })
  .get()
  .toObject()
```

yields:

```

[{ id: 1, votes: { NL: 30, AU: 15 } }]
```

### `groupBy()` and `sum()` on references

```javascript
await db
  .query('sequence')
  .include((select) => {
    select('votes').groupBy('country').sum('NL', 'AU')
  })
  .get()
  .toObject()
```

yields:

```
[{ id: 1, votes: { aa: { AU: 15, NL: 20 }, bb: { AU: 0, NL: 10 } } }],
```

### Aggregations on references with parent properties

You can include parent properties alongside aggregated referenced data:

```javascript
const result = await db
  .query('team')
  .include('teamName', 'city', (select) => {
    select('players').groupBy('position').sum('goalsScored', 'gamesPlayed')
  })
  .get()

deepEqual(
  result.toObject(),
  [
    {
      id: 1,
      teamName: 'Grêmio',
      city: 'Porto Alegre',
      players: {
        Forward: { goalsScored: 22, gamesPlayed: 11 },
        Defender: { goalsScored: 1, gamesPlayed: 10 },
      },
    },
    {
      id: 2,
      teamName: 'Ajax',
      city: 'Amsterdam',
      players: {
        Forward: { goalsScored: 8, gamesPlayed: 7 },
        Defender: { goalsScored: 2, gamesPlayed: 9 },
      },
    },
    {
      id: 3,
      teamName: 'Boca Juniors',
      city: 'Buenos Aires',
      players: {},
    },
    {
      id: 4,
      teamName: 'Barcelona',
      city: 'Barcelona',
      players: {
        Forward: { goalsScored: 5, gamesPlayed: 5 },
      },
    },
  ],
  'Include parent props, with referenced items grouped by their own prop, and aggregations',
)
```

---

## Handling Numeric Types and `undefined` Values

The aggregation functions correctly handle different numeric types (e.g., `uint8`, `int8`, `number`). When a numeric property is `undefined` for a record, it is treated as `0` for aggregation purposes, which can affect `avg()` and `max()`/`min()` results if not considered.

**Example with `undefined` numbers:**

If a record has a `FI` property that is undefined:

```javascript
deepEqual(
  await db.query('vote').max('AU', 'FI').groupBy('region').get().toObject(),
  {
    EU: {
      AU: 23,
      FI: 0,
    },
  },
  'number is initialized with zero',
)
deepEqual(
  await db.query('vote').avg('AU', 'FI').groupBy('region').get().toObject(),
  {
    EU: {
      AU: 16.5,
      FI: -500_000.15,
    },
  },
  'avg affected by count because number is initialized with zero',
)
```

In the `max()` example, `FI` is `0` if not present in a record, thus `max` would return `0` if all values are `undefined` or negative. In the `avg()` example, the `undefined` values contribute to the total count for the average calculation as `0`.

---

## Grouping by Enum Types

You can also use `groupBy()` on properties with `enum` types.

```javascript
const types = ['IPA', 'Lager', 'Ale', 'Stout', 'Wit', 'Dunkel', 'Tripel']
await db.setSchema({
  types: {
    beer: {
      props: {
        name: 'string',
        type: types,
        price: 'number',
        bitterness: 'number',
        alchol: 'number',
        year: 'uint16',
      },
    },
  },
})

// ... create the data

deepEqual(
  await db.query('beer').avg('price').groupBy('type').get(),
  {
    Tripel: {
      price: 11.85,
    },
    Wit: {
      price: 7.2,
    },
  },
  'group by enum in main',
)
```

---
