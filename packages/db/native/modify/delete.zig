const std = @import("std");
const c = @import("../c.zig");
const errors = @import("../errors.zig");
const Envs = @import("../env/env.zig");
const napi = @import("../napi.zig");
const db = @import("../db/db.zig");
const dbSort = @import("../db/sort.zig");
const Modify = @import("./ctx.zig");

const ModifyCtx = Modify.ModifyCtx;
const getShard = Modify.getShard;

pub fn deleteField(ctx: ModifyCtx) usize {
    const shard = getShard(ctx);
    if (shard != null) {
        db.deleteField(ctx.id, shard) catch {};
    }
    return 0;
}
