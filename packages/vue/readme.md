## .subscribe(query, cb, err?)

```
const unsubscribe = await b.subscribe({
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
