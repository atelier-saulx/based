data-record
===========

Record type for Node.js.

```js
// A record definition
const def = [
    { name: 'value1', type: 'uint32_le' },
    { name: 'value2', type: 'int32_be' },
    { name: 'custom1', type: 'int_le', size: 3 },
    { name: 'custom2', type: 'int_le', size: 5 },
    { name: 'nested', type: 'record', def: [
        { name: 'a', type: 'uint32_le' },
        { name: 'b', type: 'uint32_le' }
    ]},
    { name: 'x', type: 'record', def: [
        { name: 'a', type: 'uint32_le' },
        { name: 'y', type: 'record', def: [
            { name: 'a', type: 'uint32_le' },
        ]}
    ]},
    { name: 'firstName', type: 'string', size: 15 },
]
const compiled = compile(def);
```

**Functions**

```js
compile(recordDef)
allocRecord(compiledDef)
serialize(compiledDef, buf, obj)
deserialize(compiledDef, buf)
createRecord(compiledDef, obj)
readValue(compiledDef, buf, path)
readString(compiledDef, buf, path, encoding)
writeValue(compiledDef, buf, path, value)
writeString(compiledDef, buf, path, value, encoding)
createReader(compiledDef, buf, path)
createWriter(compiledDef, buf, path)
```


**Scripts**

- `yarn test` - run tests
- `yarn perf` - run a perf test


```
$ yarn perf
nativeObjectTest: 1.322862 ms
nativeV8SerializerTest: 12681.731264 ms
jsonTest: 264.924124 ms
dataRecordTestSlow: 50.892434 ms
dataRecordTestFast: 3.34631 ms
buf.length = 32, objSerialized.length = 61
```

Examples
--------

```js
const recordDefEx = [
    { name: 'a', type: 'uint32_le' },
    { name: 'b', type: 'int32_le' },
    { name: 'c', type: 'int_le', size: 3 },
    { name: 'd', type: 'int_le', size: 5 },
    { name: 'nested', type: 'record', def: [
        { name: 'a', type: 'uint32_le' },
        { name: 'b', type: 'uint32_le' }
    ]},
    { name: 'x', type: 'record', def: [
        { name: 'a', type: 'uint32_le' },
        { name: 'y', type: 'record', def: [
            { name: 'a', type: 'uint32_le' },
        ]}
    ]},
];

const obj = {
    a: 4,
    b: -128,
    c: 10,
    d: 5,
    nested: {
        a: 5,
        b: 5,
    },
    x: {
        a: 5,
        y: {
            a: 5
        }
    }
};

const compiled = compile(recordDefEx);
const buf = createRecord(compiled, obj);
const objSerialized = v8.serialize(obj);
const jsonStr = JSON.stringify(obj);

console.log(`buf.length = ${buf.length}, objSerialized.length = ${objSerialized.length}, jsonStr.length = ${jsonStr.length}`);
// buf.length = 32, objSerialized.length = 69, JSON.length = 76
```

Performance Testing
-------------------

The performance tests are located under the `__perf__` directory and can be executed with `yarn perf`.

Each run will create a isolate file that can be parsed as follows:

```
node --prof-process isolate-0x5ecbef0-130826-v8.log > processed.txt
```
