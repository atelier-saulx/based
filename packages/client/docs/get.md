# _Get_ Method Query Reference

## Introduction

The `based.get()` method allows the user to retrieve data from the database. The user can shape the resulting object using Based's special _$operators_ and syntax.

The method takes as argument a single object formatted using the based-db query language, and returns an object containing the required data.

> :exclamation: **_Note:_** While the `get()` method and `observe()` method share the same argument syntax, when using `get()` you will not subscribe to the query, thus you will not be notified when there's a change in the node.

**Based-db** is a graph database, meaning that nodes are connected by reference in a tree-like structure. When executing a `get` operation, you can either extract data from a single node, or start from a single node and execute a _traversal_ of the tree, collecting data along the way. The starting point and direction of this traversal can be specified in the query.

Let's look at an example:

```js
/*
Let's have the following node in the db
{
  id: 'ch6d044a24',
  type: 'characters',
  name: 'anakin',
  address: 'a galaxy far far away',
  specialties: [ 'force', 'fatherly love', 'breathing' ]
}
*/
const data = await client.get({
  $id: 'ch6d044a24',
  name: true,
  address: true,
})
/*
Will result in
data = {
  name: 'anakin',
  address: 'a galaxy far far away',
}
*/
```

`$id` is an operator (since it is prefixed with **_$_**) that points Based to the node with the ID specified, and the rest of the query says to return only the fields `name` and `address` from that node.  
This will not run a traversal.

## Query structure

Queries are objects that hold the data structure to be returned, as well as the operators that shape it.

```js
const result = await get({
  $language: 'en', // operator that sets the language to return in text fields
  $id: 'muASxsd3', // operator that sets the id of the document to return

  title: true, // includes the document fields title and
  year: true, // year to the results

  technicalData: {
    // adds the field technicalData which is
    // an object data type with nested properties.
    runtime: true,
    camera: {
      lens: true,
      // Of these properties, only `runtime` and
      // `camera.lens` are included in the result
    },
  },
})

// returns:
// {
//   title: '2001: A Space Odyssey',
//   year: 1968,
//   technicalData: {
//     runtime: 97
//     camera: {
//       lens: '5-perf 65mm'
//     }
//   }
// }
```

They can mirror the existing structure in the document to filter its contents or dynamically add new fields to include fields inherited from its ancestors or from a traversal. See [`$inherit`](#inherit-boolean) for more details.

```js
const result = await get({
  $language: 'en',
  $id: 'muASxsd3',
  title: true,
  icon: { $inherit: true },
  // icon is not part of the movie type
  // but inherited from a parent node
})

// returns:
// {
//   title: '2001: A Space Odyssey',
//   icon: 'http://example.com/an_icon.png'
// }
```

A query can also have other queries nested directly in the field value or as part of a `$field` operator.

```js
const result = await get({
  $language: 'en',
  $id: 'muASxsd3',
  title: true,
  otherMovie: {
    $id: 'muFDedx2', // adds another query
    title: true, // as the value of `otherMovie` field
  },
})

// returns:
// {
//   title: '2001: A Space Odyssey',
//   otherMovie: {
//     title: 'Soylent Green'
//   }
// }
```

Array syntax can also be used to concatenate different individual queries. The result of each query is concatenated in the returned array.

```js
const result = await get({
  $language: 'en',
  $id: 'muASxsd3',
  title: true,
  type: true, // default field type that holds the documetn type
  extraFields: [
    {
      $id: 'muFDedx2',
      title: true,
      type: true,
    },
    {
      $id: 'geGhfr4D',
      title: true,
      type: true,
    },
  ],
})

// returns:
// {
//   title: '2001: A Space Odyssey',
//   type: 'movie',
//   extraFields: [
//     {
//       title: 'Soylent Green',
//       type: 'movie',
//     },
//     {
//       title: 'Sci-fi',
//       type: 'genre',
//     }
//   ]
// }
```

## Operators

- [`$id`](#id-string--string-string-)
- [`$alias`](#alias-string--string-string-)
- [`$all`](#all-boolean)
- [`<any field name>`](#any-field-name-boolean--object)
  - [`$value`](#value-any)
  - [`$default`](#default-any)
  - [`$inherit`](#inherit-boolean)
    - [`$type`](#type-string--string-string-)
    - [`$item`](#item-string--string-string-)
    - [`$required`](#required-string--string-string-)
  - [`$field`](#field-string--string-string-)
  - [`$language`](#language-string)
  - [`$find`](#find-object)
    - [`$traverse`](#traverse-string--id1-id2---object)
    - [`$recursive`](#recursive--boolean)
    - [`$filter`](#filter-object--array)
    - [`$list`](#list-boolean--object)
  - [`$aggregate`](#aggregate-object)

## `$id`: _string | [string, string, ...]_

ID of the node to get. If it is an array, the first existing record is used for the query.
If omited, the _root_ object ID is assumed. Can only be used at the top level of a query object.

```js
const result = await get({
  $id: 'muASxsd3',
})
```

## `$alias`: _string | [string, string, ...]_

Alias of the object to get. If it is an array, the first existing record is used for the query.
An ID can also be passed as `$alias`. If the specified alias does not exist, the value is tried as an ID lookup also before moving to the next entry if an array is specified.

```js
const result = await get({
  $alias: ['/home', '/stuff'],
})
```

## `$all`: _boolean_

Includes all the fields in the document, except for `reference(s)` type fields.

```js
const result = await get({
  $id: 'peASxsd3',
  $all: true,
})
```

Fields can be excluded if a false is set to specific fields.

```js
const result = await get({
  $id: 'peASxsd3',
  $all: true,
  died: false,
})
```

## `<any field name>`: _boolean | object_

When truthy, includes the named field in the results object.  
If an object is passed and the object contains a query, the results of the query will fill that field.  
This means that it's possible to include a field name that doesn't actually exist in any node, but will be filled with a different query result.

```js
const result = await get({
  $id: 'muASxsd3',
  title: true,
  director: true,
  technicalData: {
    runtime: true,
    color: true,
    aspectRatio: true,
  },
  sequel: {
    $id: 'muiK9sQ3',
    title: true,
    director: true,
  },
})
/*
    'result' will then contain a nested field called sequel.title
    containing the title field of the node with id = 'muiK9sQ3'
*/
```

### `$value`: _any_

Overrides the current value of the field. It can be of any type.

```js
const result = await get({
  $id: 'moASxsd3',
  title: { $value: 'Amazing movie' },
})
```

### `$default`: _any_

Default value to be returned in case the field has no value set.

```js
const result = await get({
  $id: 'moASxsd3',
  director: { $default: 'Unknown director' },
})
```

### `$inherit`: _boolean_

If the value for the field is not set in the node, `$inherit` searches for that field in the node's ancestors.

```js
// `icon` is not a field in the 'moSoylentGreen' node
// but exists in one of the nodes set as parents of it.
const result = await client.get({
  $id: 'moSoylentGreen',
  icon: { $inherit: true },
})
```

#### `$type`: _string | [string, string, ...]_

Limits inheritance to a specific node type or array of types in the ancestry. It goes in order through the array.

```js
// `icon` is not set in the 'moSoylentGreen' document
// but exists in a parent 'genre' type node
const result = await client.get({
  $id: 'moSoylentGreen',
  icon: {
    $inherit: { $type: ['genre', 'collection'] },
    // Of all the ancestors, only search the ones with type
    // 'genre' and 'collection', in that order.
  },
})
```

#### `$item`: _string | [string, string, ...]_

Once the inheritance traversal has found a hit, you can select which fields to inherit from that node. It's faster than doing multiple inherits since it's a single operation.

```js
// Let's have these two nodes in the db
// {
//   id: 'myleagueID'
//   type: 'league',
//   name: 'serie-a',
//   amount: 30,
// }
// and
// {
//     id: 'mymatchID'
//     type: 'match',
//     name: 'roma-lazio',
//     parents: [myleagueID],
// }
    const data = await client.get({
      $id: 'mymatchID,
      $all: true,
      league: {
        $inherit: { $item: 'league' },
        amount: true,
        name: true,
      },
    })
// returns:
// {
//   type: 'match',
//   name: 'roma-lazio',
//   id: 'mymatchID',
//   league: { amount: 30, name: 'serie-a' }
// }
```

#### `$required`: _string | [string, string, ...]_

Used in conjucntion with `$item`, it requires one or more fields to be set in the ancestor.

```js
// Let's have these two nodes in the db
// {
//   id: 'myleagueID'
//   type: 'league',
//   name: 'serie-a',
//   amount: 30,
// }
// and
// {
//     id: 'mymatchID'
//     type: 'match',
//     name: 'roma-lazio',
//     parents: [myleagueID],
// }
const data = await client.get({
  $id: 'mymatchID,
  $all: true,
  league: {
    $inherit: { $item: 'league', $required: 'flurp' },
    amount: true,
    name: true,
  },
})
// returns { type: 'match', name: 'roma-lazio', id: 'mymatchID' },
// since there's no node in the ancestors of 'mymatchID'
// with a field called 'flurp'
const data = await client.get({
  $id: 'mymatchID,
  $all: true,
  league: {
    $inherit: { $item: 'league', $required: 'amount' },
    amount: true,
    name: true,
  },
})
// will return
// {
//   type: 'match',
//   name: 'roma-lazio',
//   id: 'mymatchID',
//   league: { amount: 30, name: 'serie-a' }
// }
// since this time the required field is indeed set.

```

### `$field`: _string | [string, string, ...]_

The `$field` operator is used to create a field that fetches its results from another field.

```js
const result = await client.get({
  $id: 'mo2001ASpaceOdyssey',
  directedBy: { $field: 'director' },
})
```

Dot notation can be used to create a path to a nested field or even specific data inside a _`JSON`, `object`, `text`, `record`_ and _`reference`_ datatype.

```js
const result = await client.get({
  $id: 'mo2001ASp',
  ratio: { $field: 'technicalData.aspectRatio' },
})
// with title : 'text' = {en: 'A space odissey', it: 'Odissea nello spazio'}
const result = await client.get({
  $id: 'mo2001ASp',
  englishTitle: { $field: 'title.en' },
})
// with sequel : 'reference' = 'mo2001ASp'
const result = await client.get({
  $id: 'mo2SD58dfd',
  englishTitleOfSequel: { $field: 'sequel.title.en' },
})
```

The `$field` operator can take an Array instead of a string. The array can have several field names or paths for the alias to point to. The first that is defined in the document will be returned.

```js
const = await client.get({
  $id: 'mo2001ASpaceOdyssey',
  by: { $field: ['producer', 'director'] }
})
```

## `$language`: _string_

Filters node's data to a set language on fields that support it. Currently only the `text` type supports this.

```js
const result = await client.get({
  $language: 'en',
  $id: 'mo2001ASpaceOdyssey',
  title: true, // value of `title` becomes the value of `title.en`
})
```

## `$find`: _object_

This operator is one of the most useful ones, and you'll probably be using it a lot when dealing with Based-db.

It specifies that the `get()` operation (or `observe()`) should execute a **traversal of the database**. The operators used in conjunction with it allow the user to change **direction**, **starting point**, and **filter** of this traversal.  
It is especially useful when used in conjunction with the `$list` operator, turning the result into an array of nodes that match the query.

It is used as a property of a field of the return object.
When not used together with `$list`, it will return the first matched document.

```js
const data = await client.get({
  $id: 'root',
  $all: true,
  $find: {
    $traverse: 'children',
  },
})
// Will return a single random child of root, the first one hit.
```

### `$traverse`: _string | [id1, id2, ...] | object_

- Property of `$find`.
- Allowed values: any field of type `references`, an array of IDs, an object

This sets the direction of the traversal, which starts from the `$id` specified or, if omitted, from `root`.

Based-db has four built-in fields of type `references`:

| Value       | Meaning                                                                                                                                              |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| parents     | Relationship set by the user.                                                                                                                        |
| ancestors   | Recursively traverse the tree upwards, from parent to parent of parent and so on.                                                                    |
| children    | Relationship set by the user.                                                                                                                        |
| descendants | Recursively traverse the tree downwards, from child to child of child and so on. **If this is applied to `root`, it traverses the entire database.** |

```js
const data = await client.get({
  $id: 'root',
  $all: true,
  $find: {
    $traverse: 'children',
  },
})
// Will return a single random child of root, the first one hit.
```

When set to an object, `$traverse` can take special operators that change the traversal.

These are `$any`, `$first`, `<node's type>`.

```js
client.get({
  $id: 'root',
  id: true,
  items: {
    name: true,
    nonsense: { $default: 'yes' },
    $list: {
      $find: {
        $recursive: true,
        $traverse: {
          root: 'children',
          league: { $first: ['matches', 'children'] },
          team: { $all: ['parents', 'children'] },
          $any: false,
        },
      },
    },
  },
})
```

#### `<node's type name>` : _reference(s) field(s)_

When setting for example `root: { 'children' }` in the traverse object, we're saying that when in a node of type `'root'`, the traversal should go through the field named `'children'`.

##### `$first`: _[string, string, ...]_

When setting the traversal object field to `league: { $first: ['matches', 'children'] }` we're saying that when in a node of type `league`, the traversal should go through the **first existing field** in the list.

##### `$all`: _[string, string, ...]_

Viceversa, when setting the traversal object to `team: { $all: ['parents', 'children'] }`, we're saying that when in a node of type `team`, the traversal should go through the **all the existing field** in the list.

#### `$any` : _boolean | reference(s) field(s)_

The previous example query ends with `$any: false` which act as a catch-all for the other node types, meaning that in any other node type there should be no traversal.

### `$recursive` : _boolean_

If set to `true` within the `$find` operator, it recursevely traverses `references` nodes with the name specified in `$traverse`.  
For example, doing **a recursive traversal on the `children` field is equivalent to doing a traversal on `descendants`.**

```js
const res = await client.get({
  $id: firstId,
  items: {
    id: true,
    title: true,
    $list: {
      $find: {
        $traverse: 'subclasses',
        $recursive: true,
        $filter: {
          $field: 'num',
          $operator: '=',
          $value: 180,
        },
      },
    },
  },
})
// This will recursively traverse all 'subclasses' references
// starting from id firstId. (and turn 'items' into an array,
// see later for $list operator)
```

### `$filter`: _object | array_

Property of `$find`.

Sets a search term for the `$find` operator.
Has the following properties:

- `$operator`: _string_ - Operator to use in the comparison.
- `$field`: _string_ - Field name to compare the value to.
- `$value`: _string_ - Value to compare the field to.

The `$operator` has several possible types:

| Operator      | Field type   | `value` format  | Effect                   |
| ------------- | ------------ | --------------- | ------------------------ |
| `'='`         | all          |                 | is equal to              |
| `'!='`        | all          |                 | is not equal to          |
| `'>'`         | number types |                 | is strictly greater than |
| `'<'`         | number types |                 | is strictly less than    |
| `'..'`        | number types | [number,number] | is in range (inclusive)  |
| `'has'`       | `set`        |                 | value is in set          |
| `'exists'`    | all          |                 | field is set in node     |
| `'notExists'` | all          |                 | field is not set in node |

Search terms can be **composed with the `$or` and `$and` operators**, and nested to create complex logic.
If an array of search terms is used, each term acts as an **AND**.

```js
const result = await client.get({
  $id: 'mo2001ASpaceOdyssey',
  $language: 'en',
  title: true,
  genres: {
    name: true,
    $list: {
      $traverse: 'parents',
      $find: {
        $filter: {
          $field: 'type',
          $operator: '=',
          $value: 'genre',
        },
      },
    },
  },
})
```

#### `$or`: _object_

Property of `$filter`.
Adds a OR search term to the filter.
Can be nested.

#### `$and`: _object_

- Property of `$filter`.
- Adds a AND search term to the filter.
- Can be nested.

```js
const result = await client.get({
  $id: 'geScifi',
  $language: 'en',
  name: true,
  longMovies: {
    title: true,
    $list: {
      $traverse: 'children',
      $find: {
        $filter: {
          $field: 'type',
          $operator: '=',
          $value: 'movie',
          $and: {
            $field: 'technicalData.runtime',
            $operator: '>',
            $value: 100,
          },
        },
      },
    },
  },
})
```

### `$list`: _boolean | object_

- Sets the field to return **a collection of documents.**

It can be set as a property of any field, turning it, if possible, into a list.  
It is possible to nest more operators in the list object to shape the collection of items.

```js
const result = await client.get({
  $id: 'geScifi',
  $language: 'en',
  name: true,
  longMovies: {
    title: true,
    $list: {
      $traverse: 'children',
      },
    },
  },
})
// longMovies is now a list containing titles of the children of node 'geScifi'
```

#### `$sort`: _object_

Property of `$list` operator.  
Sorts the `$list` results according to the following properties:

- `$field`: _string_ - Name of the field to sort by.
- `$order`: _['asc', 'desc']_ - Sort in ascending or descending order.

```js
const result = await client.get({
  $id: 'geScifi',
  $language: 'en',
  children: {
    title: true,
    year: true,
    $list: {
      $sort: { $field: 'year', $order: 'asc' },
      $find: {
        $traverse: 'children',
      },
    },
  },
})
// if any of the nodes doesnt have a 'year' field,
// they get bumped to the end of the list, orderd by alphabetically by id.
```

#### `$offset`: _integer_

- Property of `$list` operator.
- Shows results of a `$list` starting at the specified index.

```js
const result = await client.get({
  $id: 'geScifi',
  $language: 'en',
  children: {
    title: true,
    year: true,
    $list: {
      $sort: { $field: 'year', $order: 'asc' },
      $offset: 0,
      $limit: 2,
    },
  },
})
```

#### `$limit`: _integer_

- Property of `$list` operator.
- Limits the `$list` amount of items returned in a `$list`.

## `$aggregate`: _object_

The `$aggregate` operator takes the same arguments as `$find`, but instead of returning a node or node fields it returns a single number.  
The type of aggregation is defined by the `$function` operator, which takes one of `'count' | 'avg' | 'sum'`.

| Func    | Syntax                                        | Return value                                                                                                   |
| ------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `count` | -                                             | How many nodes correspond to the query                                                                         |
| `sum`   | `$function: {$name: 'sum', $args: ['value']}` | Sum together all `value` fields of every node found during the traversal. Can only be used on numerical types. |
| `avg`   | `$function: {$name: 'avg', $args: ['value']}` | Average of all `value` fields of every node found during the traversal. Can only be used on numerical types.   |

```js
await client.get({
  $id: 'root',
  id: true,
  valueSum: {
    $aggregate: {
      $function: { $name: 'sum', $args: ['value'] },
      $traverse: 'descendants',
      $filter: [
        {
          $field: 'type',
          $operator: '=',
          $value: 'match',
        },
        {
          $field: 'value',
          $operator: 'exists',
        },
      ],
    },
  },
}),
// Sums together all the `value` fields in the descendants of root
// of type `match`, where the `value` field exists.
```
