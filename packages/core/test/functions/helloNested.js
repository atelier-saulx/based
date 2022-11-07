const { runFunction } = require('@based/server/worker')

// based-db-query
// based-db-set
// based-db-updateSchema
// based-file-upload

module.exports = async (payload, context) => {
  const x = await runFunction('hello', payload, context)
  return x
}
