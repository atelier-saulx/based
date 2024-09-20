const QueryCtx = @import("../ctx.zig").QueryCtx;

pub fn addIdOnly(ctx: *QueryCtx, id: u32) !usize {
    try ctx.results.append(.{
        .id = id,
        .field = 255,
        .val = null,
        .refSize = null,
        .includeMain = &.{},
        .refType = null,
        .totalRefs = null,
    });
    return 5;
}
