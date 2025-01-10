const std = @import("std");
const db = @import("../db/db.zig");
const sort = @import("../db/sort.zig");
const Modify = @import("./ctx.zig");
const readInt = @import("../utils.zig").readInt;
const ModifyCtx = Modify.ModifyCtx;
// const getSortIndex = Modify.getSortIndex;
const references = @import("./references.zig");
const reference = @import("./reference.zig");
const types = @import("../types.zig");

pub fn updateField(ctx: *ModifyCtx, data: []u8) !usize {
    switch (ctx.fieldType) {
        types.Prop.REFERENCES => {
            switch (@as(types.RefOp, @enumFromInt(data[4]))) {
                // overwrite
                types.RefOp.OVERWRITE => {
                    db.clearReferences(ctx.db, ctx.node.?, ctx.fieldSchema.?);
                    return references.updateReferences(ctx, data);
                },
                // add
                types.RefOp.ADD => {
                    return references.updateReferences(ctx, data);
                },
                // delete
                types.RefOp.DELETE => {
                    return references.deleteReferences(ctx, data);
                },
                // put
                types.RefOp.PUT_OVERWRITE => {
                    db.clearReferences(ctx.db, ctx.node.?, ctx.fieldSchema.?);
                    return references.putReferences(ctx, data);
                },
                // put
                types.RefOp.PUT_ADD => {
                    return references.putReferences(ctx, data);
                },
                else => {
                    const len = readInt(u32, data, 0);
                    return len;
                },
            }
        },
        types.Prop.REFERENCE => {
            return reference.updateReference(ctx, data);
        },
        else => {
            const len = readInt(u32, data, 0);
            if (ctx.node == null) {
                std.log.err("Field update id: {d} node does not exist \n", .{ctx.id});
                return len;
            }

            const slice = data[4 .. len + 4];
            if (ctx.field == 0) {
                if (ctx.typeSortIndex != null) {
                    var currentData: ?[]u8 = null;
                    var it = ctx.typeSortIndex.?.main.iterator();
                    while (it.next()) |entry| {
                        if (currentData == null) {
                            currentData = db.getField(ctx.typeEntry, ctx.id, ctx.node.?, ctx.fieldSchema.?);
                        }
                        const sI = entry.value_ptr.*;
                        sort.remove(ctx.db, sI, currentData.?, ctx.node.?);
                        sort.insert(ctx.db, sI, slice, ctx.node.?);
                    }
                }
            } else if (ctx.currentSortIndex != null) {
                const currentData = db.getField(ctx.typeEntry, ctx.id, ctx.node.?, ctx.fieldSchema.?);
                sort.remove(ctx.db, ctx.currentSortIndex.?, currentData, ctx.node.?);
                sort.insert(ctx.db, ctx.currentSortIndex.?, slice, ctx.node.?);
            }
            if (ctx.fieldType == types.Prop.ALIAS) {
                try db.setAlias(ctx.id, ctx.field, slice, ctx.typeEntry.?);
            } else {
                try db.writeField(ctx.db, slice, ctx.node.?, ctx.fieldSchema.?);
            }

            return len;
        },
    }
}

pub fn updatePartialField(ctx: *ModifyCtx, data: []u8) !usize {
    const len = readInt(u32, data, 0);
    if (ctx.node == null) {
        std.log.err("Partial update id: {d} node does not exist \n", .{ctx.id});
        return len;
    }
    const slice = data[4 .. len + 4];
    var currentData = db.getField(ctx.typeEntry, ctx.id, ctx.node.?, ctx.fieldSchema.?);
    if (currentData.len != 0) {
        var j: usize = 0;
        while (j < len) {
            const operation = slice[j..];
            const start = readInt(u16, operation, 0);
            const l = readInt(u16, operation, 2);
            if (ctx.field == 0) {
                if (ctx.typeSortIndex != null) {
                    const sI = ctx.typeSortIndex.?.main.get(start);
                    if (sI != null) {
                        sort.remove(ctx.db, sI.?, currentData, ctx.node.?);
                        sort.insert(ctx.db, sI.?, slice[4..], ctx.node.?);
                    }
                }
                @memcpy(currentData[start .. start + l], operation[4 .. 4 + l]);
            } else if (ctx.currentSortIndex != null) {
                sort.remove(ctx.db, ctx.currentSortIndex.?, currentData, ctx.node.?);
                sort.insert(ctx.db, ctx.currentSortIndex.?, slice, ctx.node.?);
                @memcpy(currentData[start .. start + l], operation[4 .. 4 + l]);
            } else {
                @memcpy(currentData[start .. start + l], operation[4 .. 4 + l]);
            }
            j += 4 + l;
        }
    } else {
        std.log.err("Partial update id: {d} field: {d} does not exist \n", .{ ctx.id, ctx.field });
    }
    return len;
}

fn incrementBuf(
    op: types.ModOp,
    T: type,
    aU8: []u8,
    bU8: []u8,
) usize {
    const a = readInt(T, aU8, 0);
    const b = readInt(T, bU8, 0);
    const v: T = if (op == types.ModOp.DECREMENT) a - b else a + b;
    if (T == f64) {
        aU8[0..8].* = @bitCast(v);
        return 8;
    } else {
        const size = @divExact(@typeInfo(T).Int.bits, 8);
        aU8[0..size].* = @bitCast(v);
        return size;
    }
}

pub fn increment(ctx: *ModifyCtx, data: []u8, op: types.ModOp) !usize {
    const currentData = db.getField(ctx.typeEntry, ctx.id, ctx.node.?, ctx.fieldSchema.?);
    const fieldType: types.Prop = @enumFromInt(readInt(u8, data, 0));
    const start = readInt(u16, data, 1);
    const addition = data[3..];
    const value = currentData[start .. start + addition.len];
    var size: usize = 0;

    if (ctx.field == 0) {
        if (ctx.typeSortIndex != null) {
            const sI = ctx.typeSortIndex.?.main.get(start);
            if (sI != null) {
                sort.remove(ctx.db, sI.?, value, ctx.node.?);
            }
        }
    } else if (ctx.currentSortIndex != null) {
        sort.remove(ctx.db, ctx.currentSortIndex.?, value, ctx.node.?);
    }

    switch (fieldType) {
        types.Prop.INT8 => {
            size = incrementBuf(
                op,
                i8,
                value,
                addition,
            );
        },
        types.Prop.UINT8 => {
            size = incrementBuf(
                op,
                u8,
                value,
                addition,
            );
        },
        types.Prop.INT16 => {
            size = incrementBuf(
                op,
                i16,
                value,
                addition,
            );
        },
        types.Prop.UINT16 => {
            size = incrementBuf(
                op,
                u16,
                value,
                addition,
            );
        },
        types.Prop.INT32 => {
            size = incrementBuf(
                op,
                i32,
                value,
                addition,
            );
        },
        types.Prop.UINT32 => {
            size = incrementBuf(
                op,
                u32,
                value,
                addition,
            );
        },
        types.Prop.UINT64 => {
            size = incrementBuf(
                op,
                u64,
                value,
                addition,
            );
        },
        types.Prop.INT64, types.Prop.TIMESTAMP => {
            size = incrementBuf(
                op,
                i64,
                value,
                addition,
            );
        },
        types.Prop.NUMBER => {
            size = incrementBuf(
                op,
                f64,
                value,
                addition,
            );
        },
        else => {},
    }

    if (ctx.field == 0) {
        if (ctx.typeSortIndex != null) {
            const sI = ctx.typeSortIndex.?.main.get(start);
            if (sI != null) {
                sort.insert(ctx.db, sI.?, value, ctx.node.?);
            }
        }
    } else if (ctx.currentSortIndex != null) {
        sort.insert(ctx.db, ctx.currentSortIndex.?, value, ctx.node.?);
    }

    return size + 3;
}
