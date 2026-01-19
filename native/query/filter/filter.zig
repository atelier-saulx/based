const std = @import("std");
const Query = @import("../common.zig");
const utils = @import("../../utils.zig");
const Node = @import("../../selva/node.zig");
const Schema = @import("../../selva/schema.zig");
const Fields = @import("../../selva/fields.zig");
const t = @import("../../types.zig");
const Fixed = @import("./fixed.zig");
const Select = @import("./select.zig");

fn alignSingle(T: type, q: []u8, i: *usize) void {
    const size = utils.sizeOf(T) + @alignOf(T);
    const condition = utils.readNext(t.FilterCondition, q, i);
    if (condition.alignOffset == 255) {
        q[i.* - 3] = utils.alignLeft(T, q[i.* .. i.* + size]);
    }
    i.* += size;
}

fn alignBatch(T: type, q: []u8, i: *usize) void {
    const condition = utils.readNext(t.FilterCondition, q, i);
    const len = utils.readNext(u16, q, i);
    if (condition.alignOffset == 255) {
        q[i.* - 5] = utils.alignLeft(T, q[i.* .. i.* + len * utils.sizeOf(T) + @alignOf(T) + 16]);
    }
    // Always 16 bytes padding (can become slightly more efficient)
    i.* += len * utils.sizeOf(T) + @alignOf(T) + 16;
}

// prepare will return the next NOW
// it will also just fill in the current now
pub fn prepare(
    q: []u8,
) void {
    var i: usize = 0;
    while (i < q.len) {
        const op: t.FilterOp = @enumFromInt(q[i]);
        switch (op) {
            .nextOrIndex => alignSingle(usize, q, &i),
            .selectLargeRef, .selectSmallRef => {
                i += utils.sizeOf(t.FilterCondition);
                const selectReference = utils.readNext(t.FilterSelect, q, &i);
                prepare(q[i .. i + selectReference.size]);
                i += selectReference.size;
            },
            .equalsU32, .notEqualsU32 => alignSingle(u32, q, &i),
            .equalsU32Or, .notEqualsU32Or => alignBatch(u32, q, &i),
            else => {},
        }
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
    ctx: *Query.QueryCtx,
    q: []u8,
    typeEntry: Node.Type,
) !bool {
    var i: usize = 0;
    var pass: bool = true;
    var v: []u8 = undefined;
    var prop: u8 = 255;
    var nextOrIndex: usize = q.len;
    while (i < nextOrIndex) {
        const op: t.FilterOp = @enumFromInt(q[i]);

        const condition = utils.readNext(t.FilterCondition, q, &i);
        if (prop != condition.prop) {
            prop = condition.prop;
            v = Fields.get(
                typeEntry,
                node,
                try Schema.getFieldSchema(typeEntry, condition.prop),
                .null,
            );
        }

        pass = switch (op) {
            .nextOrIndex => blk: {
                nextOrIndex = utils.readNextAligned(usize, q, &i, condition.alignOffset);
                break :blk true;
            },
            .selectLargeRef => recursionErrorBoundary(Select.largeRef, ctx, q, v, &i),

            .equalsU32 => try Fixed.equal(u32, q, &i, &condition, v),
            .notEqualsU32 => !try Fixed.equal(u32, q, &i, &condition, v),
            .equalsU32Or => try Fixed.equalOr(u32, q, &i, &condition, v),
            .notEqualsU32Or => !try Fixed.equalOr(u32, q, &i, &condition, v),
            else => false,
        };

        if (!pass) {
            i = nextOrIndex;
            nextOrIndex = q.len;
        }
    }
    return pass;
}
