const utils = require('@saulx/utils')

module.exports = async (payload) => {
  if (payload === undefined) {
    return 'hello'
  }

  if (typeof payload === 'object') {
    return payload
  }

  await utils.wait(Math.random() * 3e3 + 1e3)
  return 'ha! ' + payload.length
}
