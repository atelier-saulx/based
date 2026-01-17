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

inline fn get(typeEntry: Node.Type, node: Node.Node, header: anytype) ![]u8 {
    return Fields.get(
        typeEntry,
        node,
        try Schema.getFieldSchema(typeEntry, header.prop),
        header.propType,
    );
}

pub inline fn prepare(
    q: []u8,
) void {
    var i: usize = 0;
    while (i < q.len) {
        const op: t.FilterOp = @enumFromInt(q[i]);
        switch (op) {
            .switchProp => {
                i += utils.sizeOf(t.FilterPropHeader);
            },
            .equals => {
                const condition = utils.readNext(t.FilterCondition, q, &i);
                switch (condition.propType) {
                    .uint32 => {
                        // maybe make the padding based on the actual value you are aligning
                        if (condition.alignOffset == 255) {
                            const offset = utils.alignLeft(u32, q[i - 4 .. i + 4]);
                            q[i - 9] = offset;
                            // condition.alignOffset = offset;
                        }
                        i += 4;
                    },
                    else => {},
                }
            },
            else => {},
        }
    }
}

pub inline fn filter(
    node: Node.Node,
    _: *Query.QueryCtx,
    q: []u8,
    typeEntry: Node.Type,
) !bool {
    var i: usize = 0;
    var value: []u8 = undefined;
    // const nextOrIndex: usize = q.len;
    while (i < q.len) {
        const op: t.FilterOp = @enumFromInt(q[i]);
        switch (op) {
            .switchProp => {
                const propHeader = utils.readNext(t.FilterPropHeader, q, &i);
                value = try get(typeEntry, node, &propHeader);
            },
            .equals => {
                const condition = utils.readNext(t.FilterCondition, q, &i);
                switch (condition.propType) {
                    .uint32 => {
                        if (utils.readAligned(u32, q, i - condition.alignOffset) !=
                            utils.readAligned(u32, value, condition.start))
                        {
                            return false;
                        }
                        i += 4;
                    },
                    else => {},
                }
            },
            else => {},
        }
    }

    return true;
}
