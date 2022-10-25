const { readStream } = require('@saulx/utils')

module.exports = async ({ stream }) => {
  const buf = await readStream(stream)
  JSON.parse(buf.toString())
  return 'bla'
}
