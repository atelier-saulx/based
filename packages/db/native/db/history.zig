const selva = @import("../selva.zig");
const napi = @import("../napi.zig");
const c = @import("../c.zig");
const std = @import("std");
const errors = @import("../errors.zig");

fn _historyCreate(env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(2, env, info);
    const pathname = try napi.get([]u8, env, args[0]);
    const entryByteSize: u16 = try napi.get(u16, env, args[1]);
    var histOut: ?*selva.struct_selva_history = null;
    std.debug.print("here we go... {any}\n", .{pathname});
    try errors.selva(selva.selva_history_create(pathname.ptr, @as(usize, entryByteSize), &histOut));
    return null;
}

pub fn historyCreate(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return _historyCreate(napi_env, info) catch |e| {
        std.log.err("Err {any} \n", .{e});
        _ = napi.jsThrow(napi_env, "historyCreate failed\n");
        return null;
    };
}
