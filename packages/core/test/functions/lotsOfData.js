module.exports = async () => {
  let str = ''
  for (let i = 0; i < 200000; i++) {
    str += ' big string ' + ~~(Math.random() * 1000) + 'snur ' + i
  }
  return str
}
