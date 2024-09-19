// this file is just here for cjs support for node.js
const lib = require('./src/index.js')

// this makes it that you don't have to do:
// `const based = require('@based/client').default`
// but can do:
// `const based = require('@based/client')`
module.exports = Object.assign(lib.default, lib)
