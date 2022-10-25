module.exports = async (payload, update) => {
  let cnt = 0
  const counter = setInterval(() => {
    update('UpdatedFn' + ++cnt)
  }, 100)
  return () => {
    clearInterval(counter)
  }
}
