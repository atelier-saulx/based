const std = @import("std");
const c = @import("../c.zig");
const errors = @import("../errors.zig");
const Envs = @import("../env/env.zig");
const napi = @import("../napi.zig");
const db = @import("../db/db.zig");
const dbSort = @import("../db/sort.zig");
const Modify = @import("./ctx.zig");

const ModifyCtx = Modify.ModifyCtx;
const getOrCreateShard = Modify.getOrCreateShard;

pub fn deleteField(ctx: *ModifyCtx) !usize {
    const shard = try getOrCreateShard(ctx);
    db.deleteField(ctx.id, shard) catch {};
    return 0;
}
