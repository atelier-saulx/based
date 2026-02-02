const std = @import("std");
const Query = @import("../common.zig");
const utils = @import("../../utils.zig");
const Node = @import("../../selva/node.zig");
const Schema = @import("../../selva/schema.zig");
const Fields = @import("../../selva/fields.zig");
const t = @import("../../types.zig");
const Compare = @import("compare.zig");
const Select = @import("select.zig");
const Instruction = @import("instruction.zig");
const COND_ALIGN_BYTES = @alignOf(t.FilterCondition);

pub fn prepare(
    q: []u8,
    ctx: *Query.QueryCtx,
    typeEntry: Node.Type,
) !void {
    var i: usize = 0;
    while (i < q.len) {
        const headerSize = COND_ALIGN_BYTES + 1 + utils.sizeOf(t.FilterCondition);
        var c: *t.FilterCondition = undefined;
        // 255 means its unprepared - the condition new index will be set when aligned

        if (q[i] == 255) {
            const condSize = utils.read(u32, q, i + 3 + COND_ALIGN_BYTES);
            const totalSize = headerSize + condSize;

            q[i] = COND_ALIGN_BYTES - utils.alignLeft(t.FilterCondition, q[i + 1 .. i + totalSize]) + 1;
            c = utils.readPtr(t.FilterCondition, q, q[i] + i);

            if (c.op.compare != t.FilterOpCompare.nextOrIndex) {
                c.fieldSchema = try Schema.getFieldSchema(typeEntry, c.prop);
            }

            const nextI = q[i] + i + utils.sizeOf(t.FilterCondition);

            c.offset = utils.alignLeftLen(c.len, q[nextI .. totalSize + i]);
            const end = totalSize + i;

            switch (c.op.compare) {
                .selectLargeRefEdge => {
                    // const select = utils.readPtr(t.FilterSelect, q, i + q[i] + utils.sizeOf(t.FilterCondition) + @alignOf(t.FilterSelect) - condition.offset);
                    // const edgeSelect = utils.readPtr(t.FilterSelect, q, i + q[i] + utils.sizeOf(t.FilterCondition) + @alignOf(t.FilterSelect) - condition.offset);
                    // select.typeEntry = try Node.getType(ctx.db, select.typeId);
                    // try prepare(q[end .. end + select.size], ctx, select.typeEntry);
                    // i = end + select.size;
                    i = end;
                },
                .selectRef => {
                    const select = utils.readPtr(t.FilterSelect, q, nextI + @alignOf(t.FilterSelect) - c.offset);
                    select.typeEntry = try Node.getType(ctx.db, select.typeId);
                    try prepare(q[end .. end + select.size], ctx, select.typeEntry);
                    i = end + select.size;
                },
                else => {
                    i = end;
                },
            }
        } else {
            c = utils.readPtr(t.FilterCondition, q, q[i] + i + 1);
            const totalSize = headerSize + c.size;
            const end = totalSize + i;
            i = end;
        }
        // if condition has type NOW we need to handle it
    }
}

pub fn recursionErrorBoundary(
    cb: anytype,
    node: Node.Node,
    ctx: *Query.QueryCtx,
    q: []u8,
) bool {
    return cb(node, ctx, q) catch |err| {
        std.debug.print("Filter: recursionErrorBoundary: Error {any} \n", .{err});
        return false;
    };
}

inline fn compare(
    T: type,
    comptime meta: Instruction.OpMeta,
    q: []u8,
    v: []u8,
    index: usize,
    c: *t.FilterCondition,
) bool {
    const res = switch (meta.func) {
        .eq => Compare.eq(T, q, v, index, c),
        .le => Compare.le(T, q, v, index, c),
        .lt => Compare.lt(T, q, v, index, c),
        .ge => Compare.ge(T, q, v, index, c),
        .gt => Compare.gt(T, q, v, index, c),
        .range => Compare.range(T, q, v, index, c),
        .eqBatch => Compare.eqBatch(T, q, v, index, c),
        .eqBatchSmall => Compare.eqBatchSmall(T, q, v, index, c),
    };
    return if (meta.invert) !res else res;
}

// Check if this becomes better
pub inline fn filter(node: Node.Node, ctx: *Query.QueryCtx, q: []u8) !bool {
    var i: usize = 0;
    var pass: bool = true;
    var v: []u8 = undefined;
    var prop: u8 = 255;
    var nextOrIndex: usize = q.len;
    while (i < nextOrIndex) {
        const c = utils.readPtr(t.FilterCondition, q, i + q[i]);
        const index = i + q[i] + utils.sizeOf(t.FilterCondition);
        var nextIndex = COND_ALIGN_BYTES + 1 + utils.sizeOf(t.FilterCondition) + c.size + i;

        if (prop != c.prop) {
            prop = c.prop;
            v = Fields.getRaw(node, c.fieldSchema);
        }

        pass = switch (c.op.compare) {
            .nextOrIndex => blk: {
                nextOrIndex = utils.readPtr(u64, q, index + @alignOf(u64) - c.offset).*;
                std.debug.print("hello OR {any} \n", .{nextOrIndex});
                break :blk true;
            },
            .selectRef => blk: {
                const select = utils.readPtr(t.FilterSelect, q, index + @alignOf(t.FilterSelect) - c.offset);
                nextIndex += select.size;
                if (Node.getNode(select.typeEntry, utils.readPtr(u32, v, 0).*)) |refNode| {
                    break :blk recursionErrorBoundary(filter, refNode, ctx, q[nextIndex - select.size .. nextIndex]);
                } else {
                    break :blk false;
                }
            },
            .selectSmallRefs, .selectLargeRefsEdge, .selectLargeRefEdge, .selectLargeRefs => blk: {
                break :blk true;
            },
            inline else => |op| blk: {
                const meta = comptime Instruction.parseOp(op);
                break :blk switch (c.op.prop) {
                    .id, .uint32, .int32 => compare(u32, meta, q, v, index, c),
                    .uint16, .int16 => compare(u16, meta, q, v, index, c),
                    .number => compare(f64, meta, q, v, index, c),
                    .timestamp => compare(u64, meta, q, v, index, c),
                    else => compare(u8, meta, q, v, index, c),
                };
            },
        };
        if (!pass) {
            i = nextOrIndex;
            nextOrIndex = q.len;
        } else {
            //
            i = nextIndex;
        }
    }
    return pass;
}
