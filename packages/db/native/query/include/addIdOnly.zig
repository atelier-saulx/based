const QueryCtx = @import("../types.zig").QueryCtx;
const t = @import("../../types.zig");

pub fn addIdOnly(
    ctx: *QueryCtx,
    id: u32,
    score: ?[4]u8,
) !usize {
    try ctx.results.append(.{
        .id = id,
        .field = @intFromEnum(t.ReadOp.ID), // id result enum
        .val = null,
        .refSize = null,
        .includeMain = &.{},
        .refType = null,
        .totalRefs = null,
        .score = score,
        .isEdge = t.Prop.NULL,
        .isAggregate = false,
    });
    if (score != null) {
        return 9;
    }
    return 5;
}
