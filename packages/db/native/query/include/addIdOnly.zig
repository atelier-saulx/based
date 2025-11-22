const QueryCtx = @import("../common.zig").QueryCtx;
const t = @import("../../types.zig");

pub fn addIdOnly(
    ctx: *QueryCtx,
    id: u32,
    score: ?[4]u8,
) !usize {
    try ctx.results.append(.{
        .id = id,
        .type = t.ResultType.default,
        .prop = @intFromEnum(t.ReadOp.ID), // id result enum
        .value = &.{},
        .score = score,
    });
    if (score != null) {
        return 9;
    }
    return 5;
}
