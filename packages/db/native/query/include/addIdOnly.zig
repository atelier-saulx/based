const QueryCtx = @import("../types.zig").QueryCtx;
const t = @import("../../types.zig");

pub fn addIdOnly(
    ctx: *QueryCtx,
    id: u32,
    score: ?[4]u8,
) !usize {
    try ctx.results.append(.{
        .id = id,
        .type = t.ResultType.none,
        .field = @intFromEnum(t.ReadOp.ID), // id result enum
        .val = null,
        .score = score,
    });
    if (score != null) {
        return 9;
    }
    return 5;
}
