const QueryCtx = @import("../types.zig").QueryCtx;
const t = @import("../../types.zig");
const utils = @import("../../utils.zig");

pub fn addCount(ctx: *QueryCtx, value: ?[]u8, op: t.ReadOp) !usize {
    ctx.results.shrinkAndFree(1);

    try ctx.results.append(.{
        .id = null,
        .field = @intFromEnum(t.ReadOp.AGGREGATION),
        .val = value,
        .refSize = if (op == t.ReadOp.REFERENCES) 0 else null,
        .includeMain = &.{},
        .refType = if (op == t.ReadOp.REFERENCES) t.ReadRefOp.REFERENCES else null,
        .totalRefs = null,
        .score = null,
        .isEdge = if (op == t.ReadOp.REFERENCES) t.Prop.WEAK_REFERENCES else t.Prop.NULL,
    });
    return 1 + 4 + (value orelse &[_]u8{}).len;
}
