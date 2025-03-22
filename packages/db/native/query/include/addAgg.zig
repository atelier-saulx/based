const QueryCtx = @import("../types.zig").QueryCtx;
const t = @import("../../types.zig");

pub fn addCount(
    ctx: *QueryCtx,
    value: ?[]u8,
) !usize {
    try ctx.results.append(.{
        .id = null,
        .field = @intFromEnum(t.ReadOp.AGGREGATION),
        .val = value,
        .refSize = null,
        .includeMain = &.{},
        .refType = null,
        .totalRefs = null,
        .score = null,
        .isEdge = t.Prop.NULL,
    });
    return 1 + 4 + (value orelse &[_]u8{}).len;
}
