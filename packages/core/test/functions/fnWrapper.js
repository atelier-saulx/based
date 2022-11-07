exports.runFunction = async (name, fn, payload, context) => {
  console.info('--> Call wrapped function', name)
  return fn(payload, context)
}
