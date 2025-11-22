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
  writeFloatLE, writeDoubleLE 
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
  // Store resolved enum fields to handle @intFromEnum references and casing
  const enumValues: Record<string, Record<string, string>> = {}

  // Regex patterns
  const regexConstAlias = /^pub const (\w+) = ([a-zA-Z_][\w]*);/
  const regexEnumStart = /^pub const (\w+)(?:: type)? = enum\((\w+)\) \{/
  const regexConstVal = /^pub const (\w+)(?:: [\w\d]+)?\s*=\s*([^;]+);/
  const regexStructStart = /^pub const (\w+) = (?:packed )?struct \{/
  const regexField = /^\s*([\w@"]+)\s*=\s*(.+?)(?:,|;)?$/
  const regexStructField = /^\s*(\w+):\s*([\w\.]+),/

  let currentBlock: 'NONE' | 'ENUM' | 'STRUCT' = 'NONE'
  let currentName = ''
  let currentBuffer: string[] = []
  let currentBackingType = 'u8'
  let currentEnumHasWildcard = false

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

  // Pre-pass to register types
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

    // 1. Type Aliases
    const matchAlias = line.match(regexConstAlias)
    if (matchAlias) {
      const [_, name, target] = matchAlias
      output += `export type ${name} = ${toTsType(target)}\n\n`
      continue
    }

    // 2. Enums
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

    // 3. Value Consts
    const matchVal = line.match(regexConstVal)
    if (matchVal) {
      const [_, name, val] = matchVal
      const isExport = rawLine.startsWith('pub')
      output += `${isExport ? 'export ' : ''}const ${name} = ${val.trim()}\n`
      if (name === 'ID_PROP') output += '\n'
      continue
    }

    // 4. Start Struct
    const matchStruct = line.match(regexStructStart)
    if (matchStruct) {
      currentBlock = 'STRUCT'
      currentName = matchStruct[1]
      currentBuffer = []
      continue
    }

    // 5. End Block
    if ((line === '};' || line === '};') && currentBlock !== 'NONE') {
      if (currentBlock === 'ENUM') {
        processEnum(
          currentName,
          currentBuffer,
          currentEnumHasWildcard,
          currentBackingType,
        )
      } else if (currentBlock === 'STRUCT') {
        processStruct(currentName, currentBuffer)
      }
      currentBlock = 'NONE'
      currentBuffer = []
      continue
    }

    // 6. Accumulate
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

    const localValues: Record<string, string> = {}

    body.forEach((l) => {
      const trimmed = l.trim()
      if (!trimmed) return

      // SKIP ALL FUNCTIONS IN ENUMS
      if (trimmed.startsWith('pub fn')) {
        return
      }

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
        localValues[key] = valStr
      }
    })

    enumValues[name] = localValues

    output += `export const ${name} = {\n`
    pairs.forEach((p) => (output += `  ${p.key}: ${p.val},\n`))
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
        // Updated here to use (number & {})
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

  function processStruct(name: string, body: string[]) {
    const fields: { name: string; type: string }[] = []
    let totalSize = 0

    body.forEach((l) => {
      const match = l.match(regexStructField)
      if (match) {
        const fName = match[1]
        let fType = match[2]
        let tsType = 'number'

        if (aliases[fType]) {
          tsType = fType
        } else if (enumBackingTypes[fType]) {
          tsType = fType + 'Enum'
        } else if (fType === 'bool') {
          tsType = 'boolean'
        }

        fields.push({ name: fName, type: tsType })
        totalSize += typeSizes[fType] || 0
      }
    })

    output += `export type ${name} = {\n`
    fields.forEach((f) => (output += `  ${f.name}: ${f.type}\n`))
    output += `}\n\n`

    output += `export const ${name}ByteSize = ${totalSize}\n\n`

    output += `export const write${name} = (\n`
    output += `  buf: Uint8Array,\n`
    output += `  header: ${name},\n`
    output += `  offset: number,\n`
    output += `): number => {\n`

    body.forEach((l) => {
      const match = l.match(regexStructField)
      if (!match) return
      const fName = match[1]
      const zigType = match[2]
      const prim = getPrimitive(zigType)

      switch (prim) {
        case 'u8':
        case 'LangCode':
          output += `  buf[offset] = header.${fName}\n`
          output += `  offset += 1\n`
          break
        case 'bool':
          output += `  buf[offset] = header.${fName} ? 1 : 0\n`
          output += `  offset += 1\n`
          break
        case 'i8':
          output += `  buf[offset] = header.${fName}\n`
          output += `  offset += 1\n`
          break
        case 'u16':
          output += `  writeUint16(buf, header.${fName}, offset)\n`
          output += `  offset += 2\n`
          break
        case 'i16':
          output += `  writeInt16(buf, header.${fName}, offset)\n`
          output += `  offset += 2\n`
          break
        case 'u32':
          output += `  writeUint32(buf, header.${fName}, offset)\n`
          output += `  offset += 4\n`
          break
        case 'i32':
          output += `  writeInt32(buf, header.${fName}, offset)\n`
          output += `  offset += 4\n`
          break
        case 'f32':
          output += `  writeFloatLE(buf, header.${fName}, offset)\n`
          output += `  offset += 4\n`
          break
        case 'u64':
        case 'usize':
          output += `  writeUint64(buf, header.${fName}, offset)\n`
          output += `  offset += 8\n`
          break
        case 'i64':
          output += `  writeInt64(buf, header.${fName}, offset)\n`
          output += `  offset += 8\n`
          break
        case 'f64':
          output += `  writeDoubleLE(buf, header.${fName}, offset)\n`
          output += `  offset += 8\n`
          break
        default:
          output += `  // Unknown type writer for ${fName}: ${zigType} (${prim})\n`
          const size = typeSizes[zigType] || 0
          if (size > 0) output += `  offset += ${size}\n`
          break
      }
    })

    output += `  return offset\n`
    output += `}\n\n`
  }

  return output
}

const zigCode = await fs.readFile(join(__dirname, '../native/types.zig'))
const zigCodeString = zigCode.toString()

await fs.writeFile(
  join(__dirname, '../src/zigTsExports.ts'),
  parseZig(zigCodeString),
)

console.log('build zig types file in ts (src/zigTsExports)')
