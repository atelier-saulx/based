import { crc32c } from '../crc32c'

const data = 'oid123'
const buffer = new TextEncoder().encode(data)
const checksum = crc32c(buffer)

console.log(`CRC32C for "${data}": ${checksum}`)
