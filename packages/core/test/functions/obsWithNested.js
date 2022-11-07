const { observe } = require('@based/server/worker')

module.exports = async (payload, update) => {
  console.info(payload, payload === 'json')
  return observe(
    payload === 'json' ? 'objectCounter' : 'counter',
    payload,
    {},
    update
  )
}
