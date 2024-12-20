#Based-db

## Install

**Prerequisites:**

- recent GNU make
- gcc with recent enough C23 support
- zig 0.13.0
- npm & node.js, v20.11.1 or newer

```
npm i
npm run get-napi // only need this the first time
npm run build
```

## Running tests

Run all tests + ldb + build c, zig and js
`npm run test`

Run specific test file - does substring matching
`npm run test -- range.js`

Run specific test file & run specific test
`npm run test -- range.js:range`

Different flavours of test

Only builds zig
`npm run test-zig`

Builds nothing only runs tests
`npm run test-fast`

## Getting started

```ts
const db = new BasedDb({
  path: '/persistent-file-path',
})
```
