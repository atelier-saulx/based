// // TODO add enum in fields names!!!
// export const readSchemaTypeDefFromBuffer = (
//     buf: Buffer,
//     fieldNames: Buffer,
//     parsed: BasedDb['schemaTypesParsed'], // others...
//   ): SchemaTypeDef => {
//     const tree: SchemaFieldTree = {}
//     const fields: {
//       [key: string]: FieldDef
//     } = {}
//     const names: string[] = []
//     const seperate: FieldDef[] = []
//     let i = 0
//     const decoder = new TextDecoder()
//     while (i < fieldNames.byteLength) {
//       const len = fieldNames[i]
//       names.push(decoder.decode(fieldNames.slice(i + 1, i + len + 1)))
//       i += len + 1
//     }
//     let j = 2
//     let isMain = false
//     if (buf[j] === 0) {
//       isMain = true
//       j++
//     }
//     const type = names[0]
//     let currentName = 1
//     let cnt = 0
//     let mainLen = 0
//     let selvaField = 0
//     while (j < buf.byteLength) {
//       if (isMain) {
//         const typeByte = buf[j]
//         if (typeByte === 0) {
//           isMain = false
//           j++
//           continue
//         }
//         const typeName = REVERSE_TYPE_INDEX.get(typeByte)
//         const name = names[currentName]
//         const path = name.split('.')
//         const len = SIZE_MAP[typeName]
//         const field: FieldDef = {
//           __isField: true,
//           field: 0,
//           inverseTypeNumber: 0,
//           type: typeName,
//           typeByte,
//           seperate: false,
//           path,
//           start: mainLen,
//           len,
//         }
//         fields[name] = field
//         setByPath(tree, path, field)
//         mainLen += len
//         currentName++
//         j++
//       } else {
//         const fieldIndex = buf[j]
//         const typeByte = buf[j + 1]
//         const typeName = REVERSE_TYPE_INDEX.get(typeByte)
//         const name = names[currentName]
//         const path = name.split('.')
//         const len = SIZE_MAP[typeName]
//         const field: FieldDef = {
//           __isField: true,
//           field: fieldIndex,
//           type: typeName,
//           typeByte,
//           seperate: false,
//           path,
//           inverseTypeNumber: 0,
//           start: mainLen,
//           len,
//         }
//         fields[name] = field
//         seperate.push(field)
//         setByPath(tree, path, field)
//         currentName++
//         cnt++
//         j += 2
//       }
//     }

//     // @ts-ignore
//     const schemaTypeDef: SchemaTypeDef = {
//       prefix: new Uint8Array([buf[0], buf[1]]),
//       tree,
//       fields,
//       seperate,
//       cnt,
//       buf,
//       type,
//       fieldNames,
//       checksum: 0,
//       mainLen,
//       total: 0,
//       lastId: 0,
//     }

//     schemaTypeDef.responseCtx = new BasedNode(schemaTypeDef, parsed)

//     return schemaTypeDef
//   }
