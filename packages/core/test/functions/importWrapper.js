module.exports = (name, type, path) => {
  const fn = require(path)
  return fn.default || fn
}
