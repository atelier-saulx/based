const { observe } = require('@based/server/worker')

module.exports = async (payload, update) => {
  return observe(
    payload === 'json' ? 'objectCounter' : 'counter',
    payload,
    {},
    update
  )
}
