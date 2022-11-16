module.exports = (payload, update) => {
  setInterval(() => {
    throw new Error('lol')
  }, 10)
  update('yes')
}
