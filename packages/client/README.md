# based-client

## 🔗 Links
- [GitHub](https://github.com/atelier-saulx/based#readme)

---

## Description

## .observe(query, cb, err?)

```
const unobserve = await b.observe({
    $id: 'sp1',
    title: true
}, (data) => {

}, (err) => {

})
```

## .get(query)

```
const result = await b.get({
    $id: 'sp1',
    title: true
})
```

## .set(payload)

```
const { id } = await b.set({
    $id: 'sp1',
    title: 'Yes, the best'
})
```

## .delete(payload)

```
const { ids } = await b.delete({
    $id: 'sp1'
})
```

## .copy(payload)

```
const { ids } = await b.copy({
    $id: 'sp1'
})
```

## .call(name, payload)

```
const res = await b.call('email', {
    from: 'x',
    to: 'y'
})
```

# auth

```
try {
  await b.auth(token)

  await b.auth(false)
} catch (e) {

}
```

---

## License

Licensed under the MIT License.

See [LICENSE](./LICENSE) for more information.
