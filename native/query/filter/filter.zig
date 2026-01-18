const std = @import("std");
const Query = @import("../common.zig");
const utils = @import("../../utils.zig");
const Node = @import("../../selva/node.zig");
const Schema = @import("../../selva/schema.zig");
const Fields = @import("../../selva/fields.zig");
const t = @import("../../types.zig");

// prepare will return the next NOW
// it will also just fill in the current now
pub inline fn prepare(
    q: []u8,
) void {
    var i: usize = 0;
    while (i < q.len) {
        const op: t.FilterOp = @enumFromInt(q[i]);
        switch (op) {
            .nextOrIndex => {
                const condition = utils.readNext(t.FilterCondition, q, &i);
                if (condition.alignOffset == 255) {
                    q[i - 3] = utils.alignLeft(usize, q[i - 2 .. i + 14]);
                }
            },
            .equalsU32,
            .notEqualsU32,
            => {
                const condition = utils.readNext(t.FilterCondition, q, &i);
                if (condition.alignOffset == 255) {
                    q[i - 3] = utils.alignLeft(u32, q[i .. i + 8]);
                }
                i += 8;
            },
            else => {},
        }
    }
}

pub inline fn equalFixed(
    T: type,
    q: []u8,
    i: *usize,
    condition: *const t.FilterCondition,
    value: []u8,
) !bool {
    i.* += utils.sizeOf(T) + @alignOf(T);
    return utils.readAligned(u32, q, i.* - @alignOf(T) - condition.alignOffset) ==
        utils.readAligned(u32, value, condition.start);
}

// baseline
// pub inline fn filter(
//     _: Node.Node,
//     _: *Query.QueryCtx,
//     _: []u8,
//     _: Node.Type,
// ) !bool {
//     return false;
// }

pub inline fn filter(
    node: Node.Node,
    _: *Query.QueryCtx,
    q: []u8,
    typeEntry: Node.Type,
) !bool {
    var i: usize = 0;
    var pass: bool = true;
    var value: []u8 = undefined;
    var prop: u8 = 255; // tmp default
    var nextOrIndex: usize = q.len;
    while (i < q.len) {
        const op: t.FilterOp = @enumFromInt(q[i]);

        const condition = utils.readNext(t.FilterCondition, q, &i);
        if (prop != condition.prop) {
            prop = condition.prop;
            value = Fields.get(
                typeEntry,
                node,
                try Schema.getFieldSchema(typeEntry, condition.prop),
                .null,
            );
        }

        pass = switch (op) {
            .nextOrIndex => blk: {
                nextOrIndex = utils.readAligned(usize, q, i + 6 - condition.alignOffset);
                i += 14;
                break :blk true;
            },
            .equalsU32 => try equalFixed(u32, q, &i, &condition, value),
            .notEqualsU32 => !try equalFixed(u32, q, &i, &condition, value),
            else => false,
        };

        if (!pass) {
            i = nextOrIndex;
            nextOrIndex = q.len;
        }
    }
    return pass;
}
