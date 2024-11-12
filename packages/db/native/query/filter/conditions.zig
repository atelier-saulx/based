const db = @import("../../db//db.zig");
const t = @import("./types.zig");
const Mode = t.Mode;
const Op = t.Operator;
const Type = t.Type;
const ConditionsResult = t.ConditionsResult;
const Prop = @import("../../types.zig").Prop;
const fillReferenceFilter = @import("./reference.zig").fillReferenceFilter;
const c = @import("./condition.zig");

inline fn condition(
    mode: Mode,
    ctx: *db.DbCtx,
    q: []u8,
    v: []u8,
    i: usize,
) ConditionsResult {
    return switch (mode) {
        Mode.default => c.default(q, v, i),
        Mode.defaultVar => c.defaultVar(q, v, i),
        Mode.andFixed => c.andFixed(q, v, i),
        Mode.orFixed => c.orFixed(q, v, i),
        // Mode.orVar => ,
        Mode.reference => c.reference(ctx, q, v, i),
        else => .{ 0, false },
    };
}

pub fn runConditions(ctx: *db.DbCtx, q: []u8, v: []u8) bool {
    var i: usize = 0;
    // const topLevelType: Type = @enumFromInt(q[i]);
    // std.debug.print("T: {any} \n", .{topLevelType});

    while (i < q.len) {
        i += 1;
        const mode: Mode = @enumFromInt(q[i]);
        const r = condition(mode, ctx, q, v, i);
        if (r[1] == false) {
            return false;
        }
        i += r[0];
    }
    return true;
}
