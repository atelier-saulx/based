const { wait } = require('@saulx/utils')

module.exports = async () => {
  await wait(3e3)
  return 'hello'
}
