const { runFunction, get, observe } = require('@based/server')

module.exports = async (payload, context) => {
  if (payload) {
    return payload.length
  }

  const x = await runFunction('hello', payload, context)

  console.info(x)

  return 'flap'
}
