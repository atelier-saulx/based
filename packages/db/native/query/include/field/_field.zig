// const db = @import("../../db//db.zig");
// const QueryCtx = @import("../types.zig").QueryCtx;
// const types = @import("./types.zig");
// const t = @import("../../types.zig");
// const std = @import("std");
// const selva = @import("../../selva.zig");
// const utils = @import("../../utils.zig");
// const read = utils.read;
// const results = @import("../results.zig");

// inline fn addResult(
//     field: u8,
//     value: []u8,
//     edgeType: t.Prop,
// ) results.Result {
//     return .{
//         .type = if (edgeType != t.Prop.NULL) t.ResultType.edge else t.ResultType.none,
//         .id = null,
//         .score = null, // rly want to get rid of this with a comptime result (extra 4 bytes for no reason)
//         .field = field,
//         .val = value,
//     };
// }

// pub fn includeSelvaString(
//     op: t.IncludeOp,
//     field: u8,
//     prop: t.Prop,
//     node: db.Node,
//     ctx: *QueryCtx,
//     id: u32,
//     idIsSet: bool,
//     typeEntry: db.Type,
//     // operation: []u8,
//     edgeRef: ?types.RefStruct,
//     score: ?[4]u8,
//     // lets try something else for score
//     comptime isEdge: bool,
// ) usize {
//     // var includeMain: ?[]u8 = null;
//     var size: usize = 0;
//     // var includeIterator: u16 = 0;
//     // var main: ?[]u8 = null;
//     var edgeType: t.Prop = t.Prop.NULL;

//     std.debug.print("derp {any} {any} \n", .{ op, field });

//     // var prop: t.Prop = undefined;
//     var fieldSchema: *const selva.SelvaFieldSchema = undefined;
//     var value: []u8 = undefined;

//     // if (field == t.MAIN_PROP) {
//     //     // prop = t.Prop.MICRO_BUFFER;
//     //     const mainIncludeSize = read(u16, operation, 0);
//     //     if (mainIncludeSize != 0) {
//     //         includeMain = operation[2 .. 2 + mainIncludeSize];
//     //     }
//     //     includeIterator += 2 + mainIncludeSize;
//     // } else {
//     //     // prop = @enumFromInt(operation[0]);
//     //     // includeIterator += 1;
//     // }

//     // opts here

//     if (isEdge) {
//         if (edgeRef.?.edgeConstaint == null) {
//             std.log.err("Trying to get an edge field from a weakRef (4) \n", .{});
//             // Is a edge ref cant filter on an edge field!
//             return 11;
//         }
//         fieldSchema = try db.getEdgeFieldSchema(ctx.db.selva.?, edgeRef.?.edgeConstaint.?, field);
//         edgeType = @enumFromInt(fieldSchema.*.type);
//         if (prop == t.Prop.CARDINALITY) {
//             value = db.getCardinalityReference(edgeRef.?.reference.?, fieldSchema);
//         } else {
//             value = db.getEdgeProp(edgeRef.?.reference.?, fieldSchema);
//         }
//     } else {
//         fieldSchema = try db.getFieldSchema(typeEntry, field);
//         value = db.getField(typeEntry, id, node, fieldSchema, prop);
//     }

//     var valueLen = value.len;

//     if (valueLen == 0) {
//         // if (prop == t.Prop.TEXT) {
//         //     includeIterator += 2 + operation[2];
//         // }
//         return 0;
//     }

//     //
//     // if (prop == t.Prop.META_SELVA_STRING) {
//     //     var result = addResult(field, value, edgeType);
//     //     if (!idIsSet) {
//     //         size += 5;
//     //         result.id = id;
//     //         idIsSet = true;
//     //         if (score != null) {
//     //             result.score = score;
//     //             size += 4;
//     //         }
//     //     }
//     //     if (isEdge) {
//     //         size += 1;
//     //         result.type = t.ResultType.metaEdge;
//     //     } else {
//     //         result.type = t.ResultType.meta;
//     //     }
//     //     try ctx.results.append(result);
//     //     size += 10 + 1; // 8 for checksum + len, 1 for field, 1 for checksum indicator
//     // }

//     // if (prop == t.Prop.TEXT) {
//     //     const code: t.LangCode = @enumFromInt(include[includeIterator]);
//     //     const fallbackSize = operation[2];
//     //     includeIterator += 2 + fallbackSize;

//     //     if (code != t.LangCode.NONE) {
//     //         const s = if (fallbackSize > 0) db.getTextFromValueFallback(value, code, operation[3 .. 3 + fallbackSize]) else db.getTextFromValue(value, code);
//     //         if (s.len > 0) {
//     //             if (isEdge) {
//     //                 size += (s.len + 6 - 4);
//     //             } else {
//     //                 size += (s.len + 5 - 4);
//     //             }
//     //             var result = addResult(field, s[0 .. s.len - 4], edgeType);
//     //             if (!idIsSet) {
//     //                 size += 5;
//     //                 result.id = id;
//     //                 idIsSet = true;
//     //                 if (score != null) {
//     //                     result.score = score;
//     //                     size += 4;
//     //                 }
//     //             }
//     //             try ctx.results.append(result);
//     //         }
//     //     } else {
//     //         var iter = db.textIterator(value);
//     //         while (iter.next()) |s| {
//     //             if (isEdge) {
//     //                 size += (s.len + 6 - 4);
//     //             } else {
//     //                 size += (s.len + 5 - 4);
//     //             }
//     //             var result = addResult(field, s[0 .. s.len - 4], edgeType);
//     //             if (!idIsSet) {
//     //                 size += 5;
//     //                 result.id = id;
//     //                 idIsSet = true;
//     //                 if (score != null) {
//     //                     result.score = score;
//     //                     size += 4;
//     //                 }
//     //             }
//     //             try ctx.results.append(result);
//     //         }
//     //     }
//     // } else {
//     // if (prop == t.Prop.STRING or prop == t.Prop.JSON or prop == t.Prop.BINARY) {
//     valueLen = valueLen - 4;
//     value = value[0..valueLen];
//     // }

//     if (isEdge) {
//         size += 1;
//     }

//     // if (field == t.MAIN_PROP) {
//     //     main = value;
//     //     if (includeMain) |incMain| {
//     //         if (incMain.len != 0) {
//     //             const mainSelectiveSize = read(u16, incMain, 0);
//     //             const mainSelectiveVal = try ctx.allocator.alloc(u8, mainSelectiveSize);
//     //             var mainPos: usize = 2;
//     //             var j: usize = 0;
//     //             while (mainPos < incMain.len) {
//     //                 const mainOp = incMain[mainPos..];
//     //                 const start = read(u16, mainOp, 0);
//     //                 const len = read(u16, mainOp, 2);
//     //                 utils.copy(mainSelectiveVal[j .. j + len], value[start .. start + len]);
//     //                 j += len;
//     //                 mainPos += 4;
//     //             }
//     //             value = mainSelectiveVal;
//     //             // len is known on client 1 for field
//     //             size += mainSelectiveSize + 1;
//     //         }
//     //     } else {
//     //         // len is known on client 1 for field
//     //         size += (valueLen + 1);
//     //     }
//     // } else {
//     // 4 for len 1 for field
//     size += (valueLen + 5);
//     // }
//     var result = addResult(field, value, edgeType);
//     if (!idIsSet) {
//         size += 5;
//         result.id = id;
//         idIsSet = true;
//         if (score != null) {
//             result.score = score;
//             size += 4;
//         }
//     }
//     try ctx.results.append(result);
//     // }
//     // return tuple with id
//     return size;
// }
