module.exports = async (payload, update) => {
  let cnt = 0
  const interval = setInterval(() => {
    update({ cnt: ++cnt })
  }, 1e3)
  return () => {
    clearInterval(interval)
  }
}
