module.exports = async (payload, update) => {
  const largeThing = { bla: [] }
  for (let i = 0; i < 1e5; i++) {
    largeThing.bla.push({
      title: 'snurp',
      cnt: i,
      snurp: ~~(Math.random() * 19999),
    })
  }
  update(largeThing)
  const counter = setInterval(() => {
    largeThing.bla[~~(Math.random() * largeThing.bla.length - 1)].snup = ~~(
      Math.random() * 19999
    )
    // diff is made on an extra cache layer
    update(largeThing)
  }, 1)
  return () => {
    clearInterval(counter)
  }
}
