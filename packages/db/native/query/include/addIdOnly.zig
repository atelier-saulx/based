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
        .refSize = 0,
        .totalRefs = 0,
        .includeMain = &.{},
        .refType = t.ReadRefOp.none,
        .score = score,
        .isEdge = t.Prop.NULL,
    });
    if (score != null) {
        return 9;
    }
    return 5;
}
