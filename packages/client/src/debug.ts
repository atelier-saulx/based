export default (msg: any, type: 'incoming' | 'outgoing') => {
  const t = new Date()
  const now =
    t.getHours() +
    ':' +
    t.getMinutes() +
    ':' +
    t.getSeconds() +
    ':' +
    t.getMilliseconds()

  if (type === 'incoming') {
    const str = `▼   ${now}   -- `
    console.info(str, msg)
  } else {
    const str = `▲   ${now}   -- `
    console.info(str, msg)
  }
}
