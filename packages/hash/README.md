# hash

Fast, low collision hashing based on djb2

## hash

Returns a 64 bit number, works for any data type

```javascript
import { hash } from '@based/hash'
hash({ x: true })
hash([1, 2, 3])
hash('xyz')
```

## hashObjectIgnoreKeyOrder

Returns a 64 bit number, works for objects and arrays - ignores order of keys in objects

```javascript
import { hashObjectIgnoreKeyOrder } from '@based/hash'
console.log(
  hashObjectIgnoreKeyOrder({ x: true, y: true }) ===
    hashObjectIgnoreKeyOrder({ y: true, x: true }),
)
```

## hashCompact

Same as hash but returns a 62 bit string

```javascript
import { hashCompact } from '@based/hash'

console.log(hashCompact({ x: true, y: true }))
```
