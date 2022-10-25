module.exports = async (payload, update) => {
  let cnt = 0
  const counter = setInterval(() => {
    update('counter2:' + ++cnt)
  }, 100)
  return () => {
    clearInterval(counter)
  }
}
