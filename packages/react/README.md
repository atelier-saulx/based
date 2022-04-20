# @based/react

React hooks for the based data platform

> [Example react project here](https://github.com/atelier-saulx/based-react-sample)

> Read more about [based](https://github.com/atelier-saulx/based/blob/main/packages/client/README.md)

---

```js
import based from "@based/client"
import { Provider, useData, useClient } from "@based/react"
import React from "react"
import ReactDom from "react-dom"

const client = based({ env: "prod", project: "someproject", org: "a-org" })

const Things = () => {
  const client = useClient()

  // automatically observes data when components get rendered
  const { data, loading, error } = useData({
    things: {
      id: true,
      name: true,
      $list: true,
    },
  })

  if (loading) {
    return <div>loading...</div>
  }

  return (
    <div>
      {data.things.map((thing) => (
        <div
          key={thing.id}
          onClick={(e) => {
            client.set({ $id: thing.id, name: "Some random name!" })
          }}
        >
          {thing.name}
        </div>
      ))}
    </div>
  )
}

const App = () => {
  return (
    <Provider client={client}>
      <Things />
    </Provider>
  )
}

ReactDom.render(<App />, document.body)
```


---

## License

Licensed under the MIT License.

See [LICENSE](./LICENSE) for more information.
