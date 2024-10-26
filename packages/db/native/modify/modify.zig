const std = @import("std");
const c = @import("../c.zig");
const selva = @import("../selva.zig");
const types = @import("../types.zig");
const napi = @import("../napi.zig");
const db = @import("../db/db.zig");
const sort = @import("../db/sort.zig");
const Modify = @import("./ctx.zig");
const createField = @import("./create.zig").createField;
const deleteField = @import("./delete.zig").deleteField;
const deleteFieldOnly = @import("./delete.zig").deleteFieldOnly;
const deleteFieldOnlyReal = @import("./delete.zig").deleteFieldOnlyReal;
const addEmptyToSortIndex = @import("./sort.zig").addEmptyToSortIndex;
const readInt = @import("../utils.zig").readInt;
const Update = @import("./update.zig");
const ModifyCtx = Modify.ModifyCtx;
const getShard = Modify.getShard;
const getSortIndex = Modify.getSortIndex;
const updateField = Update.updateField;
const updatePartialField = Update.updatePartialField;

pub fn modify(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return modifyInternal(env, info) catch |err| {
        napi.jsThrow(env, @errorName(err));
        return null;
    };
}

// inline fn readData(fieldType: types.Prop, operation: []u8, i: usize) []u8 {
//     if (fieldType == types.Prop.REFERENCE) {
//         if (operation[0] == 1) {
//             return operation[0 .. 5 + readInt(u32, operation, 5)];
//         } else {
//             return operation[0..5];
//         }
//     }

//     if (fieldType == types.Prop.REFERENCES) {
//         const refOp = operation[4];
//         if (refOp == 3 or refOp == 4) {
//             const d = (i + 2) & 3;
//             if (d != 0) {
//                 // align it!!
//                 const offset = 4 - d;
//                 const slice = operation[4 + offset .. readInt(u32, operation, 0) + 4];
//                 slice[0] = refOp;
//                 std.debug.print("OK {any}", .{slice});
//                 return slice;
//             }
//         }
//     }

//     return operation[4 .. readInt(u32, operation, 0) + 4];
// }

fn modifyInternal(env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(3, env, info);
    const batch = try napi.get([]u8, env, args[0]);
    const size = try napi.get(u32, env, args[1]);
    const dbCtx = try napi.get(*db.DbCtx, env, args[2]);
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();

    const allocator = arena.allocator();
    var i: usize = 0;
    var ctx: ModifyCtx = .{
        .field = undefined,
        .typeId = undefined,
        .id = undefined,
        .sortWriteTxn = null,
        .currentSortIndex = null,
        .sortIndexes = sort.Indexes.init(allocator),
        .node = null,
        .typeEntry = null,
        .fieldSchema = null,
        .fieldType = types.Prop.NULL,
        .db = dbCtx,
    };

    var offset: u32 = 0;

    while (i < size) {
        // delete
        const op: types.ModOp = @enumFromInt(batch[i]);
        const operation = batch[i + 1 ..];

        switch (op) {
            types.ModOp.SWITCH_FIELD => {
                // SWITCH FIELD
                ctx.field = operation[0];
                i = i + 2;
                if (ctx.field != 0) {
                    ctx.currentSortIndex = try getSortIndex(&ctx, 0);
                } else {
                    ctx.currentSortIndex = null;
                }
                ctx.fieldSchema = try db.getFieldSchema(ctx.field, ctx.typeEntry.?);
                ctx.fieldType = @enumFromInt(ctx.fieldSchema.?.*.type);
                if (ctx.fieldType == types.Prop.REFERENCE) {
                    offset = 1;
                } else {
                    offset = 5;
                }
            },
            types.ModOp.DELETE_NODE => {
                db.deleteNode(ctx.db, ctx.node.?, ctx.typeEntry.?) catch {};
                i = i + 1;
            },
            types.ModOp.CREATE_OR_GET => {
                // create or get
                ctx.id = readInt(u32, operation, 0);
                ctx.node = try db.upsertNode(ctx.id, ctx.typeEntry.?);
                i = i + 5;
            },
            types.ModOp.SWITCH_NODE => {
                // SWITCH ID/NODE
                ctx.id = readInt(u32, operation, 0);
                ctx.node = db.getNode(ctx.id, ctx.typeEntry.?);
                i = i + 5;
            },
            types.ModOp.SWITCH_TYPE => {
                // SWITCH TYPE
                ctx.typeId = readInt(u16, operation, 0);
                ctx.typeEntry = try db.getType(ctx.db, ctx.typeId);
                i = i + 3;
            },
            types.ModOp.ADD_EMPTY_SORT => {
                i += try addEmptyToSortIndex(&ctx, operation) + 1;
            },
            types.ModOp.DELETE_PROP_ONLY => {
                i += try deleteFieldOnly(&ctx) + 1;
            },
            types.ModOp.DELETE_PROP_ONLY_REAL => {
                i += try deleteFieldOnlyReal(&ctx) + 1;
            },
            types.ModOp.DELETE_PROP => {
                // special case
                i += try deleteField(&ctx) + 1;
            },
            types.ModOp.CREATE_PROP => {
                i += try createField(&ctx, operation) + offset;
            },
            types.ModOp.UPDATE_PROP => {
                i += try updateField(&ctx, operation) + offset;
            },
            types.ModOp.UPDATE_PARTIAL => {
                i += try updatePartialField(&ctx, operation) + offset;
            },
            else => {
                std.log.err("Something went wrong, incorrect modify operation\n", .{});
                break;
            },
        }
    }

    if (ctx.sortWriteTxn != null) {
        try sort.commitTxn(ctx.sortWriteTxn);
    }

    return null;
}
