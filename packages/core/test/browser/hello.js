const utils = require('@saulx/utils')

module.exports = async (payload) => {
  console.info('????', payload)
  if (payload === undefined) {
    return 'hello'
  }

  if (typeof payload === 'object') {
    return payload
  }

  console.info('worker incoming payload:', payload.length / 1024 / 1024)
  await utils.wait(Math.random() * 3e3 + 1e3)
  return 'ha! ' + payload.length
}
