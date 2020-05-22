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
serialize(buf, compiledDef, obj)
deserialize(buf, compiledDef)
createRecord(compiledDef, obj)
readValue(buf, compiledDef, path)
readString(buf, compiledDef, path, encoding)
writeValue(buf, compiledDef, path, value)
writeString(buf, compiledDef, path, value, encoding)
createReader(buf, compiledDef, path)
createWriter(buf, compiledDef, path)
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
