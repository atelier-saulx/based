const QueryCtx = @import("../ctx.zig").QueryCtx;

pub fn addIdOnly(ctx: QueryCtx, id: u32, refLvl: u8, start: ?u16) usize {
    ctx.results.append(.{
        .id = id,
        .field = 255,
        .val = null,
        .start = start,
        .includeMain = &.{},
        .refLvl = refLvl,
    }) catch {};
    return 5;
}
