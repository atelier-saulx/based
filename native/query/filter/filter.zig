const std = @import("std");
const Query = @import("../common.zig");
const utils = @import("../../utils.zig");
const Node = @import("../../selva/node.zig");
const Schema = @import("../../selva/schema.zig");
const Fields = @import("../../selva/fields.zig");
const t = @import("../../types.zig");
const Fixed = @import("./fixed.zig");
const Select = @import("./select.zig");

// fn alignSingle(T: type, q: []u8, i: *usize) void {
//     const size = utils.sizeOf(T) + 9 + utils.sizeOf(t.FilterCondition);
//     const alignOffset = q[0];
//     if (alignOffset == 255) {
//         // std.debug.print("hello")
//         q[i.*] = 8 - utils.alignLeft(T, q[i.* + 1 .. i.* + size]);
//     }
//     i.* += size;
// }

// fn alignBatch(T: type, q: []u8, i: *usize) void {
//     const condition = utils.readNext(t.FilterCondition, q, i);
//     // make this u32
//     const len = utils.readNext(u32, q, i);
//     if (condition.alignOffset == 255) {
//         q[i.* - 7] = utils.alignLeft(T, q[i.* .. i.* + len * utils.sizeOf(T) + @alignOf(T) + 16]);
//     }
//     // Always 16 bytes padding (can become slightly more efficient)
//     i.* += len * utils.sizeOf(T) + @alignOf(T) + 16;
// }

// fn alignSmallBatch(T: type, q: []u8, i: *usize) void {
//     const condition = utils.readNext(t.FilterCondition, q, i);
//     if (condition.alignOffset == 255) {
//         q[i.* - 3] = utils.alignLeft(T, q[i.* .. i.* + @alignOf(T) + 16]);
//     }
//     // Always 16 bytes padding (can become slightly more efficient)
//     i.* += @alignOf(T) + 16;
// }

// prepare will return the next NOW
// it will also just fill in the current now
pub fn prepare(
    q: []u8,
    _: *Query.QueryCtx,
    typeEntry: Node.Type,
) !void {
    var i: usize = 0;
    while (i < q.len) {
        // const op: t.FilterOp = @enumFromInt(q[i]);
        const size = utils.sizeOf(u32) + 16 + 1 + utils.sizeOf(t.FilterCondition);
        // std.debug.print("derp {any} \n", .{size});
        if (q[i] == 255) {
            q[i] = 16 - utils.alignLeft(t.FilterCondition, q[i + 1 .. i + size]);
            var condition = utils.readPtr(t.FilterCondition, q, q[i] + i + 1);
            condition.fieldSchema = try Schema.getFieldSchema(typeEntry, condition.prop);
            // std.debug.print("derp {any} {any} \n", .{ q, condition });
        }
        i += size;
        // switch (op) {
        //     // .nextOrIndex => alignSingle(usize, q, &i),
        //     // .selectLargeRef, .selectSmallRef => {
        //     //     i += utils.sizeOf(t.FilterCondition);
        //     //     const selectReference = utils.readNext(t.FilterSelect, q, &i);
        //     //     prepare(q[i .. i + selectReference.size]);
        //     //     i += selectReference.size;
        //     // },
        //     .eqU32, .neqU32 => alignSingle(u32, q, &i),
        //     // .eqU32Batch, .neqU32Batch => alignBatch(u32, q, &i),
        //     // .eqU32BatchSmall, .neqU32BatchSmall => alignSmallBatch(u32, q, &i),
        //     else => {},
        // }
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
        const condition = utils.readPtr(t.FilterCondition, q, i + 1 + q[i]);
        const next = i + utils.sizeOf(t.FilterCondition) + 16 + 1;

        if (prop != condition.prop) {
            prop = condition.prop;
            v = Fields.get(
                typeEntry,
                node,
                condition.fieldSchema,
                // try Schema.getFieldSchema(typeEntry, condition.prop),
                .null,
            );
        }

        pass = switch (condition.op) {
            // .nextOrIndex => {
            //     nextOrIndex = utils.readNextAligned(usize, q, &i, condition.alignOffset);
            //     pass = true;
            // },

            // .selectLargeRef => {
            //     pass = recursionErrorBoundary(Select.largeRef, ctx, q, v, &i);
            // },

            .eqU32 => blk: {
                const target = utils.readPtr(u32, q, next + q[0] - 16);
                const val = utils.readPtr(u32, v, condition.start);
                i = next + 4;
                break :blk (val.* == target.*);
            },
            .neqU32 => blk: {
                const target = utils.readPtr(u32, q, next + q[0] - 16);
                const val = utils.readPtr(u32, v, condition.start);
                i = next + 4;
                break :blk (val.* != target.*);
            },

            // .neqU32 => !try Fixed.eq(u32, q, &i, &condition, v),
            // .eqU32Batch => try Fixed.eqBatch(u32, q, &i, &condition, v),
            // .neqU32Batch => !try Fixed.eqBatch(u32, q, &i, &condition, v),
            // .eqU32BatchSmall => try Fixed.eqBatchSmall(u32, q, &i, &condition, v),
            // .neqU32BatchSmall => !try Fixed.eqBatchSmall(u32, q, &i, &condition, v),

            else => blk: {
                i = next;
                break :blk false;
            },
        };

        if (!pass) {
            i = nextOrIndex;
            nextOrIndex = q.len;
        }
    }
    return pass;
}
