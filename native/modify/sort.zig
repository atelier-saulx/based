// const napi = @import("../napi.zig");
const sort = @import("../sort/sort.zig");
// const read = @import("../utils.zig").read;
// const Modify = @import("common.zig");
const std = @import("std");
const t = @import("../types.zig");
const DbCtx = @import("../db/ctx.zig").DbCtx;
const Schema = @import("../selva/schema.zig");
const Node = @import("../selva/node.zig");
const Fields = @import("../selva/fields.zig");
// const ModifyCtx = Modify.ModifyCtx;

// pub fn addEmptyToSortIndex(ctx: *ModifyCtx, data: []u8) !usize {
//     const len = read(u16, data, 0);
//     var i: usize = 0;
//     if (ctx.typeSortIndex == null) {
//         return len + 2;
//     }
//     while (i < len) : (i += 1) {
//         const field = data[i + 2];
//         const sI = sort.getSortIndex(
//             ctx.typeSortIndex,
//             field,
//             0,
//             t.LangCode.none,
//         );
//         if (sI != null) {
//             sort.insert(ctx.thread.decompressor, sI.?, sort.EMPTY_SLICE, ctx.node.?);
//         }
//     }
//     return len + 2;
// }

// pub fn addEmptyTextToSortIndex(ctx: *ModifyCtx, data: []u8) !usize {
//     const len = read(u16, data, 0);
//     if (ctx.typeSortIndex == null) {
//         return len + 2;
//     }
//     var i: usize = 2;
//     while (i < len) {
//         const field = data[i];
//         i += 1;
//         const langs = data[i] + i + 1;
//         i += 1;
//         while (i < langs) {
//             const lang: t.LangCode = @enumFromInt(data[i]);
//             const sI = sort.getSortIndex(
//                 ctx.typeSortIndex,
//                 field,
//                 0,
//                 lang,
//             );
//             if (sI != null) {
//                 sort.insert(ctx.thread.decompressor, sI.?, sort.EMPTY_SLICE, ctx.node.?);
//             }
//             i += 1;
//         }
//     }
//     return len + 2;
// }

pub inline fn deleteSort(db: *DbCtx, typeId: t.TypeId, typeEntry: ?Node.Type, node: Node.Node) !void {
    if (sort.getTypeSortIndexes(db, typeId)) |typeSort| {
        const mainSchema = try Schema.getFieldSchema(typeEntry, 0);
        const mainBuffer = Fields.get(typeEntry, node, mainSchema, t.PropType.microBuffer);
        var main = typeSort.main.valueIterator();
        while (main.next()) |sortIndex| {
            sort.remove(db.decompressor, sortIndex.*, mainBuffer, node);
        }
        var prop = typeSort.field.valueIterator();
        while (prop.next()) |sortIndex| {
            const propSchema = try Schema.getFieldSchema(typeEntry, sortIndex.*.field);
            const current = Fields.get(typeEntry, node, propSchema, sortIndex.*.prop);
            sort.remove(db.decompressor, sortIndex.*, current, node);
        }
    }
}

pub inline fn createSort(db: *DbCtx, typeId: t.TypeId, typeEntry: ?Node.Type, node: Node.Node) !void {
    if (sort.getTypeSortIndexes(db, typeId)) |typeSort| {
        const mainSchema = try Schema.getFieldSchema(typeEntry, 0);
        const mainBuffer = Fields.get(typeEntry, node, mainSchema, t.PropType.microBuffer);
        var main = typeSort.main.valueIterator();
        while (main.next()) |sortIndex| {
            sort.insert(db.decompressor, sortIndex.*, mainBuffer, node);
        }
        var prop = typeSort.field.valueIterator();
        while (prop.next()) |sortIndex| {
            const propSchema = try Schema.getFieldSchema(typeEntry, sortIndex.*.field);
            const current = Fields.get(typeEntry, node, propSchema, sortIndex.*.prop);
            sort.insert(db.decompressor, sortIndex.*, current, node);
        }
    }
}
