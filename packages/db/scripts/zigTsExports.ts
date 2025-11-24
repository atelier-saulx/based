import fs from 'node:fs/promises'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const parseZig = (input: string): string => {
  const lines = input.split('\n')

  let output = `import { 
  writeUint16, writeInt16, 
  writeUint32, writeInt32, 
  writeUint64, writeInt64, 
  writeFloatLE, writeDoubleLE,
  readUint16, readInt16, 
  readUint32, readInt32, 
  readUint64, readInt64, 
  readFloatLE, readDoubleLE
} from '@based/utils'\n\n`

  // Symbol tables
  const typeSizes: Record<string, number> = {
    u8: 1,
    i8: 1,
    bool: 1,
    u16: 2,
    i16: 2,
    u32: 4,
    i32: 4,
    f32: 4,
    u64: 8,
    i64: 8,
    f64: 8,
    usize: 8,
    LangCode: 1,
  }

  const enumBackingTypes: Record<string, string> = {}
  const aliases: Record<string, string> = {}
  const enumValues: Record<string, Record<string, string>> = {}

  // Regex patterns
  const regexConstAlias = /^pub const (\w+) = ([a-zA-Z_][\w]*);/
  const regexEnumStart = /^pub const (\w+)(?:: type)? = enum\((\w+)\) \{/
  const regexConstVal = /^pub const (\w+)(?:: [\w\d]+)?\s*=\s*([^;]+);/
  const regexStructStart = /^pub const (\w+) = (packed )?struct \{/
  const regexField = /^\s*([\w@"]+)\s*=\s*(.+?)(?:,|;)?$/
  const regexStructField = /^\s*(\w+):\s*([\w\.]+),/

  let currentBlock: 'NONE' | 'ENUM' | 'STRUCT' = 'NONE'
  let currentName = ''
  let currentBuffer: string[] = []
  let currentBackingType = 'u8'
  let currentEnumHasWildcard = false
  let currentStructIsPacked = false

  const toTsType = (zigType: string): string => {
    if (
      ['u8', 'i8', 'u16', 'i16', 'u32', 'i32', 'f32', 'f64', 'usize'].includes(
        zigType,
      )
    )
      return 'number'
    if (['bool'].includes(zigType)) return 'boolean'
    if (aliases[zigType]) return toTsType(aliases[zigType])
    if (typeSizes[zigType])
      return zigType.endsWith('Enum') ? zigType : zigType + 'Enum'
    if (/^u\d+$/.test(zigType)) return 'number'
    return 'number'
  }

  const getPrimitive = (type: string): string => {
    let t = type
    let depth = 0
    while (aliases[t] && depth < 10) {
      t = aliases[t]
      depth++
    }
    if (enumBackingTypes[t]) {
      t = enumBackingTypes[t]
    }
    return t
  }

  const getBitSize = (type: string): number => {
    const prim = getPrimitive(type)
    if (prim === 'bool') return 1 // bool is 1 bit in packed structs
    if (typeSizes[prim]) return typeSizes[prim] * 8
    const match = prim.match(/^u(\d+)$/)
    if (match) return parseInt(match[1], 10)
    return 8
  }

  // Pre-pass
  for (const line of lines) {
    const aliasMatch = line.match(regexConstAlias)
    if (aliasMatch) {
      const [_, name, target] = aliasMatch
      aliases[name] = target
      if (typeSizes[target]) typeSizes[name] = typeSizes[target]
    }
    const enumMatch = line.match(regexEnumStart)
    if (enumMatch) {
      const [_, name, backing] = enumMatch
      typeSizes[name] = typeSizes[backing] || 1
      enumBackingTypes[name] = backing
    }
  }

  // Main Loop
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    let line = rawLine.trim()

    const matchAlias = line.match(regexConstAlias)
    if (matchAlias) {
      const [_, name, target] = matchAlias
      output += `export type ${name} = ${toTsType(target)}\n\n`
      continue
    }

    const matchEnum = line.match(regexEnumStart)
    if (matchEnum) {
      const name = matchEnum[1]
      const backing = matchEnum[2]

      if (line.includes('};')) {
        const inner = line.substring(line.indexOf('{') + 1, line.indexOf('};'))
        const parts = inner
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s)
        processEnum(name, parts, parts.includes('_'), backing)
      } else {
        currentBlock = 'ENUM'
        currentName = name
        currentBackingType = backing
        currentBuffer = []
        currentEnumHasWildcard = false
      }
      continue
    }

    const matchVal = line.match(regexConstVal)
    if (matchVal) {
      const [_, name, val] = matchVal
      const isExport = rawLine.startsWith('pub')
      output += `${isExport ? 'export ' : ''}const ${name} = ${val.trim()}\n`
      if (name === 'ID_PROP') output += '\n'
      continue
    }

    const matchStruct = line.match(regexStructStart)
    if (matchStruct) {
      currentBlock = 'STRUCT'
      currentName = matchStruct[1]
      currentBuffer = []
      currentStructIsPacked = !!matchStruct[2]
      continue
    }

    if ((line === '};' || line === '};') && currentBlock !== 'NONE') {
      if (currentBlock === 'ENUM') {
        processEnum(
          currentName,
          currentBuffer,
          currentEnumHasWildcard,
          currentBackingType,
        )
      } else if (currentBlock === 'STRUCT') {
        processStruct(currentName, currentBuffer, currentStructIsPacked)
      }
      currentBlock = 'NONE'
      currentBuffer = []
      continue
    }

    if (currentBlock !== 'NONE') {
      if (line.startsWith('pub fn')) {
        let fnBuffer: string[] = [rawLine]
        let braceCount = 0
        braceCount += (rawLine.match(/\{/g) || []).length
        braceCount -= (rawLine.match(/\}/g) || []).length

        while (braceCount > 0 && i < lines.length - 1) {
          i++
          const nextLine = lines[i]
          fnBuffer.push(nextLine)
          braceCount += (nextLine.match(/\{/g) || []).length
          braceCount -= (nextLine.match(/\}/g) || []).length
        }
        currentBuffer.push(fnBuffer.join('\n'))
      } else {
        if (currentBlock === 'ENUM' && (line === '_,' || line === '_')) {
          currentEnumHasWildcard = true
        } else {
          currentBuffer.push(line)
        }
      }
    }
  }

  function processEnum(
    name: string,
    body: string[],
    hasWildcard: boolean,
    backingType: string,
  ) {
    const pairs: { key: string; val: string }[] = []

    body.forEach((l) => {
      const trimmed = l.trim()
      if (!trimmed) return
      if (trimmed.startsWith('pub fn')) return
      if (trimmed === '_' || trimmed === '_,') return

      const match = trimmed.match(regexField)
      if (match) {
        let key = match[1]
        let valStr = match[2].trim()

        if (key.startsWith('@"')) key = key.replace(/@"/, '').replace(/"/, '')
        if (valStr.includes('//')) valStr = valStr.split('//')[0].trim()
        if (valStr.endsWith(',')) valStr = valStr.slice(0, -1)

        if (valStr.startsWith('@intFromEnum')) {
          const inner = valStr.match(/\(([\w\.]+)\)/)?.[1]
          if (inner) {
            const [refEnum, refField] = inner.split('.')
            let resolvedField = refField
            if (enumValues[refEnum]) {
              if (enumValues[refEnum][refField] !== undefined) {
                resolvedField = refField
              } else {
                const lowerRef = refField.toLowerCase()
                const foundKey = Object.keys(enumValues[refEnum]).find(
                  (k) => k.toLowerCase() === lowerRef,
                )
                if (foundKey) {
                  resolvedField = foundKey
                }
              }
            }
            valStr = `${refEnum}.${resolvedField}`
          }
        }
        pairs.push({ key, val: valStr })
      }
    })

    // 1. Enum Map
    output += `export const ${name} = {\n`
    pairs.forEach((p) => (output += `  ${p.key}: ${p.val},\n`))
    output += `} as const\n\n`

    // 2. Inverse Map
    output += `export const ${name}Inverse = {\n`
    pairs.forEach((p) => {
      let key = p.val
      if (!/^[-]?\d/.test(key)) {
        key = `[${key}]`
      }
      output += `  ${key}: '${p.key}',\n`
    })
    output += `} as const\n\n`

    output += `/**\n`
    pairs.forEach((p, idx) => {
      output += `  ${p.key}${idx < pairs.length - 1 ? ',' : ''} \n`
    })
    output += ` */\n`

    if (hasWildcard) {
      output += `// this needs number because it has a any (_) condition\n`
      if (pairs.length > 0) {
        const vals = pairs.map((p) => p.val).join(' | ')
        output += `export type ${name}Enum = ${vals} | (number & {})\n\n`
      } else {
        output += `export type ${name}Enum = number\n\n`
      }
    } else {
      if (pairs.length > 0) {
        output += `export type ${name}Enum = (typeof ${name})[keyof typeof ${name}]\n\n`
      } else {
        output += `export type ${name}Enum = number\n\n`
      }
    }
  }

  function processStruct(name: string, body: string[], isPacked: boolean) {
    const fields: {
      name: string
      type: string
      bitSize: number
      isPadding: boolean
      isBoolean: boolean
    }[] = []
    let totalBits = 0

    body.forEach((l) => {
      const match = l.match(regexStructField)
      if (match) {
        const fName = match[1]
        let fType = match[2]
        let tsType = 'number'
        const isPadding = fName.startsWith('_')

        if (aliases[fType]) {
          tsType = fType
        } else if (enumBackingTypes[fType]) {
          tsType = fType + 'Enum'
        } else if (fType === 'bool') {
          tsType = 'boolean'
        }

        const prim = getPrimitive(fType)
        const isBoolean = prim === 'bool'

        const bitSize = getBitSize(fType)
        totalBits += bitSize

        fields.push({
          name: fName,
          type: tsType,
          bitSize,
          isPadding,
          isBoolean,
        })
      }
    })

    // 1. Export Type
    output += `export type ${name} = {\n`
    fields.forEach((f) => {
      if (!f.isPadding) {
        output += `  ${f.name}: ${f.type}\n`
      }
    })
    output += `}\n\n`

    const byteSize = Math.ceil(totalBits / 8)
    output += `export const ${name}ByteSize = ${byteSize}\n\n`

    // 2. Export Main Write Function
    output += `export const write${name} = (\n`
    output += `  buf: Uint8Array,\n`
    output += `  header: ${name},\n`
    output += `  offset: number,\n`
    output += `): number => {\n`

    if (!isPacked) {
      fields.forEach((f) => {
        const fName = f.name
        const prim = getPrimitive(
          body
            .find((l) => l.includes(`${fName}:`))
            ?.match(regexStructField)?.[2] || 'u8',
        )
        const valRef = f.isPadding ? '0' : `header.${fName}`

        switch (prim) {
          case 'u8':
          case 'LangCode':
            output += `  buf[offset] = ${valRef}\n;  offset += 1\n`
            break
          case 'bool':
            output += `  buf[offset] = ${valRef} ? 1 : 0\n;  offset += 1\n`
            break
          case 'i8':
            output += `  buf[offset] = ${valRef}\n;  offset += 1\n`
            break
          case 'u16':
            output += `  writeUint16(buf, ${valRef}, offset)\n;  offset += 2\n`
            break
          case 'i16':
            output += `  writeInt16(buf, ${valRef}, offset)\n;  offset += 2\n`
            break
          case 'u32':
            output += `  writeUint32(buf, ${valRef}, offset)\n;  offset += 4\n`
            break
          case 'i32':
            output += `  writeInt32(buf, ${valRef}, offset)\n;  offset += 4\n`
            break
          case 'f32':
            output += `  writeFloatLE(buf, ${valRef}, offset)\n;  offset += 4\n`
            break
          case 'u64':
          case 'usize':
            output += `  writeUint64(buf, ${valRef}, offset)\n;  offset += 8\n`
            break
          case 'i64':
            output += `  writeInt64(buf, ${valRef}, offset)\n;  offset += 8\n`
            break
          case 'f64':
            output += `  writeDoubleLE(buf, ${valRef}, offset)\n;  offset += 8\n`
            break
          default:
            output += `  offset += ${Math.ceil(f.bitSize / 8)}\n`
        }
      })
    } else {
      let currentBitGlobal = 0

      for (let i = 0; i < fields.length; i++) {
        const f = fields[i]

        if (currentBitGlobal % 8 === 0 && [8, 16, 32, 64].includes(f.bitSize)) {
          const fName = f.name
          const valRef = f.isPadding ? '0' : `header.${fName}`
          const valWithTernary =
            f.isBoolean && !f.isPadding ? `(${valRef} ? 1 : 0)` : valRef

          if (f.bitSize === 8) {
            output += `  buf[offset] = ${valWithTernary}\n`
            output += `  offset += 1\n`
          } else if (f.bitSize === 16) {
            output += `  writeUint16(buf, ${valRef}, offset)\n`
            output += `  offset += 2\n`
          } else if (f.bitSize === 32) {
            output += `  writeUint32(buf, ${valRef}, offset)\n`
            output += `  offset += 4\n`
          } else if (f.bitSize === 64) {
            output += `  writeUint64(buf, ${valRef}, offset)\n`
            output += `  offset += 8\n`
          }
          currentBitGlobal += f.bitSize
        } else {
          let remainingBits = f.bitSize
          let valExpression = f.isPadding ? '0' : `header.${f.name}`

          if (f.isBoolean && !f.isPadding) {
            valExpression = `(${valExpression} ? 1 : 0)`
          }

          let bitsProcessed = 0
          while (remainingBits > 0) {
            const bitInByte = currentBitGlobal % 8
            const bitsCanFitInByte = 8 - bitInByte
            const bitsToWrite = Math.min(remainingBits, bitsCanFitInByte)

            const mask = (1 << bitsToWrite) - 1

            if (bitInByte === 0) {
              output += `  buf[offset] = 0\n`
            }

            output += `  buf[offset] |= ((${valExpression} >>> ${bitsProcessed}) & ${mask}) << ${bitInByte}\n`

            currentBitGlobal += bitsToWrite
            bitsProcessed += bitsToWrite
            remainingBits -= bitsToWrite

            if (currentBitGlobal % 8 === 0) {
              output += `  offset += 1\n`
            }
          }
        }
      }
    }

    output += `  return offset\n`
    output += `}\n\n`

    // 3. Export Props Writers
    output += `export const write${name}Props = {\n`

    let propsCurrentOffset = 0
    let propsCurrentBitGlobal = 0

    if (!isPacked) {
      fields.forEach((f) => {
        const fName = f.name
        if (f.isPadding) return

        const prim = getPrimitive(
          body
            .find((l) => l.includes(`${fName}:`))
            ?.match(regexStructField)?.[2] || 'u8',
        )
        const typeTs = f.type

        output += `  ${fName}: (buf: Uint8Array, value: ${typeTs}, offset: number) => {\n`
        const offStr =
          propsCurrentOffset === 0 ? 'offset' : `offset + ${propsCurrentOffset}`

        switch (prim) {
          case 'u8':
          case 'LangCode':
            output += `    buf[${offStr}] = value\n`
            break
          case 'bool':
            output += `    buf[${offStr}] = value ? 1 : 0\n`
            break
          case 'i8':
            output += `    buf[${offStr}] = value\n`
            break
          case 'u16':
            output += `    writeUint16(buf, value, ${offStr})\n`
            break
          case 'i16':
            output += `    writeInt16(buf, value, ${offStr})\n`
            break
          case 'u32':
            output += `    writeUint32(buf, value, ${offStr})\n`
            break
          case 'i32':
            output += `    writeInt32(buf, value, ${offStr})\n`
            break
          case 'f32':
            output += `    writeFloatLE(buf, value, ${offStr})\n`
            break
          case 'u64':
          case 'usize':
            output += `    writeUint64(buf, value, ${offStr})\n`
            break
          case 'i64':
            output += `    writeInt64(buf, value, ${offStr})\n`
            break
          case 'f64':
            output += `    writeDoubleLE(buf, value, ${offStr})\n`
            break
        }
        propsCurrentOffset += Math.ceil(f.bitSize / 8)
        output += `  },\n`
      })
    } else {
      // Packed Props
      for (let i = 0; i < fields.length; i++) {
        const f = fields[i]
        const startBit = propsCurrentBitGlobal
        propsCurrentBitGlobal += f.bitSize

        if (f.isPadding) continue

        output += `  ${f.name}: (buf: Uint8Array, value: ${f.type}, offset: number) => {\n`

        const byteOffset = Math.floor(startBit / 8)
        const offStr = byteOffset === 0 ? 'offset' : `offset + ${byteOffset}`

        if (startBit % 8 === 0 && [8, 16, 32, 64].includes(f.bitSize)) {
          const valWithTernary = f.isBoolean ? `(value ? 1 : 0)` : `value`

          if (f.bitSize === 8) {
            output += `    buf[${offStr}] = ${valWithTernary}\n`
          } else if (f.bitSize === 16) {
            output += `    writeUint16(buf, value, ${offStr})\n`
          } else if (f.bitSize === 32) {
            output += `    writeUint32(buf, value, ${offStr})\n`
          } else if (f.bitSize === 64) {
            output += `    writeUint64(buf, value, ${offStr})\n`
          }
        } else {
          let remainingBits = f.bitSize
          let valExpression = `value`
          if (f.isBoolean) valExpression = `(${valExpression} ? 1 : 0)`
          let localCurrentBitGlobal = startBit
          let bitsProcessed = 0
          while (remainingBits > 0) {
            const bitInByte = localCurrentBitGlobal % 8
            const bitsCanFitInByte = 8 - bitInByte
            const bitsToWrite = Math.min(remainingBits, bitsCanFitInByte)
            const mask = (1 << bitsToWrite) - 1

            const currentByteIndex = Math.floor(localCurrentBitGlobal / 8)
            const accessStr =
              currentByteIndex === 0 ? 'offset' : `offset + ${currentByteIndex}`

            output += `    buf[${accessStr}] |= ((${valExpression} >>> ${bitsProcessed}) & ${mask}) << ${bitInByte}\n`
            localCurrentBitGlobal += bitsToWrite
            bitsProcessed += bitsToWrite
            remainingBits -= bitsToWrite
          }
        }
        output += `  },\n`
      }
    }
    output += `}\n\n`

    // 4. Export Reader
    output += `export const read${name} = (\n`
    output += `  buf: Uint8Array,\n`
    output += `  offset: number,\n`
    output += `): ${name} => {\n`
    output += `  const value: ${name} = {\n`

    let readCurrentOffset = 0
    let readCurrentBitGlobal = 0

    if (!isPacked) {
      fields.forEach((f) => {
        const fName = f.name
        if (f.isPadding) return

        const prim = getPrimitive(
          body
            .find((l) => l.includes(`${fName}:`))
            ?.match(regexStructField)?.[2] || 'u8',
        )
        const offStr =
          readCurrentOffset === 0 ? 'offset' : `offset + ${readCurrentOffset}`
        let readExpr = ''

        switch (prim) {
          case 'u8':
          case 'LangCode':
            readExpr = `buf[${offStr}]`
            break
          case 'bool':
            readExpr = `buf[${offStr}] === 1`
            break
          case 'i8':
            readExpr = `buf[${offStr}]`
            break
          case 'u16':
            readExpr = `readUint16(buf, ${offStr})`
            break
          case 'i16':
            readExpr = `readInt16(buf, ${offStr})`
            break
          case 'u32':
            readExpr = `readUint32(buf, ${offStr})`
            break
          case 'i32':
            readExpr = `readInt32(buf, ${offStr})`
            break
          case 'f32':
            readExpr = `readFloatLE(buf, ${offStr})`
            break
          case 'u64':
          case 'usize':
            readExpr = `readUint64(buf, ${offStr})`
            break
          case 'i64':
            readExpr = `readInt64(buf, ${offStr})`
            break
          case 'f64':
            readExpr = `readDoubleLE(buf, ${offStr})`
            break
        }
        // Add 'as Type' if enum
        if (f.type.endsWith('Enum')) {
          readExpr = `(${readExpr}) as ${f.type}`
        } else if (f.type === 'TypeId') {
          readExpr = `(${readExpr}) as TypeId`
        }

        output += `    ${fName}: ${readExpr},\n`
        readCurrentOffset += Math.ceil(f.bitSize / 8)
      })
    } else {
      // Packed Readers
      for (let i = 0; i < fields.length; i++) {
        const f = fields[i]
        const startBit = readCurrentBitGlobal
        readCurrentBitGlobal += f.bitSize

        if (f.isPadding) continue

        const byteOffset = Math.floor(startBit / 8)
        const offStr = byteOffset === 0 ? 'offset' : `offset + ${byteOffset}`
        let readExpr = ''

        if (startBit % 8 === 0 && [8, 16, 32, 64].includes(f.bitSize)) {
          if (f.bitSize === 8) readExpr = `buf[${offStr}]`
          else if (f.bitSize === 16) readExpr = `readUint16(buf, ${offStr})`
          else if (f.bitSize === 32) readExpr = `readUint32(buf, ${offStr})`
          else if (f.bitSize === 64) readExpr = `readUint64(buf, ${offStr})`

          if (f.isBoolean) readExpr = `(${readExpr}) === 1`
        } else {
          // Bitwise Read
          let expressionParts: string[] = []
          let remainingBits = f.bitSize
          let localCurrentBitGlobal = startBit
          let bitsProcessed = 0

          while (remainingBits > 0) {
            const bitInByte = localCurrentBitGlobal % 8
            const bitsCanFitInByte = 8 - bitInByte
            const bitsToRead = Math.min(remainingBits, bitsCanFitInByte)
            const mask = (1 << bitsToRead) - 1

            const currentByteIndex = Math.floor(localCurrentBitGlobal / 8)
            const accessStr =
              currentByteIndex === 0 ? 'offset' : `offset + ${currentByteIndex}`

            // part = ((buf[access] >>> bitInByte) & mask) << bitsProcessed
            let part = `((buf[${accessStr}] >>> ${bitInByte}) & ${mask})`
            if (bitsProcessed > 0) part = `(${part} << ${bitsProcessed})`

            expressionParts.push(part)

            localCurrentBitGlobal += bitsToRead
            bitsProcessed += bitsToRead
            remainingBits -= bitsToRead
          }

          readExpr = expressionParts.join(' | ')
          if (expressionParts.length > 1) readExpr = `(${readExpr})`

          if (f.isBoolean) {
            readExpr = `(${readExpr}) === 1`
          }
        }

        if (f.type.endsWith('Enum')) {
          readExpr = `(${readExpr}) as ${f.type}`
        } else if (f.type === 'TypeId') {
          readExpr = `(${readExpr}) as TypeId`
        }

        output += `    ${f.name}: ${readExpr},\n`
      }
    }

    output += `  }\n`
    output += `  return value\n`
    output += `}\n\n`

    // 5. Export Read Props
    output += `export const read${name}Props = {\n`

    let readPropsCurrentOffset = 0
    let readPropsCurrentBitGlobal = 0

    if (!isPacked) {
      fields.forEach((f) => {
        const fName = f.name
        if (f.isPadding) return

        const prim = getPrimitive(
          body
            .find((l) => l.includes(`${fName}:`))
            ?.match(regexStructField)?.[2] || 'u8',
        )
        const offStr =
          readPropsCurrentOffset === 0
            ? 'offset'
            : `offset + ${readPropsCurrentOffset}`
        let readExpr = ''

        switch (prim) {
          case 'u8':
          case 'LangCode':
            readExpr = `buf[${offStr}]`
            break
          case 'bool':
            readExpr = `buf[${offStr}] === 1`
            break
          case 'i8':
            readExpr = `buf[${offStr}]`
            break
          case 'u16':
            readExpr = `readUint16(buf, ${offStr})`
            break
          case 'i16':
            readExpr = `readInt16(buf, ${offStr})`
            break
          case 'u32':
            readExpr = `readUint32(buf, ${offStr})`
            break
          case 'i32':
            readExpr = `readInt32(buf, ${offStr})`
            break
          case 'f32':
            readExpr = `readFloatLE(buf, ${offStr})`
            break
          case 'u64':
          case 'usize':
            readExpr = `readUint64(buf, ${offStr})`
            break
          case 'i64':
            readExpr = `readInt64(buf, ${offStr})`
            break
          case 'f64':
            readExpr = `readDoubleLE(buf, ${offStr})`
            break
        }

        if (f.type.endsWith('Enum')) {
          readExpr = `(${readExpr}) as ${f.type}`
        } else if (f.type === 'TypeId') {
          readExpr = `(${readExpr}) as TypeId`
        }

        output += `  ${fName}: (buf: Uint8Array, offset: number): ${f.type} => {\n`
        output += `    return ${readExpr}\n`
        output += `  },\n`

        readPropsCurrentOffset += Math.ceil(f.bitSize / 8)
      })
    } else {
      // Packed Read Props
      for (let i = 0; i < fields.length; i++) {
        const f = fields[i]
        const startBit = readPropsCurrentBitGlobal
        readPropsCurrentBitGlobal += f.bitSize

        if (f.isPadding) continue

        const byteOffset = Math.floor(startBit / 8)
        const offStr = byteOffset === 0 ? 'offset' : `offset + ${byteOffset}`
        let readExpr = ''

        if (startBit % 8 === 0 && [8, 16, 32, 64].includes(f.bitSize)) {
          if (f.bitSize === 8) readExpr = `buf[${offStr}]`
          else if (f.bitSize === 16) readExpr = `readUint16(buf, ${offStr})`
          else if (f.bitSize === 32) readExpr = `readUint32(buf, ${offStr})`
          else if (f.bitSize === 64) readExpr = `readUint64(buf, ${offStr})`

          if (f.isBoolean) readExpr = `(${readExpr}) === 1`
        } else {
          let expressionParts: string[] = []
          let remainingBits = f.bitSize
          let localCurrentBitGlobal = startBit
          let bitsProcessed = 0

          while (remainingBits > 0) {
            const bitInByte = localCurrentBitGlobal % 8
            const bitsCanFitInByte = 8 - bitInByte
            const bitsToRead = Math.min(remainingBits, bitsCanFitInByte)
            const mask = (1 << bitsToRead) - 1

            const currentByteIndex = Math.floor(localCurrentBitGlobal / 8)
            const accessStr =
              currentByteIndex === 0 ? 'offset' : `offset + ${currentByteIndex}`

            let part = `((buf[${accessStr}] >>> ${bitInByte}) & ${mask})`
            if (bitsProcessed > 0) part = `(${part} << ${bitsProcessed})`

            expressionParts.push(part)

            localCurrentBitGlobal += bitsToRead
            bitsProcessed += bitsToRead
            remainingBits -= bitsToRead
          }

          readExpr = expressionParts.join(' | ')
          if (expressionParts.length > 1) readExpr = `(${readExpr})`

          if (f.isBoolean) {
            readExpr = `(${readExpr}) === 1`
          }
        }

        if (f.type.endsWith('Enum')) {
          readExpr = `(${readExpr}) as ${f.type}`
        } else if (f.type === 'TypeId') {
          readExpr = `(${readExpr}) as TypeId`
        }

        output += `  ${f.name}: (buf: Uint8Array, offset: number): ${f.type} => {\n`
        output += `    return ${readExpr}\n`
        output += `  },\n`
      }
    }
    output += `}\n\n`

    // 6. Export Create Function
    output += `export const create${name} = (header: ${name}): Uint8Array => {\n`
    output += `  const buffer = new Uint8Array(${name}ByteSize)\n`
    output += `  write${name}(buffer, header, 0)\n`
    output += `  return buffer\n`
    output += `}\n\n`
  }

  return output
}

const zigCode = await fs.readFile(join(__dirname, '../native/types.zig'))
const zigCodeString = zigCode.toString()
const zigTsExports = parseZig(zigCodeString)
await Promise.all([
  fs.writeFile(join(__dirname, '../src/zigTsExports.ts'), zigTsExports),
  fs.writeFile(
    join(__dirname, '../../protocol/src/zigTsExports.ts'),
    zigTsExports,
  ),
  fs.writeFile(
    join(__dirname, '../../exporter/src/zigTsExports.ts'),
    zigTsExports,
  ),
])

console.log('build zig types file in ts (src/zigTsExports)')
