const Query = @import("../common.zig");
const t = @import("../../types.zig");

pub fn addIdOnly(
    ctx: *Query.QueryCtx,
    id: u32,
    score: ?[4]u8,
) !usize {
    try ctx.results.append(.{
        .id = id,
        .type = t.ResultType.default,
        .prop = @intFromEnum(t.ReadOp.id), // id result enum
        .value = &.{},
        .score = score,
    });
    if (score != null) {
        return 9;
    }
    return 5;
}
