# _Set_ Method Query Reference

## Introduction

The `based.set()` method changes data in the database. It can either create a new node or modify existing ones.  
As argument it takes a single object formatted using the based-db query language, and it returns an object containing the ID of the node it just operated on, or _undefined_ if the set was not succesful.  
The query language supports several **operators** to change the behaviour of the set operation. These operators are prefixed with a _**$**_ (e.g. `$id`, `$operator`... ).  
Fields without the **_$_** represent a specific field of the node.

Operators can act at the **node** level or at the **individual field** level.

- [**Node level operators**](#node-level-operators)
  - [`$id`](#id-string)
  - [`$db`](#db-string)
  - [`aliases`](#aliases-string--string)
  - [`$merge`](#merge-boolean)
  - [`$language`](#language-string)
  - [`$operation`](#operation-string)
- **Field type specific operators**
  - [Basic operators](#basic-operators)
    - `$default`
    - `$delete`
  - [`set` and `references` type field operators](#set-and-references-type-field-operators)
    - `$add`
    - `$delete`
  - [`object` and `record` type field operators](#object-and-record-type-field-operators)
    - `$merge`

## Node level operators

### `$id`: _string_

If provided, the operation is applied to the node the id points to. By default, if the node doesn't exist yet, a node with that id will be created and the operation will be applied to it.
This behaviour can be change with the `$operation` operator.

```js
// This sets the 'title' field on a node with id 'ma6d044a24' of type 'match'
const result = await client.set({
  $id: 'ma6d044a24',
  type: 'match',
  title: {
    en: 'hello',
  },
})
// This creates a new node of type 'match' and fills the 'title' field with 'hello'.
// 'result' will hold the id of the node just set.
const result = await client.set({
  type: 'match',
  title: {
    en: 'hello',
  },
})
```

### `$db`: _string_

There will be cases in which you'll want to store data on different indipendent database instances.  
Each instance can be assigned a name, which can be later specified with the `$db` operator.  
It can be left empty if only one database instance is present.

```js
// Set operation on the 'users' server
const result = await client.set({
  $db: 'users',
  $id: 'ma6d044a24',
  type: 'match',
  title: {
    en: 'hello',
  },
})
```

### `aliases`: _string | string[]_

An alias is an alternative way of referencing a node. Each node can have one or more aliases to be referenced by, and they can be set by modifying the `aliases` field of a node. This field is always present in a node.  

This allows to later _get_ the node by using the alias instead of the ID.

**Setting**

```js
{
  aliases: [ 'alias' ]
}
```

**Adding**

```js
{
  aliases: { $add: [ 'nice' ] }
}
```

**Deleting**

```js
{
  aliases: { $delete: [ 'nice' ] }
}
```

**Clearing**

```js
{
  aliases: []
 }
 ```
or
```js
{
  aliases: { $delete: true }
}
```

### `$merge`: _boolean_

Default value: `true`

The `$merge` operator can be used to specify whether any fields specified in the `.set()` should overwrite everything that currently exists in the database for that node (if it is updated), or whether any fields specified will be added or overwritten only if provided.

```js
/*
Let's assume the following node in database:
{
  id: 'maASxsd3',
  type: 'match',
  value: 10,
  title: {
    en: 'yes'
  }
}
*/

const result = await client.set({
  $merge: true, // optional, defaults to true
  type: 'match',
  title: {
    en: 'hello',
    de: 'hallo',
  },
  name: 'match',
})

/*
Value of `const result`: `maASxsd3`
Resulting node in database:
{

  id: 'maASxsd3',
  type: 'match',
  value: 10, // value remains
  title: {
    en: 'hello', // .en is overwritten
    de: 'hallo' // .de is merged in
  },
  name: 'match' // name is merged in
}
*/

/* With $merge: false */

/*
Let's assume the following node in database:
{
  id: 'maASxsd3',
  type: 'match',
  value: 10,
  title: {
    en: 'yes'
  }
}
*/

const result = await client.set({
  $merge: false,
  title: {
    de: 'hallo',
  },
  name: 'match',
})

/*
Value of `const result`: `maASxsd3`
Resulting node in database:
{
  id: 'maASxsd3',
  type: 'match',
  title: {
    de: 'hallo' // .de is added but .en is deleted
  },
  name: 'match' // name is added but value is deleted
}

*/
```

### `$language`: _string_

This operator changes how you set a value in a field of type `text`. See later for details. TODO

### `$operation`: _string_

Values: `upsert | create | update`, defaults to `upsert`.

This operator changes the _set_ operation type.

#### Upsert

_Upsert mode_ is the default set operation type. It updates an existing node or creates a new one if no node exists.

```js
const result = await client.set({
  $operation: 'upsert', // optional, defaults to 'upsert'
  $id: 'muASxsd3',
  title: {
    en: 'hello',
  },
})
```

Upsert acts both as _create_ and _update_.

#### Create

_Create mode_ fails if a node already exists, and returns `undefined` instead of the ID of the created node. If no entry exists with the specified `$id` or `$alias`, then it succesfully creates a new node, and returns its ID.

```javascript
const result = await client.set({
  $operation: 'create',
  $id: 'maASxsd3',
  title: {
    en: 'hello',
  },
})

/*
If no node with id = maASxsd3 exists, value of `result` = `maASxsd3`
If the node already exists, value of `result`= `undefined`. In this case nothing is set in the database and the node remains as it was.
*/
```

The same applies to `$alias`.

```javascript
const result = await client.set({
  $operation: 'create',
  $alias: 'myAlias',
  title: {
    en: 'hello',
  },
})

/*
If no node exists, value of `const result`: `maASxsd3`
If the node already exists, value of `const result`: `undefined`. In this case nothing is set in the database and the  node remains as it was.
*/
```

If neither `$id` nor `$alias` is provided but `type` is provided, a completely new node is created and and ID is generated for it.

```javascript
const result = await client.set({
  $operation: 'create',
  type: 'match',
  title: {
    en: 'hello',
  },
})

/*
Value of `const result`: ma<random string> such as `maASxsd3`
Resulting  node in database:
{
  id: 'maASxsd3',
  type: 'match',
  title: {
    en: 'hello'
  }
}
*/
```

#### Update

_Update mode_ is the opposite of _create_, in that it fails if the node being updated does not exist.

```javascript
let result = await client.set({
  $operation: 'create',
  type: 'match',
  title: {
    en: 'hello',
  },
})

/*
Value of `const result`: `undefined`
Node in the database remains untouched because we haven't provided an ID or alias.
*/

result = await client.set({
  $operation: 'create',
  $id: 'maASxsd3',
  title: {
    en: 'hello',
  },
})

/*
If the node exists, value of `const result`: `maASxsd3`, and the fields are set.
If the node does not exist, value of `const result`: `undefined`. In this case nothing is set in the database and the node remains as it was.
*/
```

## Field type specific operators

### Basic operators

These operators can be applied to any field type. The syntax and explanation follows.

#### `$default` : _any_

Only sets a value if it isn't already set.

```js
client.set({
  $id: 'maASxsd3',
  username: { $default: 'giovanni' },
})
```

#### `$delete` : _boolean_

This unsets the node's field.

```js
client.set({
  $id: 'maASxsd3',
  username: { $delete: true },
})
// This will delete the 'username' field.
```


### `set` and `references` type field operators

You can add and remove elements to _set_ and _references_ fields using the `$add` and `$delete` operators.
These operators can take a single value or an array of values.

#### `$add`: _any | [any, any, ...]_

The `$add` operator can be used to add one or more entries to a _set_ or _references_ type field. A single item type value or an array of item type values may be specified to `$add`. All the existing values in the set will remain, but no duplicates are allowed.

> :exclamation: **Please note:** Whenever a new node is created, if no parent is specified, it is implicitely set as a child of `root`. This is to avoid orphan nodes in the database. If you wish for new nodes _not_ to be children of `root`, you can simply specify `parents : ['parentId1', 'parentId2', ...]` without using the `$add` operator. **_Only use the `$add` operator to add extra references to a list_**.

```js
/*
Let's assume the following node in database, where availableSeats is of type 'set':
{
  id: 'maASxsd3',
  type: 'match',
  availableSeats: ['a2', 'a3', 'b5']
}
*/

let result = await client.set({
  id: 'maASxsd3',
  availableSeats: { $add: 'b12' },
})

/*
Value of `const result`: `maASxsd3`
Resulting node in database:
{
  id: 'maASxsd3',
  type: 'match',
  availableSeats: ['a2', 'a3', 'b5', 'b12']
}
*/

result = await client.set({
  id: 'maASxsd3',
  availableSeats: { $add: ['b13', 'b14'] },
})

/*
Value of `const result`: `maASxsd3`
Resulting node in database:
{
  id: 'maASxsd3',
  type: 'match',
  availableSeats: ['a2', 'a3', 'b5', 'b12', 'b13', 'b14']
}
*/
```

#### `$delete`: _any | [any, any, ...]_

This operator is the opposite of the `$add` operator, and takes the same arguments.

```js
/*
Let's assume the following node in database:
{
  id: 'maASxsd3',
  type: 'match',
  availableSeats: ['a2', 'a3', 'b5', 'b12', 'b13', 'b14']
}
*/

let result = await client.set({
  id: 'maASxsd3',
  availableSeats: { $delete: ['b13', 'b14'] },
})

/*
Value of `const result`: `maASxsd3`
Resulting node in database:
{
  id: 'maASxsd3',
  type: 'match',
  availableSeats: ['a2', 'a3', 'b5', 'b12']
}
*/

result = await client.set({
  id: 'maASxsd3',
  availableSeats: { $delete: 'b12' },
})

/*
Value of `const result`: `maASxsd3`
Resulting node in database:
{
  id: 'maASxsd3',
  type: 'match',
  availableSeats: ['a2', 'a3', 'b5']
}
*/
```

### `object` and `record` type field operators

The only operation for `objects` and `records` is the merge operation, which allows to either overwrite the whole structure, or merge it. See below.

#### `$merge`: _boolean_

Default value: `true`

The `$merge` option operates exactly the same way as the top-level set [`$merge` operator](#merge-boolean), but in the context of the fields of the object type. When an object is set with `$merge: false`, only the set fields will remain in the database.

```js
/*
Let's assume the following node in database:
{
  id: 'maASxsd3',
  type: 'match',
  details: {
    league: 'serie-a',
    location: 'rome'
  }
}
*/

let result = await client.set({
  id: 'maASxsd3',
  details: {
    $merge: true, //optional, defaults to true
    league: 'serie-b',
  },
})

/*
Value of `const result`: `maASxsd3`
Resulting node in database:
{
  id: 'maASxsd3',
  type: 'match',
  details: {
    league: 'serie-b',
    location: 'rome'
  }
}
*/

let result = await client.set({
  id: 'maASxsd3',
  details: {
    $merge: false,
    league: 'serie-b',
  },
})

/*
Value of `const result`: `maASxsd3`
Resulting node in database:
{
  id: 'maASxsd3',
  type: 'match',
  details: {
    league: 'serie-b',
  }
}
*/
```
