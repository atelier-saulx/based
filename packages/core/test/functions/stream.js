const { readStream } = require('@saulx/utils')

// todo run this in a worker
module.exports = async ({ stream }) => {
  const buf = await readStream(stream)
  console.info('is end...', buf.byteLength)
  return 'bla'
}
