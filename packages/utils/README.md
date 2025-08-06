# utils

Saulx utils package

## deepEqual

Compare objects

```javascript
import { stringHash } from '@based/utils'
console.log(deepEqual({ a: { b: true } }, { a: { b: true } })) // true
```

## deepCopy

Create a deepcopy of objects

```javascript
import { deepCopy } from '@based/utils'
console.log(deepCopy({ x: true }))
```

## deepMerge

Merge an object into another object, arrays are treated as new values

```javascript
import { deepMerge } from '@based/utils'

const a = { x: { a: { c: true, x: [1, 2] } } }
const b = { y: true }
const c = { x: { a: { b: true, x: ['bla'] } } }

console.log(deepMerge(a, b))

console.log(deepMerge(a, b, c))

/*
 Logs
 {
	 x: { a: { b: true, c: true, x: ['bla']}},
	 y: true
 }
*/
```

## deepMergeArrays

Merge an object into another object, arrays are treated as objects

```javascript
import { deepMergeArrays } from '@based/utils'
const a = { x: { a: { c: true, x: [1, 2, 3] } } }
const b = { y: true }
const c = { x: { a: { b: true, x: ['bla'] } } }

console.log(deepMergeArrays(a, b))

console.log(deepMergeArrays(a, b, c))

/*
 Logs
 {
	 x: { a: { b: true, c: true, x: ['bla', 2, 3]}},
	 y: true
 }
*/
```

## isObject

Checks if a variable is an object and not an array

```javascript
import { isObject } from '@based/utils'
console.log(isObject({ x: true })) // true
console.log(isObject([1, 2, 3])) // false
```

## wait

Timeout in a promise, default is 100ms

```javascript
import { wait } from '@based/utils'

const somethingAsync = async () => {
  await wait() // 100ms
  console.log('after 100ms')
  await wait(1000)
  console.log('after 1100ms')
}

somethingAsync()
```

## serializeQuery

Convert an object to a query string

```javascript
import { serializeQuery } from '@based/utils'
const object = { bla: true, a: [1, 2, 3], b: { a: 1 }, c: ['a', 'b', 'c'] }
const queryString = serializeQuery(object)
console.log(queryString) // bla&a=[1,2,3]&b={"a":1}&c=a,b,c
```

## parseQuery

Convert a query string to an object

```javascript
import { parseQuery } from '@based/utils'
const result = parseQuery('bla&a=[1,2,3]&b={"a":1}&c=a,b,c')
console.log(result) // { bla:true, a:[1,2,3], b:{a:1}, c:['a','b','c'] }
```

## readStream

Sink a read stream into a promise

```javascript
import { readStream } from '@based/utils'
import fs from 'fs'

const aReadStream = fs.createReadStream('somefile')
const myResult = await readStream(aReadStream)
```

## toEnvVar

Convert a string to an env-variable safe name

```javascript
import { toEnvVar } from '@based/utils'
const x = toEnvVar('@based/bla-bla-bla$_!')
console.log(x) // BASED_BLA_BLA_BLA
```

## stringToUtf8

Convert a string to a utf-8 Uint8 array

```javascript
import { stringToUtf8 } from '@based/utils'
const utf8 = stringToUtf8('hello')
console.log(utf8) // [ 104, 101, 108, 108, 111 ]
```

## utf8ToString

Convert a utf8 Uint8 array to a string

```javascript
import { utf8ToString } from '@based/utils'
// hello in utf-8
const utf8 = new Uint8Array([104, 101, 108, 108, 111])
const x = utf8ToString(utf8)
console.log(x) // hello
```

## encodeBase64

Convert utf-8 Uint8 array to a base64 string, allows converting 16byte chars.
(vs btoa where its not supported)

```javascript
import { encodeBase64 } from '@based/utils'
// hello in utf-8
const utf8 = new Uint8Array([104, 101, 108, 108, 111])
const b64 = encodeBase64(utf8)
console.log(b64) // aGVsbG8=
```

## decodeBase64

Decode a base64 string to a utf-8 Uint8 array
(vs atob where its not supported)

```javascript
import { decodeBase64 } from '@based/utils'
const utf8 = decodeBase64('aGVsbG8=)
console.log(b64) // [104, 101, 108, 108, 111]
```

## createEncoder

Create an encoder similair to `encodeUri` / `decodeUri` but with specific strings
Will use `[a-z]` and `[0-9]` as encoded variables

```javascript
import { createEncoder } from '@based/utils'
const { encode, decode } = createEncoder(['🥹'], ['@'])
console.log(encode('hello 🥹')) // "hello @a"
```

Can be used with larger strings

```javascript
import { createEncoder } from '@based/utils'
const { encode, decode } = createEncoder(['hello'], ['@'])
console.log(encode('hello 🥹')) // "@a 🥹"
```

## padLeft

Add padding to a string

```javascript
import { padLeft } from '@based/utils'
console.log(padLeft('a', 4, 'b')) // "bbba"
const y = padRight('a', 4, 'b')
t.is(y, 'abbb')
```

## padRight

Add padding to a string

```javascript
import { padLeft } from '@based/utils'
console.log(padRight('a', 4, 'b')) // "abbb"
```

## queued

Pass any async function and queue it based on the arguments, also shares the function execution for the same args

_Accepts 10 arguments maximum_

```javascript
import { queued, wait } from '@based/utils'

const myFn = queued(async (a: string) => {
	await wait(1000)
	return a + '!'
})

// will execute bla first then x
await Promise.all([
	myFn('bla'),
	myFn('x')
	myFn('bla') // bla will be shared
])
```

```javascript
import { queued, wait } from '@based/utils'

const myFn = queued(async (a: string) => {
	await wait(1000)
	return a + '!'
}, {
	dedup: (a) => {
		// choose the value to use for dedup (to share results)
		return a
	},
	concurrency: 10 // max concurrency of 10
})

// will execute all at the same time (scince concurrency is 10)
// will only execute 'bla' once since it has the same arguments used in id
await Promise.all([
	myFn('bla'),
	myFn('x')
	myFn('bla') // bla will be shared
])
```

## getType

Returns a string with the operand/type of the javascrit primitive. Adds 'null' and 'array'.

```javascript
getType('') // -> "string"
getType('this is a string') // -> "string"
getType(123) // -> "number"
getType(12.3) // -> "number"
getType(-12.3) // -> "number"
getType(-123) // -> "number"
getType(BigInt('1')) // -> "bigint"
getType(true) // -> "boolean"
getType(false) // -> "boolean"
getType(undefined) // -> "undefined"
getType({ a: 'wawa' }) // -> "object"
getType(() => {}) // -> "function"
getType([1, 2, 3]) // -> "array"
getType(null) // -> "null"
```

## walker

Generic structure walker. By default walks objects.

```javascript
const result = []
await walk(objectToWalk, async (item, info) => {
  result.push({
    value: item,
    name: info.name, // property name
    path: info.path, // slash separated path in object
    type: info.type, // operand type
  })
}) // returns void
```

By configuring the options you can walk any kind of structure

```javascript
	await walk(
		objectToWalk, // starting target
		itemFn, // function to run for each matched item
		options: {
			// check types for details
			listFn, // function to list each path. Should return a list of items.
			itemMatchFn, // function to choose which items to run itemFn on
			recureseFn, // function to choose wchich items to recurse on
			targetValidationFn, // function to validate starting path
			previousPath, // prefix to add to paths
		}
	)
```

## nonRecursiveWalker

Generic object walker that does not use recursion.

```javascript
const obj = {
  a1: {
    a1b1: {
      a1b1c1: 'a1b1c1',
      a1b1c2: {
        a1b1c2d1: 'a1b1c2d1',
      },
    },
  },
  a2: 'a2',
  a3: {
    a3b1: 'a3b1',
  },
}

nonRecursiveWalker(
  obj, // Object to walk
  (
    target, // reference to matched property
    path, // path as a string[]
    type, // 0 for property, 1 for object
  ) => {
    if (path.join('.') === 'a1.a1b1') {
      console.log('Object found type is 1')
    }
    if (path.join('.') === 'a2') {
      console.log('Property found type is 0')
    }
  },
  true, // also match objects
)
```
