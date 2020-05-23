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
    { name: 'firstName', type: 'cstring', size: 15 },
]
const compiled = compile(def);
```

**Types**

- `int8`
- `int16_be`
- `int16_le`
- `int32_be`
- `int32_le`
- `int64_be`
- `int64_le`
- `uint8`
- `uint16_be`
- `uint16_le`
- `uint32_be`
- `uint32_le`
- `uint64_be`
- `uint64_le`
- `float_be`
- `float_le`
- `double_be`
- `double_le`
- `int_be` - 0 to 48 bit variable size big endian signed integer
- `int_le` - 0 to 48 bit variable size little endian signed integer
- `uint_be` - 0 to 48 bit variable size big endian unsigned integer
- `uint_le` - 0 to 48 bit variable size little endian unsigned integer
- `cstring` - null-terminated C-string (termination not enforced, same behavior as `strcpy()`)
- `record` - defines a nested record

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
$ node --prof ./node_modules/.bin/ts-node __perf__/perf.ts
modify
======
nativeObjectTest                                1.21 ms
nativeV8SerializerTest                      18544.97 ms
jsonTest                                      171.72 ms
dataRecordTestSlow                             55.11 ms
dataRecordTestFast                              5.60 ms

serialization
=============
./data/simple.json
nativeV8SerializerTest                      10953.32 ms
jsonTest                                      489.59 ms
dataRecordSerializeTest                       370.34 ms

./data/nesting.json
nativeV8SerializerTest                       5362.70 ms
jsonTest                                     2724.44 ms
dataRecordSerializeTest                      2800.08 ms

./data/mega-flat.json
nativeV8SerializerTest                      10268.37 ms
jsonTest                                    20080.70 ms
dataRecordSerializeTest                      6110.32 ms

./data/numbers.json
nativeV8SerializerTest                       5280.86 ms
jsonTest                                     7111.44 ms
dataRecordSerializeTest                       769.95 ms
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
