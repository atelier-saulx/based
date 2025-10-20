const std = @import("std");
const db = @import("../db/db.zig");
const sort = @import("../db/sort.zig");
const selva = @import("../selva.zig");
const Modify = @import("./ctx.zig");
const utils = @import("../utils.zig");
const ModifyCtx = Modify.ModifyCtx;
const references = @import("./references.zig");
const reference = @import("./reference.zig");
const types = @import("../types.zig");

const read = utils.read;
const copy = utils.copy;

pub fn updateField(ctx: *ModifyCtx, data: []u8) !usize {
    if (ctx.node == null) {
        const len = read(u32, data, 0);
        return len;
    }

    switch (ctx.fieldType) {
        types.Prop.REFERENCES => {
            switch (@as(types.RefOp, @enumFromInt(data[4]))) {
                // overwrite
                types.RefOp.OVERWRITE => {
                    references.clearReferences(ctx);
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
                    references.clearReferences(ctx);
                    return references.putReferences(ctx, data);
                },
                // put
                types.RefOp.PUT_ADD => {
                    return references.putReferences(ctx, data);
                },
                else => {
                    const len = read(u32, data, 0);
                    return len;
                },
            }
        },
        types.Prop.REFERENCE => {
            return reference.updateReference(ctx, data);
        },
        types.Prop.VECTOR => {
            const len = read(u32, data, 0);
            const padding = data[4];
            const slice = data[8 - padding .. len + 4];
            try db.setMicroBuffer(ctx.node.?, ctx.fieldSchema.?, slice);
            return len;
        },
        types.Prop.COLVEC => {
            const len = read(u32, data, 0);
            const padding = data[4];
            const slice = data[8 - padding .. len + 4];
            db.setColvec(ctx.typeEntry.?, ctx.id, ctx.fieldSchema.?, slice);
            return len;
        },
        types.Prop.CARDINALITY => {
            const hllMode = if (data[0] == 0) true else false;
            const hllPrecision = data[1];
            const offset = 2;
            const len = read(u32, data, offset);
            var currentData = selva.selva_fields_get_selva_string(ctx.node.?, ctx.fieldSchema.?);
            if (currentData == null) {
                currentData = try db.ensurePropString(ctx, ctx.fieldSchema.?);
                selva.hll_init(currentData, hllPrecision, hllMode);
            }
            var i: usize = 4 + offset;
            const currentCount = if (ctx.currentSortIndex != null) selva.hll_count(currentData) else undefined;
            while (i < (len * 8) + offset) {
                const hash: u64 = read(u64, data, i);
                selva.hll_add(currentData, hash);
                i += 8;
            }
            if (ctx.currentSortIndex != null) {
                const newCount = selva.hll_count(currentData);
                sort.remove(ctx.db, ctx.currentSortIndex.?, currentCount[0..4], ctx.node.?);
                sort.insert(ctx.db, ctx.currentSortIndex.?, newCount[0..4], ctx.node.?);
            }
            return len * 8;
        },
        else => {
            const len = read(u32, data, 0);
            if (ctx.node == null) {
                std.log.err("Field update id: {d} node does not exist \n", .{ctx.id});
                return len;
            }
            const slice = data[4 .. len + 4];

            if (ctx.field == types.MAIN_PROP) {
                if (ctx.typeSortIndex != null) {
                    var currentData: ?[]u8 = null;
                    var it = ctx.typeSortIndex.?.main.iterator();
                    while (it.next()) |entry| {
                        if (currentData == null) {
                            currentData = db.getField(ctx.typeEntry, ctx.id, ctx.node.?, ctx.fieldSchema.?, ctx.fieldType);
                        }
                        const sI = entry.value_ptr.*;
                        sort.remove(ctx.db, sI, currentData.?, ctx.node.?);
                        sort.insert(ctx.db, sI, slice, ctx.node.?);
                    }
                }
            } else if (ctx.currentSortIndex != null) {
                const currentData = db.getField(ctx.typeEntry, ctx.id, ctx.node.?, ctx.fieldSchema.?, ctx.fieldType);
                sort.remove(ctx.db, ctx.currentSortIndex.?, currentData, ctx.node.?);
                sort.insert(ctx.db, ctx.currentSortIndex.?, slice, ctx.node.?);
            }

            if (ctx.fieldType == types.Prop.TEXT) {
                if (ctx.typeSortIndex != null and ctx.fieldType == types.Prop.TEXT) {
                    const lang: types.LangCode = @enumFromInt(slice[0]);
                    const sIndex = sort.getSortIndex(ctx.db.sortIndexes.get(ctx.typeId), ctx.field, 0, lang);
                    if (sIndex) |sortIndex| {
                        const currentData: []u8 = db.getText(ctx.typeEntry, ctx.id, ctx.node.?, ctx.fieldSchema.?, ctx.fieldType, lang);
                        sort.remove(ctx.db, sortIndex, currentData, ctx.node.?);
                        sort.insert(ctx.db, sortIndex, slice, ctx.node.?);
                    }
                }
                try db.setText(slice, ctx.node.?, ctx.fieldSchema.?);
            } else if (ctx.fieldType == types.Prop.ALIAS) {
                if (slice.len > 0) {
                    const old = try db.setAlias(ctx.typeEntry.?, ctx.id, ctx.field, slice);
                    if (old > 0) {
                        if (ctx.currentSortIndex != null) {
                            sort.remove(ctx.db, ctx.currentSortIndex.?, slice, db.getNode(ctx.typeEntry.?, old).?);
                        }
                        Modify.markDirtyRange(ctx, ctx.typeId, old);
                    }
                } else {
                    db.delAlias(ctx.typeEntry.?, ctx.id, ctx.field) catch |e| {
                        if (e != error.SELVA_ENOENT) return e;
                    };
                }
            } else {
                try db.writeField(slice, ctx.node.?, ctx.fieldSchema.?);
            }

            return len;
        },
    }
}

pub fn updatePartialField(ctx: *ModifyCtx, data: []u8) !usize {
    const len = read(u32, data, 0);
    if (ctx.node == null) {
        return len;
    }
    const slice = data[4 .. len + 4];
    var currentData = db.getField(ctx.typeEntry, ctx.id, ctx.node.?, ctx.fieldSchema.?, ctx.fieldType);
    if (currentData.len != 0) {
        var j: usize = 0;
        while (j < len) {
            const operation = slice[j..];
            const start = read(u16, operation, 0);
            const l = read(u16, operation, 2);
            if (ctx.field == 0) {
                if (ctx.typeSortIndex != null) {
                    const sI = ctx.typeSortIndex.?.main.get(start);
                    if (sI != null) {
                        sort.remove(ctx.db, sI.?, currentData, ctx.node.?);
                        copy(currentData[start .. start + l], operation[4 .. 4 + l]);
                        sort.insert(ctx.db, sI.?, currentData, ctx.node.?);
                    } else {
                        copy(currentData[start .. start + l], operation[4 .. 4 + l]);
                    }
                } else {
                    copy(currentData[start .. start + l], operation[4 .. 4 + l]);
                }
            } else if (ctx.currentSortIndex != null) {
                sort.remove(ctx.db, ctx.currentSortIndex.?, currentData, ctx.node.?);
                sort.insert(ctx.db, ctx.currentSortIndex.?, slice, ctx.node.?);
                copy(currentData[start .. start + l], operation[4 .. 4 + l]);
            } else {
                copy(currentData[start .. start + l], operation[4 .. 4 + l]);
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
    value: []u8,
    addition: []u8,
) usize {
    const a = read(T, value, 0);
    const b = read(T, addition, 0);
    if (T == f64) {
        const v: T = if (op == types.ModOp.DECREMENT) a - b else a + b;
        value[0..8].* = @bitCast(v);
        return 8;
    } else if (T != f64) {
        const overflow = if (op == types.ModOp.DECREMENT) @subWithOverflow(a, b) else @addWithOverflow(a, b);
        const v: T = if (overflow[1] == 1) a else overflow[0];
        const size = @sizeOf(T);
        value[0..size].* = @bitCast(v);
        return size;
    }
}

pub fn incrementBuffer(
    op: types.ModOp,
    fieldType: types.Prop,
    value: []u8,
    addition: []u8,
) usize {
    switch (fieldType) {
        types.Prop.INT8 => {
            return incrementBuf(
                op,
                i8,
                value,
                addition,
            );
        },
        types.Prop.UINT8 => {
            return incrementBuf(
                op,
                u8,
                value,
                addition,
            );
        },
        types.Prop.INT16 => {
            return incrementBuf(
                op,
                i16,
                value,
                addition,
            );
        },
        types.Prop.UINT16 => {
            return incrementBuf(
                op,
                u16,
                value,
                addition,
            );
        },
        types.Prop.INT32 => {
            return incrementBuf(
                op,
                i32,
                value,
                addition,
            );
        },
        types.Prop.UINT32 => {
            return incrementBuf(
                op,
                u32,
                value,
                addition,
            );
        },
        types.Prop.TIMESTAMP => {
            return incrementBuf(
                op,
                i64,
                value,
                addition,
            );
        },
        types.Prop.NUMBER => {
            return incrementBuf(
                op,
                f64,
                value,
                addition,
            );
        },
        else => {
            return 0;
        },
    }
}

pub fn increment(ctx: *ModifyCtx, data: []u8, op: types.ModOp) !usize {
    const fieldType: types.Prop = @enumFromInt(read(u8, data, 0));

    // wastfull check
    const propSize = types.Size(fieldType);

    if (ctx.node == null) {
        return propSize + 3;
    }

    const addition = data[3 .. 3 + propSize];

    const currentData = db.getField(ctx.typeEntry, ctx.id, ctx.node.?, ctx.fieldSchema.?, ctx.fieldType);
    const start = read(u16, data, 1);
    const value = currentData[start .. start + propSize];

    if (ctx.field == 0) {
        if (ctx.typeSortIndex != null) {
            const sI = ctx.typeSortIndex.?.main.get(start);
            if (sI != null) {
                sort.remove(ctx.db, sI.?, currentData, ctx.node.?);
            }
        }
    } else if (ctx.currentSortIndex != null) {
        sort.remove(ctx.db, ctx.currentSortIndex.?, value, ctx.node.?);
    }

    const size = incrementBuffer(op, fieldType, value, addition);
    if (ctx.field == 0) {
        if (ctx.typeSortIndex != null) {
            const sI = ctx.typeSortIndex.?.main.get(start);
            if (sI != null) {
                sort.insert(ctx.db, sI.?, currentData, ctx.node.?);
            }
        }
    } else if (ctx.currentSortIndex != null) {
        sort.insert(ctx.db, ctx.currentSortIndex.?, value, ctx.node.?);
    }

    return size + 3;
}
