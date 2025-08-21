# Aggregation API

This document provides a the API for creating aggregation queries. Aggregation queries allow you to perform calculations on your data and return summarized results.
Full query examples can be found in the [tests](https://github.com/atelier-saulx/based/blob/main/packages/db/test/aggregate.ts).

## General Purpose Aggregate Functions

### `sum(property: string | string[], options?: object)`

Calculates the sum of numeric properties across nodes.

**Examples:**

```javascript
// Basic sum
await db.query('vote').sum('NL').get()

// Multiple properties
await db.query('vote').sum(['NL', 'AU']).get()

// With filtering
await db.query('vote').filter('country', '=', 'aa').sum('NL').get()

// Nested properties
await db.query('vote').sum('flap.hello').get()
```

**Behavior:**

- Returns 0 for properties that don't exist
- Handles all numeric types (int8, uint16, number, etc.)
- Works with filtered queries

### `count()`

Counts the number of nodes matching the query.

**Examples:**

```javascript
// Simple count
await db.query('vote').count().get()

// Count with grouping
await db.query('vote').groupBy('country').count().get()
```

**Note:** Returns as `{ $count: number }`

### `avg(property: string | string[], options?: object)`

Calculates the arithmetic mean of numeric properties.

**Examples:**

```javascript
// Basic average
await db.query('vote').avg('NL').get()

// Multiple properties
await db.query('vote').avg(['NL', 'PT', 'FI']).get()

// With grouping
await db.query('vote').avg('NL').groupBy('region').get()
```

### `max(property: string | string[])` / `min(property: string | string[])`

Finds the maximum/minimum value of specified properties.

**Examples:**

```javascript
// Single property
await db.query('vote').max('NL').get()

// Multiple properties
await db.query('vote').min(['NL', 'NO', 'PT']).groupBy('region').get()
```

## Statistical Aggregate Functions

### `stddev(property: string | string[], options?: { mode: 'sample' | 'population' })`

Calculates standard deviation (sample by default).

- `sample`: normalize with `N-1` (which is `count - 1`), provides the square root of the best unbiased estimator of the variance.
- `population`: normalize with `N` (which is `count`), this provides the square root of the second moment around the mean.

**Examples:**

```javascript
// Sample standard deviation
await db.query('vote').stddev('NL').get()

// Population standard deviation
await db
  .query('vote')
  .stddev('PL', { mode: 'population' })
  .groupBy('region')
  .get()
```

### `var(property: string | string[], options?: { mode: 'sample' | 'population' })`

Computes variance (sample by default).

- `sample`: normalize with `N-1` (which is `count - 1`), provides the square root of the best unbiased estimator of the variance.
- `population`: normalize with `N` (which is `count`), this provides the square root of the second moment around the mean.

**Examples:**

```javascript
// Sample variance
await db.query('vote').var('NL').get()

// Population variance with grouping
await db.query('vote').var('PL', { mode: 'population' }).groupBy('region').get()
```

### `hmean(property: string | string[])`

Calculates the harmonic mean.

**Example:**

```javascript
await db.query('metric').hmean('responseTime').groupBy('endpoint').get()
```

### `cardinality(property: string)`

Estimates distinct value count.
Property must have `cardinality` type.

More info about in cardinality estimation [here](db/cardinality.md).

**Example:**

```javascript
await db.query('user').cardinality('country').get()
```

## Grouping Operations

### `groupBy(property: string)`

Groups results by property values.

**Basic Examples:**

```javascript
// Simple grouping
await db.query('vote').groupBy('country').get()

// Grouping with aggregation
await db.query('vote').sum('NL', 'AU').groupBy('country').get()
```

Grouping by numeric values is also allowed. Example:

```js
const m1 = await db.create('movie', {
  name: 'Kill Bill',
  year: 2003,
})
const m2 = await db.create('movie', {
  name: 'Pulp Fiction',
  year: 1994,
})

await db.query('movie').groupBy('year').count().get()

// Result:
// {
//   1994: {
//     $count: 1,
//   },
//   2003: {
//     $count: 1,
//   },
// }
```

**Advanced Examples:**

```javascript
// Multiple aggregations with grouping
await db.query('vote').avg('NL').max('PT').min('FI').groupBy('region').get()

// Grouping enum types
await db.query('beer').avg('price').groupBy('type').get()
```

## Grouping by Reference node IDs

The groupBy operation supports grouping nodes by their reference relationships ids.

Example:

```text
Driver ->(vehicle)-> Vehicle
Driver ->(trips)-> [Trip]->(vehicle)-> Vehicle
```

```javascript
// Group drivers by their assigned vehicle
await db.query('driver').sum('rank').groupBy('vehicle').get()
// Returns: {
//   '2': { rank: 5 }  // All drivers using vehicle ID 2
// }
```

Works with nested queries:

```javascript
// Get drivers with their trips grouped by vehicle
await db
  .query('driver')
  .include('name', 'rank', (q) => {
    q('trips').groupBy('vehicle').sum('distance')
  })
  .get()
// Returns: [
//   {
//     id: 1,
//     name: 'Luc Ferry',
//     rank: 5,
//     trips: {
//       '2': { distance: 523.1 }  // Trips grouped by vehicle ID
//     }
//   }
// ]
```

## Temporal Grouping (Time-based Aggregations)

### `groupBy(property: string | string[], step?: string | number | { step: string | number, timeZone?: string}?)`

Groups timestamp properties by time intervals.

**Supported Intervals:**

- `epoch`, Number of seconds that have elapsed since the beginning of the Unix epoch (January 1, 1970, at 00:00:00 UTC). Unix time or POSIX time.
- `hour`
- `day`, The day of the month (1–31)
- `doy`, The day of the year (0–365)
- `dow`, The day of the week as Sunday (0) to Saturday (6)
- `isoDOW`, The day of the week as Monday (1) to Sunday (7). This matches the ISO 8601 day of the week numbering.
- `month`, The number of the month within the year (0–11);
- `year`
- Custom durations in seconds like `15 * 60 // 15 minutes`, `6 * 3600 // 6 hours`, `3 * 24 * 2600 // 3 days`

**Examples:**

```javascript
// Daily grouping with shorthand 'day'
await db.query('event').count().groupBy('timestamp', 'day').get()

// 30-minute intervals with shorthand seconds
await db
  .query('metric')
  .avg('value')
  .groupBy('recordedAt', 30 * 60)
  .get()

// Daily grouping with full notaton
await db.query('event').count().groupBy('timestamp', { step: 'day' }).get()

// getting raw results in epoch format
await db.query('trip').sum('distance').groupBy('pickup').get(),
    // Result:
    // {
    //   1733916600000: {
    //     distance: 513.44,
    //   },
    //   1733914800000: {
    //     distance: 813.44,
    //   },
    // }

// getting formated output as javascript date time or interval ranges
  const dtFormat = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  })

    await db
      .query('trip')
      .sum('distance')
      .groupBy('pickup', { step: 40 * 60, display: dtFormat })
      .get()
// Result:
// {
//   '11/12/2024 08:00 – 08:40': {
//     distance: 1326.88,
//   }
// }

await db
      .query('trip')
      .sum('distance')
      .groupBy('pickup', { display: dtFormat })
      .get(),
// Result:
// {
//   '11/12/2024, 08:30': { distance: 513.44 },
//   '11/12/2024, 08:00': { distance: 813.44 },
// }

// With multiple aggregations
await db
  .query('sensor')
  .avg('temperature')
  .max('humidity')
  .groupBy('readingTime', 'hour')
  .get()
```

### Working with Timezones

The temporal grouping supports timezone-aware aggregations when using the object syntax for intervals. This allows grouping timestamps according to local time in any timezone.

#### Timezone Grouping Syntax

```javascript
.groupBy('timestamp', {
  step: 'day' | 'hour' | 'month',  // Interval unit
  timeZone: 'IANA_TIMEZONE'        // IANA timezone identifier
})
```

#### Key Behavior (from tests):

1. **UTC storage**: All timestamps are stored in UTC (as shown by `new Date()` usage)
2. **Local time grouping**: Applies timezone conversion before grouping
3. **Return format**: Returns numeric keys representing local time components:
   - `day`: 1-31
   - `hour`: 0-23
   - `month`: 0-11 (January=0)

#### Examples:

**1. Daily Grouping by Local Time**

```javascript
// Groups UTC midnight (00:00) to São Paulo local time (21:00 previous day)
await db
  .query('trip')
  .sum('distance')
  .groupBy('pickup', {
    step: 'day',
    timeZone: 'America/Sao_Paulo',
  })
  .get()
// Returns: {
//   10: { distance: 813.44 }, // Dec 10 local date
//   11: { distance: 513.44 }  // Dec 11 local date
// }
```

**2. Hourly Grouping with Timezone**

```javascript
// Converts UTC times to São Paulo hours
await db
  .query('trip')
  .sum('distance')
  .groupBy('pickup', {
    step: 'hour',
    timeZone: 'America/Sao_Paulo',
  })
  .get()
// Returns: {
//   21: { distance: 813.44 }, // 9PM local time
//   12: { distance: 513.44 }  // 12PM local time
// }
```

**3. Monthly Grouping Across Timezones**

```javascript
// Groups by local month index (0-11)
await db
  .query('trip')
  .sum('distance')
  .groupBy('dropoff', {
    step: 'month',
    timeZone: 'America/Sao_Paulo',
  })
  .get()
// Returns: {
//   11: { distance: 813.44 }, // December (UTC)
//   10: { distance: 513.44 }  // November (local timezone conversion)
// }
```

#### Important Notes:

1. **IANA Timezone Required**: Must use official timezone names (e.g., `'Europe/Amsterdam'`)
2. **Daylight Saving Aware**: Automatically handles DST transitions
3. **Month Indexing**: Returns 0-11 (unlike JavaScript's 1-31 for days)

#### Timezone Conversion Example:

```javascript
// To display the local dates:
const results = await db
  .query('trip')
  .groupBy('pickup', { step: 'day', timeZone: 'Asia/Tokyo' })
  .get()

const fmt = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  dateStyle: 'full',
})

const withDates = Object.fromEntries(
  Object.entries(results).map(([day, data]) => {
    // Create date in Tokyo timezone (day is local date)
    const date = new Date()
    date.setFullYear(2024, 11, day) // Month is 0-11
    return [fmt.format(date), data]
  }),
)
```

## Relationship Aggregations

### Aggregations on Referenced Nodes

**Examples:**

```javascript
// Simple reference aggregation
await db
  .query('team')
  .include((select) => {
    select('players').sum('goalsScored')
  })
  .get()

// Grouped reference aggregation
await db
  .query('sequence')
  .include((select) => {
    select('votes').groupBy('country').sum('NL', 'AU')
  })
  .get()

// Mixed with parent properties
await db
  .query('team')
  .include('name', 'city', (select) => {
    select('players').groupBy('position').avg('rating')
  })
  .get()
```

## Range Limiting

The `.range()` method allows pagination of aggregation results, working consistently with both main queries and nested grouped references.

### `.range(start: number, end: number)`

Limits the number of returned groups in aggregation queries.

#### Key Behavior:

1. **Works with all group types**:

   - Reference groupings
   - Property-based groupings

2. **Consistent pagination**:

   - `start`: Inclusive index (0-based)
   - `end`: Exclusive index
   - Returns `end - start` groups maximum

3. **Preserves structure**:
   - Maintains grouped object structure
   - Only includes the requested range of keys

#### Examples:

**1. Paginating Temporal Groups**

```javascript
// Get first 2 hourly groups
await db
  .query('job')
  .groupBy('day', {
    step: 'hour',
    timeZone: 'America/Sao_Paulo',
  })
  .avg('tip')
  .range(0, 2) // First two hours
  .get()
// Returns object with exactly 2 keys
```

**2. Limiting Nested Groupings**

```javascript
// Get first 2 employees with their territory sums
await db
  .query('employee')
  .include((q) => q('area').groupBy('name').sum('flap'))
  .range(0, 2) // First two employees
  .get()
// Returns array with exactly 2 items
```

**3. Combined with Other Operations**

```javascript
// Paginated daily aggregates with filtering
await db
  .query('job')
  .filter('tip', '>', 10)
  .groupBy('day', optionsVar)
  .sum('tip')
  .range(5, 10) // Groups 5 through 9
  .get()
```

## Handling Special Cases

### Undefined/Null Values

- Treated as 0 for sum/avg
- Excluded from min/max calculations
- Affect statistical function denominators

**Examples:**

```javascript
// Undefined treated as 0
await db.query('vote').sum('undefinedProp').get() // Returns 0

// Avg behavior
await db.query('item').avg('optionalNumber').get() // Counts undefined as 0 in average
```

### Empty Groups

- Return empty objects `{}` when no matches
- Aggregations on empty groups return 0

### Numeric Type Handling

- Properly handles all numeric types:
  - Integer types (int8, uint16, etc.)
  - Floating point (number)
  - BigInt where supported

## Performance Considerations

1. **Indexing**: Ensure frequently grouped properties are indexed
2. **Query Scope**: Use filters to limit aggregation scope
3. **Bulk Operations**: For large datasets, consider:

   ```javascript
   // Better for large datasets
   await db
     .query('data')
     .filter('timestamp', '>', startDate)
     .groupBy('category')
     .count()
     .get()
   ```

4. **Memory**: Complex nested aggregations may require more memory
5. **Network**: Large result sets should use pagination:
   ```javascript
   await db.query('user').groupBy('department').count().range(0, 50).get()
   ```

## Common Patterns

### Time Series Analysis

```javascript
await db
  .query('metrics')
  .filter('timestamp', '>=', startDate)
  .avg('value')
  .groupBy('timestamp', '1 hour')
  .get()
```

### Category Breakdown

```javascript
await db.query('products').sum('sales').avg('price').groupBy('category').get()
```

### Group by enum types

```js
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
const b1 = await db.create('beer', {
  name: "Brouwerij 't IJwit",
  type: 'Wit',
  price: 7.2,
  alchol: 6.5,
  year: 1985,
})
const b2 = await db.create('beer', {
  name: 'De Garre Triple Ale',
  type: 'Tripel',
  price: 11.5,
  alchol: 11.0,
  year: 1986,
})

const b3 = await db.create('beer', {
  name: 'Gulden Draak',
  type: 'Tripel',
  price: 12.2,
  alchol: 10.0,
  year: 1795,
})

await db.query('beer').avg('price').groupBy('type').get()
// {
//   Tripel: {
//     price: 11.85,
//   },
//   Wit: {
//     price: 7.2,
//   },
// }
```
