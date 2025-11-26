// Deflate for each context
// BROWSER
// BASED_DB
// NODE

// See if based db native (v1) is available - faster native methods
const isBrowser = typeof window !== 'undefined'

const basedNative = !isBrowser ? global.__basedDb__native__ : null

if (isBrowser) {
} else if (!basedNative) {
  // or import() whatever
  //   const zlib = require('node:zlib')
  // derp derp
} else {
  // use based native
}

// does nothing yet
