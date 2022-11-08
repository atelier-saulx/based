const { readStream } = require('@saulx/utils')

// todo run this in a worker
module.exports = async ({ stream }) => {
  // console.log('hello')

  const buf = await readStream(stream)
  console.info('is end...', buf.byteLength)
  // console.info('END', JSON.parse(buf.toString()))
  return 'bla'
}
