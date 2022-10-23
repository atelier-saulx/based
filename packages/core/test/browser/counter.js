module.exports = async (payload, update) => {
  let cnt = 0
  const interval = setInterval(() => {
    let lotsOfThings = ''
    for (let i = 0; i < 100e3; i++) {
      lotsOfThings += 'hey gap ' + Math.random()
    }
    update({ cnt: ++cnt, lotsOfThings })
  }, 1e3)
  return () => {
    clearInterval(interval)
  }
}
