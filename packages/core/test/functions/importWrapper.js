module.exports = (name, type, path) => {
  console.info('Custom importWrapper', name, type, path)
  const fn = require(path)
  return fn.default || fn
}
