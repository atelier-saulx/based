const c = @import("./c.zig");
const napi = @import("./napi.zig");
const std = @import("std");
const selva = @import("./selva.zig");
const writeInt = @import("./utils.zig").writeInt;
const copy = @import("./utils.zig").copy;
const db = @import("./db/db.zig");

pub fn expireNapi(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    const args = napi.getArgs(2, env, info) catch return null;
    const dbCtx = napi.get(*db.DbCtx, env, args[0]) catch return null;
    expire(dbCtx);
    return null;
}

pub fn expire(dbCtx: *db.DbCtx) void {
    // Expire things before query
    selva.selva_db_expire_tick(dbCtx.selva, std.time.timestamp());
}
