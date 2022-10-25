module.exports = async (_payload, update) => {
  let cnt = 0
  const counter = setInterval(() => {
    update(++cnt)
  }, 1000)
  return () => {
    clearInterval(counter)
  }
}
