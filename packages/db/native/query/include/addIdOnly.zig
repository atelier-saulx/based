const QueryCtx = @import("../ctx.zig").QueryCtx;

pub fn addIdOnly(ctx: QueryCtx, id: u32, refLvl: u8, start: ?u16) !usize {
    try ctx.results.append(.{
        .id = id,
        .field = 255,
        .val = .{ .mv_size = 0, .mv_data = null },
        .start = start,
        .includeMain = &.{},
        .refLvl = refLvl,
    });
    return 5;
}
