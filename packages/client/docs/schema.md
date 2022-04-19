# Schema of Based-db

<!-- - [Schema](#schema)
  - [Fields](#fields)
    - [Default](#default-fields)
  - [Field types](#field-types) -->

<!-- The based query language allows you to set, delete and modify objects, subscriptions, and the database schema. The query language uses a format similar to JSON in order to describe the database operation(s) required. -->

## Introduction

The schema defines the properties of the nodes that the Based-DB instance will hold.  
New properties can be added to the schema at any point using the `updateSchema()` method, **however existing properties cannot be removed or modified.**

## Schema object structure

The `configure()` method takes as argument a single object that follows a specific schema structure.
The schema object has three fields:

| Name        | Type            | Attributes | Description                                                                                                                                                   |
| ----------- | --------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types`     | Object          |            | This structure defines the type of nodes the database will hold and what fields they'll have. See [here](#types).                                             |
| `languages` | list of strings | optional   | This specifies which languages are allowed in a `text` field, and the fallback priority in case the requested language is not set. See later for more details |
| `rootType`  | Object          | optional   | This can specify fields for the root object. Useful for example with the `$inherit` operator, to have a default property be inherited by all nodes.           |

#### Example

```js
await client.configure({
  languages: ['en', 'de', 'nl'],
  rootType: {
    fields: {
      value: { type: 'number' },
      nested: {
        type: 'object',
        properties: {
          fun: { type: 'string' },
        },
      },
    },
  },
  types: {
    room: {
      prefix: 'rm',
      fields: {
        name: { type: 'string' },
        createdAt: { type: 'timestamp' },
      },
    },
    items: {
      fields: {
        values: {
          type: 'object',
          properties: {
            item1: { type: 'string' },
          },
        },
      },
    },
  },
})
```

## Types

Whenever describing a new type of node in the schema, two fields can be specified:
| Name | Type | Attributes | description |
| -------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------- |
| `prefix` | string | optional | Two character string that identifies the type. The ID of each node of that type will then start with this prefix. |
| `fields` | Object | | Defines the [fields](#fields) for the type. Each object key is a field name and its value the field difinition. |

### Fields

Each new node type defined in the schema can have multiple fields, each with a specific [type](#types).

Each node type will always have a special field `id`, which contains a unique identifier for the node.
Each field must specify its type. The types allowed are [described here](#types), and they all have special behaviours and properties.

##### Default fields

A few fields are implicitely added to each node type, namely:

- `id`: _string_
- `type`: _string_
- `parents`: _references_
- `children`: _references_
- `ancestors`: _references_
- `descendants`: _references_

All these have special meaning which become apparent when learning about the [get method and queries.](get.md)

### Field types

The **type** of a field defines the data stored in it and the operations that can be applied to it.  
The possible types and their properties are described here:

| Types        | Description and properties                                                                                                                                                                                                                                                                         |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `boolean`    | Holds a `true` or `false` value.                                                                                                                                                                                                                                                                   |
| `float`      | Holds a floating point number.                                                                                                                                                                                                                                                                     |
| `int`        | Holds an integer                                                                                                                                                                                                                                                                                   |
| `number`     | Holds a number. Useful when the input could be either a float or an integer                                                                                                                                                                                                                        |
| `string`     | Holds a string.                                                                                                                                                                                                                                                                                    |
| `text`       | This is a special type that holds a string localized in multiple languages. See [here](TODO) for more details.                                                                                                                                                                                     |
| `digest`     | Holds a hashed version of the string you put in it.                                                                                                                                                                                                                                                |
| `url`        | Holds a url. It checks that input conforms to a url.                                                                                                                                                                                                                                               |
| `email`      | Holds a email. It checks that input conforms to an email.                                                                                                                                                                                                                                          |
| `phone`      | Holds a phone number as a string. It checks that input conforms to a phone number.                                                                                                                                                                                                                 |
| `timestamp`  | Holds a time stamp in milliseconds, following the [Unix epoch format](https://en.wikipedia.org/wiki/Unix_time)                                                                                                                                                                                     |
| `reference`  | Holds a node ID.                                                                                                                                                                                                                                                                                   |
| `references` | Holds an array of node IDs                                                                                                                                                                                                                                                                         |
| `object`     | This type allows for nested structures, and its fields are then indexed, meaning they can then be referenced directly in a query, later.                                                                                                                                                           |
| `record`     | A record works similarly to an Hashmap, as in, the schema specify what type of value the record can take, and if the user tries to set a different one, it throws an error. See later for more examples.                                                                                           |
| `set`        | A mathematical set. Holds a list of **unique** values of a single basic type (meaning it can't hold objects or arrays), specified in the `item` field.                                                                                                                                             |
| `json`       | This can hold anything and formats it to JSON, returning it in the most appropriate type when queried. Unlike the `oject` type, you can't query the fields if you decide to store a structure in it. Equivalent to storing something with `JSON.stringify()` and returning it with `JSON.parse()`. |

Currently Based also has two reserved field names with special properties:

- `createdAt` : _timestamp_
- `updatedAt` : _timestamp_

These are **only available if specifically mentioned in the schema**, and they are automatically populated by the server whenever the node is created or updated, respectively.

### Special fields and types

#### `languages` field in the schema object

When specifying the allowed languages in the [schema object](#schema-object-structure), we also implicitely specify the order on what to fall back if the required language isn't present. For example, if we were to query a text field with

```js
get({ $id: id, $language: 'de', myTextField: true })
```

but the requested object wasn't available in German, following this schema

```js
languages: ['en', 'de', 'nl'],
```

it would then try to return the English version of it and if that were to be missing too, Dutch.

If you want to learn more about the `get` query syntax, head over [here](TODO).

#### `text` type

The text type is a structure that contains for each key the same string localized to a different language. This is used in combination with the `$language` operator when setting or getting a value. See later for more info.

#### `object` type

When setting a field type to `object`, the schema must include another special field called `properties` where the values of the object are specified.

```js
myType: {
{
  // ...
  movie: {
    prefix: 'mo',
    fields: {
      title: { type: 'text' },
      technicalData: {
        type: 'object',
        properties: {
          runtime: { type: 'int' },
          color: { type: 'string' },
          aspectRatio: { type: 'string' }
        }
      }
    }
  }
}
```

#### `set` type

When setting a field type to `set`, the schema must include another special field called `items` where the type of the set is specified.

```js
myType: {
  // ...
  company:{
    prefix: 'na',
    fields: {
      employees: {
        type: 'set',
        items: { type: 'string' }
      },
    }
  }
}
```

#### `record` type

When setting a field type to `record`, the schema must include another special field called `values` where the type of value the record can hold is specified.

```js
myType: {
  // ...
  company:{
    prefix: 'na',
    fields: {
      employees: {
        type: 'record',
        values: { type: 'string' }
      },
    }
  }
}
```

<!--
To add and remove items from the set, the following operators are supported:

- [`$default`](#default---any)
- [`$value`](#value---any)
- [`$ref`](#ref---string)
- [`$add`](#add---any)
- [`$delete`](#delete---any) -->
