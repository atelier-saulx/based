import { crc32c } from '../crc32c.js'

const sData = 'oid123'
const nData = new Uint8Array([1, 2, 2, 3, 4, 5, 6])
const checkSData = crc32c(sData)
const checkNData = crc32c(nData)

console.log(`CRC32C for ${sData} : ${checkSData}`)
console.log(`CRC32C for ${nData} : ${checkNData}`)
