import hashObjectNest from './hashObjectNest.js'

const hashObject = (props: object): number => {
  const x = hashObjectNest(props)
  return (x[0] >>> 0) * 4096 + x[1]
}

export default hashObject
