data-record
===========

Record for Node.js.

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
