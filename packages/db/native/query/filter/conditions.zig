const db = @import("../../db//db.zig");
const t = @import("./types.zig");
const Mode = t.Mode;
const Op = t.Operator;
const Type = t.Type;
const ConditionsResult = t.ConditionsResult;
const c = @import("./condition.zig");
const std = @import("std");
const selva = @import("../../selva.zig");

inline fn condition(
    mode: Mode,
    ctx: *db.DbCtx,
    node: *selva.SelvaNode,
    q: []u8,
    v: []u8,
    i: usize,
) ConditionsResult {
    return switch (mode) {
        Mode.default => c.default(q, v, i, node),
        Mode.defaultVar => c.defaultVar(q, v, i),
        Mode.andFixed => c.andFixed(q, v, i),
        Mode.orFixed => c.orFixed(q, v, i),
        Mode.reference => c.reference(ctx, q, v, i),
        else => .{ 0, false },
    };
}

pub inline fn runConditions(ctx: *db.DbCtx, node: *selva.SelvaNode, q: []u8, v: []u8) bool {
    var i: usize = 0;
    while (i < q.len) {
        const topLevelType: Type = @enumFromInt(q[i]);
        i += 1;
        const mode: Mode = @enumFromInt(q[i]);

        const result = condition(mode, ctx, node, q, v, i);
        if (topLevelType == Type.negate) {
            if (result[1] == true) {
                return false;
            }
        } else if (result[1] == false) {
            return false;
        }
        i += result[0];
    }
    return true;
}
