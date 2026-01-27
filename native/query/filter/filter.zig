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
        var condition: *t.FilterCondition = undefined;
        // 255 means its unprepared - the condition new index will be set when aligned

        if (q[i] == 255) {
            const condSize = utils.read(u32, q, i + 3 + COND_ALIGN_BYTES);
            const totalSize = headerSize + condSize;

            q[i] = COND_ALIGN_BYTES - utils.alignLeft(t.FilterCondition, q[i + 1 .. i + totalSize]) + 1;
            condition = utils.readPtr(t.FilterCondition, q, q[i] + i);

            if (condition.op.compare != t.FilterOpCompare.nextOrIndex) {
                condition.fieldSchema = try Schema.getFieldSchema(typeEntry, condition.prop);
            }

            const nextI = q[i] + i + utils.sizeOf(t.FilterCondition);
            condition.offset = utils.alignLeftLen(condition.len, q[nextI .. totalSize + i]);
            const end = totalSize + i;

            switch (condition.op.compare) {
                .selectSmallRef => {
                    // make a util for this
                    const select = utils.readPtr(t.FilterSelect, q, i + q[i] + utils.sizeOf(t.FilterCondition) + @alignOf(t.FilterSelect) - condition.offset);
                    select.typeEntry = try Node.getType(ctx.db, select.typeId);

                    try prepare(q[end .. end + select.size], ctx, select.typeEntry);
                    i = end + select.size;
                },
                else => {
                    i = end;
                },
            }
        } else {
            condition = utils.readPtr(t.FilterCondition, q, q[i] + i + 1);
            const totalSize = headerSize + condition.size;
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
        const instruction = utils.readPtr(Instruction.CombinedOp, q, i + q[i]).*;
        pass = switch (instruction) {
            .nextOrIndex => blk: {
                nextOrIndex = utils.readPtr(u64, q, index + @alignOf(u64) - c.offset).*;
                break :blk true;
            },
            .selectLargeRef => blk: {
                break :blk true;
            },
            .selectSmallRef => blk: {
                // if edge can be a seperate thing
                const select = utils.readPtr(t.FilterSelect, q, index + @alignOf(t.FilterSelect) - c.offset);
                nextIndex += select.size;
                if (Node.getNode(select.typeEntry, utils.readPtr(u32, v, 0).*)) |refNode| {
                    break :blk recursionErrorBoundary(filter, refNode, ctx, q[nextIndex - select.size .. nextIndex]);
                } else {
                    break :blk false;
                }
            },
            .selectSmallRefs => blk: {
                break :blk true;
            },
            .selectLargeRefs => blk: {
                break :blk true;
            },
            inline else => |tag| blk: {
                const meta = comptime Instruction.parseOp(tag);
                const res = switch (meta.func) {
                    .Single => Compare.single(meta.cmp, meta.T, q, v, index, c),
                    .Range => Compare.range(meta.T, q, v, index, c),
                    .Batch => Compare.batch(meta.cmp, meta.T, q, v, index, c),
                    .BatchSmall => Compare.batchSmall(meta.cmp, meta.T, q, v, index, c),
                };
                break :blk if (meta.invert) !res else res;
            },
        };

        if (!pass) {
            i = nextOrIndex;
            nextOrIndex = q.len;
        } else {
            i = nextIndex;
        }
    }
    return pass;
}
