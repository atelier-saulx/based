# data-record

Record type for Node.js.

## Record Format

A record is consist of an array of field definitions, describing a physical data
structure in memory that can be mapped to a `struct` type in C or C++.

The following array defines a simple fixed size record with some nested records.

```js
// A record definition
const def = [
  { name: 'value1', type: 'uint32_le' },
  { name: 'value2', type: 'int32_be' },
  { name: 'custom1', type: 'int_le', size: 3 },
  { name: 'custom2', type: 'int_le', size: 5 },
  {
    name: 'nested',
    type: 'record',
    def: [
      { name: 'a', type: 'uint32_le' },
      { name: 'b', type: 'uint32_le' },
    ],
  },
  {
    name: 'x',
    type: 'record',
    def: [
      { name: 'a', type: 'uint32_le' },
      { name: 'y', type: 'record', def: [{ name: 'a', type: 'uint32_le' }] },
    ],
  },
  { name: 'firstName', type: 'cstring', size: 15 },
]
const compiled = compile(def)
```

The compilation result contains the same information as the original definition
but in an optimized data structure that can be accessed more efficiently than the
human-readable record definition object.

**Types**

| Type          | Description                                                                             |
| ------------- | --------------------------------------------------------------------------------------- |
| `int8`        | 8-bit signed integer                                                                    |
| `int16`       | 16-bit signed integer in host byte order                                                |
| `int16_be`    | 16-bit signed integer in big-endian order                                               |
| `int16_le`    | 16-bit signed integer in little-endian order                                            |
| `int32`       | 32-bit signed integer in host byte order                                                |
| `int32_be`    | 32-bit signed integer in big-endian order                                               |
| `int32_le`    | 32-bit signed integer in little-endian order                                            |
| `int64`       | 64-bit signed integer in host byte order                                                |
| `int64_be`    | 64-bit signed integer in big-endian order                                               |
| `int64_le`    | 64-bit signed integer in little-endian order                                            |
| `uint8`       | 8-bit unsigned integer                                                                  |
| `uint16`      | 16-bit unsigned integer in host byte order                                              |
| `uint16_be`   | 16-bit unsigned integer in big-endian order                                             |
| `uint16_le`   | 16-bit unsigned integer in little-endian order                                          |
| `uint32`      | 32-bit unsigned integer in host byte order                                              |
| `uint32_be`   | 32-bit unsigned integer in big-endian order                                             |
| `uint32_le`   | 32-bit unsigned integer in little-endian order                                          |
| `uint64`      | 64-bit unsigned integer in host byte order                                              |
| `uint64_be`   | 64-bit unsigned integer in big-endian order                                             |
| `uint64_le`   | 64-bit unsigned integer in little-endian order                                          |
| `float`       | 32-bit single-precision floating-point in host byte order                               |
| `float_be`    | 32-bit single-precision floating-point in big-endian order                              |
| `float_le`    | 32-bit single-precision floating-point in little-endian order                           |
| `double`      | 64-bit double-precision floating-point in host byte order                               |
| `double_be`   | 64-bit double-precision floating-point in big-endian order                              |
| `double_le`   | 64-bit double-precision floating-point in little-endian order                           |
| `int_be`      | 0 to 48 bit variable size big-endian signed integer                                     |
| `int_le`      | 0 to 48 bit variable size little-endian signed integer                                  |
| `uint_be`     | 0 to 48 bit variable size big-endian unsigned integer                                   |
| `uint_le`     | 0 to 48 bit variable size little-endian unsigned integer                                |
| `cstring`     | null-terminated C-string (termination not enforced, same behavior as `strcpy()`)        |
| `record`      | A nested record                                                                         |
| `record_p`    | A pointer to an array of records                                                        |
| `int8_p`      | A pointer to an array of 8-bit signed integers                                          |
| `int16_p`     | A pointer to an array of 16-bit signed integers in host byte order                      |
| `int16_be_p`  | A pointer to an array of 16-bit signed integers in big-endian order                     |
| `int16_le_p`  | A pointer to an array of 16-bit signed integers in little-endian order                  |
| `int32_p`     | A pointer to an array of 32-bit signed integers in host byte order                      |
| `int32_be_p`  | A pointer to an array of 32-bit signed integers in big-endian order                     |
| `int32_le_p`  | A pointer to an array of 32-bit signed integers in little-endian order                  |
| `int64_p`     | A pointer to an array of 64-bit signed integers in host byte order                      |
| `int64_be_p`  | A pointer to an array of 64-bit signed integers in big-endian order                     |
| `int64_le_p`  | A pointer to an array of 64-bit signed integers in little-endian order                  |
| `uint8_p`     | A pointer to an array of 8-bit unsigned integers                                        |
| `uint16_p`    | A pointer to an array of 16-bit unsigned integers in host byte order                    |
| `uint16_be_p` | A pointer to an array of 16-bit unsigned integers in big-endian order                   |
| `uint16_le_p` | A pointer to an array of 16-bit unsigned integers in little-endian order                |
| `uint32_p`    | A pointer to an array of 32-bit unsigned integers in host byte order                    |
| `uint32_be_p` | A pointer to an array of 32-bit unsigned integers in big-endian order                   |
| `uint32_le_p` | A pointer to an array of 32-bit unsigned integers in little-endian order                |
| `uint64_p`    | A pointer to an array of 64-bit unsigned integers in host byte order                    |
| `uint64_be_p` | A pointer to an array of 64-bit unsigned integers in big-endian order                   |
| `uint64_le_p` | A pointer to an array of 64-bit unsigned integers in little-endian order                |
| `float_p`     | A pointer to an array of 32-bit single-precision floating-points in host byte order     |
| `float_be_p`  | A pointer to an array of 32-bit single-precision floating-points in big-endian order    |
| `float_le_p`  | A pointer to an array of 32-bit single-precision floating-points in little-endian order |
| `double_p`    | A pointer to an array of 64-bit double-precision floating-points in host byte order     |
| `double_be_p` | A pointer to an array of 64-bit double-precision floating-points in big-endian order    |
| `double_le_p` | A pointer to an array of 64-bit double-precision floating-points in little-endian order |
| `cstring_p`   | A pointer to a C-string                                                                 |

**Arrays**

Any type can be used to create an array but there is a caveat, all the items
inside an must have the same fixed size. The size can be implicit from the type
or a variable size given in the field definition (`int_be`, `int_le`, `uint_be`,
`cstring`, and `record`).

The array notation is as follows:

```js
// TYPE[SIZE]
{ name: 'intArr', type: 'int8[80]' }
```

**Pointers**

Pointer types can point to variable size data (at runtime) without need to
recompile the record definition. This is different from variable size field
types (`int_be`, `int_le`, `uint_be`, `uint_l`, `cstring`) as the size of those
fields is locked in compilation (fixed size array) and have a fixed position in
the data structure. Pointer types are marked with a `_p` suffix in the type name.

For example a `cstring_p` pointer can point to the string `"Hello"` during one
serialization call and to the string `"world!!"` on the next call. The string is
copied into the dynamic heap section of the resulting buffer which is reserved
for storing variable sized payloads.

### Data Structure

In the following examples the data structure is represented in 32bit big-endian
format, but all common architectures are supported 32-bit BE/LE, 64-bit BE/LE,
or even mixed endianness is possible.

The `serialize()` function returns a `Buffer` object that contains a
record structure and a heap sections. The heap is only populated if the record
contains pointers to the data in heap.

The following example shows a record definition, what is stored in the buffer,
and a matching C struct.

```json
[
  { "name": "sport", "type": "uint16_be" },
  { "name": "dport", "type": "uint16_be" },
  { "name": "seqno", "type": "uint32_be" },
  { "name": "ackno", "type": "uint32_be" },
  { "name": "options", "type": "uint_be", "size": 3 },
  { "name": "data", "type": "cstring_p" }
]
```

```
    0                   1                   2                   3
    0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+ RECORD
   |             .sport            |              .dport           |
   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
   |                            .seqno                             |
   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
   |                            .ackno                             |
   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
   |                   .options                    |    PADDING    |
   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
   |                            .data_offset                       |
   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
   |                            .data_size                         |
   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+ HEAP
   |                             DATA                              |
   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

Here `data` is inside the heap area.

```c
struct frame {
	uint16_t sport;
	uint16_t dport;
	uint32_t seqno;
	uint32_t ackno;
	struct {
		unsigned int options : 24;
	};
	char * data;
	size_t data_len;
};
```

## API

**Functions**

```js
compile(recordDef[, { align: true }])
allocRecord(compiledDef[, { unpool, heapSize }])
calcHeapSize(compiledDef, obj)
createRecord(compiledDef, obj)
generateRecordDef(obj)
generateCHeader(compiledDef)
serialize(compiledDef, buf, obj)
deserialize(compiledDef, buf)
readValue(compiledDef, buf, path)
readString(compiledDef, buf, path[, encoding])
writeValue(compiledDef, buf, path, value)
writeString(compiledDef, buf, path, value[, encoding])
createReader(compiledDef, buf, path)
createStringReader(compiledDef, buf, path[, encoding])
createWriter(compiledDef, buf, path)
```

`generateRecordDef()` makes a best effort guess on how an object could be
serialized. Strings will be serialized to the size they were seen in the
example object, and numbers will be stored using the same endianness as the
host architecture is currently using.

### Record alignment

By default `compile()` aligns the resulting data for optimal access in C.
If `align` is set true for `compile()` then the resulting buffers will be
aligned to the expected C struct alignment on the underlying architecture.
if `align` is false, then the resulting data is packed as compact as
possible. `generateCHeader()` does not support unaligned mode.

However, currently subrecords/nested records are not aligned as C structures
even if `align` is set. Therefore, if nested records and especially record
arrays will be accessed in C care should be taking to ensure that all the
records are aligned to word size. This was a common manual task in
pre-ANSI C world.

Typically in C this manual alignment would look something like
(assuming 32bit little-endian):

```c
struct x {
	struct {
		int16_t value;
		int16_t _spare;
	} a;
	uint32_t flags;
};
```

With the definition language here we can do the following:

```json
[
  {
    "name": "x",
    "type": "record",
    "def": [
      { "name": "value", "type": "int16_le" },
      { "name": "_spare", "type": "int16_le" }
    ]
  },
  { "name": "flags", "type": "uint32_le" }
]
```

This is the exact bitwise equivalent of the former C struct.

### Dynamic Typing with C

It's also possible to use more dynamically built records with C by passing the
compiled record definition to the C program as a buffer and resolving the fields
at runtime.

```js
> import { compile, compRecordDef2buffer } from './dist/src/index.js'
> const def = dr.compile([ { name: 'haha', type: 'int16_le' }, { name: 'hehe', type: 'uint8'}])
> const buf = compRecordDef2buffer(def)
```

The function `compRecordDef2buffer()` will return a buffer that can be read in C
as:

```c
struct data_record_def {
    struct data_record_def_field_type {
        uint32_t offset;
        uint32_t size;
        uint32_t arr_size;
        char type[2];
        char name[50];
    } field_list[0];
};
```

## Scripts

- `yarn build` - run TS build
- `yarn lint` - run ESlint
- `yarn prettier` - run Prettier
- `yarn test` - run tests
- `yarn perf` - run a perf test

## Examples

```js
const recordDefEx = [
  { name: 'a', type: 'uint32_le' },
  { name: 'b', type: 'int32_le' },
  { name: 'c', type: 'int_le', size: 3 },
  { name: 'd', type: 'int_le', size: 5 },
  {
    name: 'nested',
    type: 'record',
    def: [
      { name: 'a', type: 'uint32_le' },
      { name: 'b', type: 'uint32_le' },
    ],
  },
  {
    name: 'x',
    type: 'record',
    def: [
      { name: 'a', type: 'uint32_le' },
      { name: 'y', type: 'record', def: [{ name: 'a', type: 'uint32_le' }] },
    ],
  },
]

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
      a: 5,
    },
  },
}

const compiled = compile(recordDefEx)
const buf = createRecord(compiled, obj)
const objSerialized = v8.serialize(obj)
const jsonStr = JSON.stringify(obj)

console.log(
  `buf.length = ${buf.length}, objSerialized.length = ${objSerialized.length}, jsonStr.length = ${jsonStr.length}`
)
// buf.length = 32, objSerialized.length = 69, JSON.length = 76
```

## Performance Testing

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

The performance tests are located under the `__perf__` directory and can be executed with `yarn perf`.
The test modules can be run individually by giving one or more module names as an argument to the
comman, e.g. `yarn perf serialization`.

Each run will create a isolate file that can be parsed as follows:

```
node --prof-process isolate-0x5ecbef0-130826-v8.log > processed.txt
```
