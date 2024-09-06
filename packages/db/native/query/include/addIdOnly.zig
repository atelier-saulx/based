const QueryCtx = @import("../ctx.zig").QueryCtx;

pub fn addIdOnly(ctx: *QueryCtx, id: u32, refLvl: u8, refField: ?u8) !usize {
    try ctx.results.append(.{
        .id = id,
        .field = 255,
        .val = null,
        .refField = refField,
        .includeMain = &.{},
        .refLvl = refLvl,
    });
    return 5;
}
