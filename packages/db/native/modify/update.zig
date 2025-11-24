const std = @import("std");
const selva = @import("../selva/selva.zig").c;
const db = @import("../selva/db.zig");
const Node = @import("../selva/node.zig");
const sort = @import("../db/sort.zig");
const Modify = @import("./common.zig");
const utils = @import("../utils.zig");
const ModifyCtx = Modify.ModifyCtx;
const references = @import("./references.zig");
const reference = @import("./reference.zig");
const subs = @import("./subscription.zig");
const t = @import("../types.zig");

const read = utils.read;
const copy = utils.copy;

pub fn updateField(ctx: *ModifyCtx, data: []u8) !usize {
    if (ctx.node == null) {
        const len = read(u32, data, 0);
        return len;
    }

    subs.stage(ctx, subs.Op.update);

    switch (ctx.fieldType) {
        t.PropType.references => {
            switch (@as(t.RefOp, @enumFromInt(data[4]))) {
                // overwrite
                t.RefOp.overwrite => {
                    references.clearReferences(ctx);
                    return references.updateReferences(ctx, data);
                },
                // add
                t.RefOp.add => {
                    return references.updateReferences(ctx, data);
                },
                // delete
                t.RefOp.delete => {
                    return references.deleteReferences(ctx, data);
                },
                // put
                t.RefOp.putOverwrite => {
                    references.clearReferences(ctx);
                    return references.putReferences(ctx, data);
                },
                // put
                t.RefOp.putAdd => {
                    return references.putReferences(ctx, data);
                },
                else => {
                    const len = read(u32, data, 0);
                    return len;
                },
            }
        },
        t.PropType.reference => {
            return reference.updateReference(ctx, data);
        },
        t.PropType.vector => {
            const len = read(u32, data, 0);
            const padding = data[4];
            const slice = data[8 - padding .. len + 4];
            try db.setMicroBuffer(ctx.node.?, ctx.fieldSchema.?, slice);
            return len;
        },
        t.PropType.colVec => {
            const len = read(u32, data, 0);
            const padding = data[4];
            const slice = data[8 - padding .. len + 4];
            db.setColvec(ctx.typeEntry.?, ctx.id, ctx.fieldSchema.?, slice);
            return len;
        },
        t.PropType.cardinality => {
            const hllMode = if (data[0] == 0) true else false;
            const hllPrecision = data[1];
            const offset = 2;
            const len = read(u32, data, offset);
            var currentData = selva.selva_fields_get_selva_string(ctx.node.?, ctx.fieldSchema.?);
            if (currentData == null) {
                currentData = try db.ensurePropTypeString(ctx, ctx.fieldSchema.?);
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
                sort.remove(ctx.threadCtx.decompressor, ctx.currentSortIndex.?, currentCount[0..4], ctx.node.?);
                sort.insert(ctx.threadCtx.decompressor, ctx.currentSortIndex.?, newCount[0..4], ctx.node.?);
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

            if (ctx.field == t.MAIN_PROP) {
                if (ctx.typeSortIndex != null) {
                    var currentData: ?[]u8 = null;
                    var it = ctx.typeSortIndex.?.main.iterator();
                    while (it.next()) |entry| {
                        if (currentData == null) {
                            currentData = db.getField(ctx.typeEntry, ctx.node.?, ctx.fieldSchema.?, ctx.fieldType);
                        }
                        const sI = entry.value_ptr.*;
                        sort.remove(ctx.threadCtx.decompressor, sI, currentData.?, ctx.node.?);
                        sort.insert(ctx.threadCtx.decompressor, sI, slice, ctx.node.?);
                    }
                }
            } else if (ctx.currentSortIndex != null) {
                const currentData = db.getField(ctx.typeEntry, ctx.node.?, ctx.fieldSchema.?, ctx.fieldType);
                sort.remove(ctx.threadCtx.decompressor, ctx.currentSortIndex.?, currentData, ctx.node.?);
                sort.insert(ctx.threadCtx.decompressor, ctx.currentSortIndex.?, slice, ctx.node.?);
            }

            if (ctx.fieldType == t.PropType.text) {
                if (ctx.typeSortIndex != null and ctx.fieldType == t.PropType.text) {
                    const lang: t.LangCode = @enumFromInt(slice[0]);
                    const sIndex = sort.getSortIndex(ctx.db.sortIndexes.get(ctx.typeId), ctx.field, 0, lang);
                    if (sIndex) |sortIndex| {
                        const currentData: []u8 = db.getText(ctx.typeEntry, ctx.node.?, ctx.fieldSchema.?, ctx.fieldType, lang);
                        sort.remove(ctx.threadCtx.decompressor, sortIndex, currentData, ctx.node.?);
                        sort.insert(ctx.threadCtx.decompressor, sortIndex, slice, ctx.node.?);
                    }
                }
                try db.setText(ctx.node.?, ctx.fieldSchema.?, slice);
            } else if (ctx.fieldType == t.PropType.alias) {
                if (slice.len > 0) {
                    const old = try db.setAlias(ctx.typeEntry.?, ctx.id, ctx.field, slice);
                    if (old > 0) {
                        if (ctx.currentSortIndex != null) {
                            sort.remove(ctx.threadCtx.decompressor, ctx.currentSortIndex.?, slice, Node.getNode(ctx.typeEntry.?, old).?);
                        }
                        Modify.markDirtyRange(ctx, ctx.typeId, old);
                    }
                } else {
                    db.delAlias(ctx.typeEntry.?, ctx.id, ctx.field) catch |e| {
                        if (e != error.SELVA_ENOENT) return e;
                    };
                }
            } else {
                try db.writeField(ctx.node.?, ctx.fieldSchema.?, slice);
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
    const currentData = db.getField(ctx.typeEntry, ctx.node.?, ctx.fieldSchema.?, ctx.fieldType);
    if (currentData.len != 0) {
        var j: usize = 0;
        while (j < len) {
            const operation = slice[j..];
            const start = read(u16, operation, 0);
            const l = read(u16, operation, 2);
            if (ctx.field == 0) {
                subs.stagePartial(ctx, start);

                if (ctx.typeSortIndex != null) {
                    const sI = ctx.typeSortIndex.?.main.get(start);
                    if (sI != null) {
                        sort.remove(ctx.threadCtx.decompressor, sI.?, currentData, ctx.node.?);
                        copy(u8, currentData, operation[4 .. 4 + l], start);
                        sort.insert(ctx.threadCtx.decompressor, sI.?, currentData, ctx.node.?);
                    } else {
                        copy(u8, currentData, operation[4 .. 4 + l], start);
                    }
                } else {
                    copy(u8, currentData, operation[4 .. 4 + l], start);
                }
            } else if (ctx.currentSortIndex != null) {
                sort.remove(ctx.threadCtx.decompressor, ctx.currentSortIndex.?, currentData, ctx.node.?);
                sort.insert(ctx.threadCtx.decompressor, ctx.currentSortIndex.?, slice, ctx.node.?);
                copy(u8, currentData, operation[4 .. 4 + l], start);
                subs.stage(ctx, subs.Op.update);
            } else {
                copy(u8, currentData, operation[4 .. 4 + l], start);
                subs.stage(ctx, subs.Op.update);
            }
            j += 4 + l;
        }
    } else {
        std.log.err("Partial update id: {d} field: {d} does not exist \n", .{ ctx.id, ctx.field });
    }
    return len;
}

fn incrementBuf(
    op: t.ModOp,
    T: type,
    value: []u8,
    addition: []u8,
) usize {
    const a = read(T, value, 0);
    const b = read(T, addition, 0);
    if (T == f64) {
        const v: T = if (op == t.ModOp.decrement) a - b else a + b;
        value[0..8].* = @bitCast(v);
        return 8;
    } else if (T != f64) {
        const overflow = if (op == t.ModOp.decrement) @subWithOverflow(a, b) else @addWithOverflow(a, b);
        const v: T = if (overflow[1] == 1) a else overflow[0];
        const size = @sizeOf(T);
        value[0..size].* = @bitCast(v);
        return size;
    }
}

pub fn incrementBuffer(
    op: t.ModOp,
    fieldType: t.PropType,
    value: []u8,
    addition: []u8,
) usize {
    switch (fieldType) {
        t.PropType.int8 => {
            return incrementBuf(
                op,
                i8,
                value,
                addition,
            );
        },
        t.PropType.uint8 => {
            return incrementBuf(
                op,
                u8,
                value,
                addition,
            );
        },
        t.PropType.int16 => {
            return incrementBuf(
                op,
                i16,
                value,
                addition,
            );
        },
        t.PropType.uint16 => {
            return incrementBuf(
                op,
                u16,
                value,
                addition,
            );
        },
        t.PropType.int32 => {
            return incrementBuf(
                op,
                i32,
                value,
                addition,
            );
        },
        t.PropType.uint32 => {
            return incrementBuf(
                op,
                u32,
                value,
                addition,
            );
        },
        t.PropType.timestamp => {
            return incrementBuf(
                op,
                i64,
                value,
                addition,
            );
        },
        t.PropType.number => {
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

pub fn increment(ctx: *ModifyCtx, data: []u8, op: t.ModOp) !usize {
    const fieldType: t.PropType = @enumFromInt(read(u8, data, 0));

    // wastfull check
    const propSize = t.PropType.size(fieldType);

    if (ctx.node == null) {
        return propSize + 3;
    }

    const addition = data[3 .. 3 + propSize];

    const currentData = db.getField(ctx.typeEntry, ctx.node.?, ctx.fieldSchema.?, ctx.fieldType);
    const start = read(u16, data, 1);
    const value = currentData[start .. start + propSize];

    if (ctx.field == 0) {
        if (ctx.typeSortIndex != null) {
            const sI = ctx.typeSortIndex.?.main.get(start);
            if (sI != null) {
                sort.remove(ctx.threadCtx.decompressor, sI.?, currentData, ctx.node.?);
            }
        }
    } else if (ctx.currentSortIndex != null) {
        sort.remove(ctx.threadCtx.decompressor, ctx.currentSortIndex.?, value, ctx.node.?);
    }

    const size = incrementBuffer(op, fieldType, value, addition);
    if (ctx.field == 0) {
        subs.stagePartial(ctx, start);
        if (ctx.typeSortIndex != null) {
            const sI = ctx.typeSortIndex.?.main.get(start);
            if (sI != null) {
                sort.insert(ctx.threadCtx.decompressor, sI.?, currentData, ctx.node.?);
            }
        }
    } else {
        subs.stage(ctx, subs.Op.update);
        if (ctx.currentSortIndex != null) {
            sort.insert(ctx.threadCtx.decompressor, ctx.currentSortIndex.?, value, ctx.node.?);
        }
    }

    return size + 3;
}
