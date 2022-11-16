const { wait } = require('@saulx/utils')

module.exports = async (payload) => {
  await wait(100)
  if (payload) {
    return payload
  }
  return 'flap'
}
