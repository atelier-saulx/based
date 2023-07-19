# GraphQL support

The Based database uses its own query language, but we also support writing your queries using GraphQL.
GraphQL queries are transparently transpiled to Based own query language, but if this is your language of choice, feel free to use it.

In [Based Client](https://github.com/atelier-saulx/based/blob/main/packages/client/README.md), use `client.graphql.query()` instead of `client.get()` and `client.graphql.live()` instead of `client.observe()`.

### Usage example

Based Query:

```javascript
{
  $id: 'root',
  descendants: {
    $all: true,
    $list: {
      $find: {
        $sort: { $field: 'createdAt', $order: 'asc' },
      },
      $filter: {
        $field: 'type',
        $operator: '=',
        $value: 'todo'
      }
    }
  }
}
```

GraphQL:

```graphql
query {
  root {
    descendants(sortBy: { field: "createdAt", order: ASC }) {
      ... on Todo {
        _all
      }
    }
  }
}
```

## GraphQL playground

The Based Admin Panel has a GraphQL playground tool that allows you to test your queries against the data in the database.
Simply add and change your GraphQL query on the left pane and check the response on the right pane.

<!-- based-docs-remove-start -->

## License

Licensed under the MIT License.

See [LICENSE](./LICENSE) for more information.

<!-- based-docs-remove-end -->
