const { observe } = require('@based/server/worker')

module.exports = async (payload, update) => {
  // console.info('start!')
  // let cnt = 0
  // return observe('counter', payload, {}, (d, checksum) => {
  //   console.info('incoming', d, checksum)

  //   update({ cnt: ++cnt, bla: true })
  // })

  return observe('counter', payload, {}, update)
}
