const std = @import("std");
const Query = @import("../common.zig");
const utils = @import("../../utils.zig");
const Node = @import("../../selva/node.zig");
// const Thread = @import("../../thread/thread.zig");
const Schema = @import("../../selva/schema.zig");
const Fields = @import("../../selva/fields.zig");
const t = @import("../../types.zig");
// const multiple = @import("../multiple.zig");
// const References = @import("../../selva/references.zig");

// inline fn get(typeEntry: Node.Type, node: Node.Node, header: anytype) ![]u8 {
//     return Fields.get(
//         typeEntry,
//         node,
//         try Schema.getFieldSchema(typeEntry, header.prop),
//         header.propType,
//     );
// }

pub inline fn prepare(
    q: []u8,
) void {
    var i: usize = 0;
    while (i < q.len) {
        const op: t.FilterOp = @enumFromInt(q[i]);
        switch (op) {
            .equalsU32 => {
                const condition = utils.readNext(t.FilterCondition, q, &i);
                if (condition.alignOffset == 255) {
                    q[i - 1] = utils.alignLeft(u32, q[i .. i + 8]);
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

pub inline fn filter(
    node: Node.Node,
    _: *Query.QueryCtx,
    q: []u8,
    typeEntry: Node.Type,
) !bool {
    var i: usize = 0;
    var pass: bool = true;
    var value: []u8 = undefined;
    var prop: u8 = 255;
    const nextOrIndex: usize = q.len;
    while (i < q.len) {
        const op: t.FilterOp = @enumFromInt(q[i]);
        const condition = utils.readNext(t.FilterCondition, q, &i);
        if (prop != condition.prop) {
            // this will be used to avoid this get if its not applicable for the condition
            prop = condition.prop;
            value = Fields.get(
                typeEntry,
                node,
                try Schema.getFieldSchema(typeEntry, condition.prop),
                .null,
            );
        }
        pass = switch (op) {
            .equalsU32 => try equalFixed(u32, q, &i, &condition, value),
            .notEqualsU32 => !try equalFixed(u32, q, &i, &condition, value),
            // .equalsU32Or =>
            // .notEqualsU32Or =>
            else => false,
        };
        if (pass == false) {
            i = nextOrIndex;
        }
    }
    return pass;
}
