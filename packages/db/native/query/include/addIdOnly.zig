const QueryCtx = @import("../ctx.zig").QueryCtx;
const t = @import("../../types.zig");

pub fn addIdOnly(ctx: *QueryCtx, id: u32) !usize {
    try ctx.results.append(.{
        .id = id,
        .field = 255, // id result enum
        .val = null,
        .refSize = null,
        .includeMain = &.{},
        .refType = null,
        .totalRefs = null,
        .isEdge = t.Prop.NULL,
    });
    return 5;
}
