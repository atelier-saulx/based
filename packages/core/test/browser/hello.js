const utils = require('@saulx/utils')

module.exports = async (payload) => {
  if (payload === undefined) {
    return 'hello'
  }

  console.info('worker incoming payload:', payload.length / 1024 / 1024)
  await utils.wait(Math.random() * 3e3 + 1e3)
  return 'ha! ' + payload.length
}
