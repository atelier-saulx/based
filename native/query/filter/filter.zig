const std = @import("std");
const Query = @import("../common.zig");
const utils = @import("../../utils.zig");
const Node = @import("../../selva/node.zig");
const Schema = @import("../../selva/schema.zig");
const Fields = @import("../../selva/fields.zig");
const t = @import("../../types.zig");
const Fixed = @import("./fixed.zig");
const Select = @import("./select.zig");

const COND_ALIGN_BYTES = @alignOf(t.FilterCondition);

pub fn prepare(
    q: []u8,
    _: *Query.QueryCtx,
    typeEntry: Node.Type,
) !void {
    var i: usize = 0;
    while (i < q.len) {
        const headerSize = COND_ALIGN_BYTES + 1 + utils.sizeOf(t.FilterCondition);
        var condition: *t.FilterCondition = undefined;
        // 255 means its unprepared - the condition new index will be set when aligned
        if (q[i] == 255) {
            const condSize = utils.read(u32, q, i + 1 + COND_ALIGN_BYTES);
            const totalSize = headerSize + condSize;
            q[i] = COND_ALIGN_BYTES - utils.alignLeft(t.FilterCondition, q[i + 1 .. i + totalSize]) + 1;
            condition = utils.readPtr(t.FilterCondition, q, q[i] + i);
            condition.fieldSchema = try Schema.getFieldSchema(typeEntry, condition.prop);
            const nextI = q[i] + i + utils.sizeOf(t.FilterCondition);
            condition.offset = utils.alignLeftLen(condition.len, q[nextI .. totalSize + i]);
            const end = totalSize + i;

            // Add reference select thing
            //     // .selectLargeRef, .selectSmallRef => {
            //     //     i += utils.sizeOf(t.FilterCondition);
            //     //     const selectReference = utils.readNext(t.FilterSelect, q, &i);
            //     //     prepare(q[i .. i + selectReference.size]);
            //     //     i += selectReference.size;
            //     // },

            i = end;
        } else {
            condition = utils.readPtr(t.FilterCondition, q, q[i] + i + 1);
        }
        // if condition has type NOW we need to handle it
        i += headerSize + condition.size;
    }
}

pub fn recursionErrorBoundary(
    cb: anytype,
    ctx: *Query.QueryCtx,
    q: []u8,
    value: []u8,
    i: *usize,
) bool {
    return cb(ctx, q, value, i) catch |err| {
        std.debug.print("Filter: recursionErrorBoundary: Error {any} \n", .{err});
        return false;
    };
}

pub inline fn filter(
    node: Node.Node,
    _: *Query.QueryCtx,
    q: []u8,
    typeEntry: Node.Type,
) !bool {
    var i: usize = 0;
    var pass: bool = true;
    var v: []u8 = undefined;
    var prop: u8 = 255;
    var nextOrIndex: usize = q.len;
    while (i < nextOrIndex) {
        const c = utils.readPtr(t.FilterCondition, q, i + q[i]);
        const index = i + q[i] + utils.sizeOf(t.FilterCondition);
        const nextIndex = COND_ALIGN_BYTES + 1 + utils.sizeOf(t.FilterCondition) + c.size;

        if (prop != c.prop) {
            prop = c.prop;
            v = Fields.get(typeEntry, node, c.fieldSchema, .null);
        }

        pass = switch (c.op) {
            .nextOrIndex => blk: {
                nextOrIndex = utils.readPtr(u32, q, index + c.len - c.offset).*;
                break :blk true;
            },

            // .selectLargeRef => {
            //     pass = recursionErrorBoundary(Select.largeRef, ctx, q, v, &i);
            // },

            // u32
            .eqU32 => Fixed.single(.eq, u32, q, v, index, c),
            .neqU32 => !Fixed.single(.eq, u32, q, v, index, c),
            .eqU32BatchSmall => Fixed.batchSmall(.eq, u32, q, v, index, c),
            .neqU32BatchSmall => !Fixed.batchSmall(.eq, u32, q, v, index, c),
            .eqU32Batch => Fixed.eqBatch(u32, q, v, index, c),
            .neqU32Batch => !Fixed.eqBatch(u32, q, v, index, c),

            .ltU32 => Fixed.single(.lt, u32, q, v, index, c),
            .leU32 => Fixed.single(.le, u32, q, v, index, c),
            .ltU32BatchSmall => Fixed.batchSmall(.lt, u32, q, v, index, c),
            .leU32BatchSmall => Fixed.batchSmall(.le, u32, q, v, index, c),
            .ltU32Batch => Fixed.batchSmall(.lt, u32, q, v, index, c),
            .leU32Batch => Fixed.batchSmall(.le, u32, q, v, index, c),

            .gtU32 => Fixed.single(.gt, u32, q, v, index, c),
            .geU32 => Fixed.single(.ge, u32, q, v, index, c),
            .gtU32BatchSmall => Fixed.batchSmall(.gt, u32, q, v, index, c),
            .geU32BatchSmall => Fixed.batchSmall(.ge, u32, q, v, index, c),
            .gtU32Batch => Fixed.batchSmall(.gt, u32, q, v, index, c),
            .geU32Batch => Fixed.batchSmall(.ge, u32, q, v, index, c),

            .rangeU32 => Fixed.range(u32, q, v, index, c),

            else => blk: {
                i = index;
                break :blk false;
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
