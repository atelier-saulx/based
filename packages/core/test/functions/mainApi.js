const { requestFromMain } = require('@based/edge-server/worker')

module.exports = async (payload) => {
  return requestFromMain('hello', payload)
}
