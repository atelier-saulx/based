const c = @import("../c.zig");
const db = @import("db.zig");
const errors = @import("../errors.zig");
const napi = @import("../napi.zig");
const selva = @import("../selva.zig");
const std = @import("std");

pub fn load(filename: [:0]u8) !void {
    try errors.selva(selva.selva_dump_load(filename.ptr, &db.ctx.selva));
}

pub fn save(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    const args = napi.getArgs(1, napi_env, info) catch return null;
    const sdb_filename = napi.get([]u8, napi_env, args[0]) catch return null;
    var result: c.napi_value = null;
    const pid = selva.selva_dump_save_async(db.ctx.selva, sdb_filename.ptr);
    if (pid < 0) {
        errors.selva(pid) catch return null;
    }
    _ = c.napi_create_int32(napi_env, pid, &result);
    return result;
}

pub fn isReady(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    const args = napi.getArgs(3, napi_env, info) catch return null;
    const pid = napi.get(i32, napi_env, args[0]) catch return null;
    const sdb_filename = napi.get([]u8, napi_env, args[1]) catch return null;
    const err_msg = napi.get([]u8, napi_env, args[2]) catch return null;
    var res: c.napi_value = null;
    var len: usize = err_msg.len;
    const rc = selva.selva_is_dump_ready(pid, sdb_filename.ptr, err_msg.ptr, &len);
    if (rc == 0) {
        _ = c.napi_get_boolean(napi_env, true, &res);
    } else if (rc == selva.SELVA_EINPROGRESS) {
        _ = c.napi_get_boolean(napi_env, false, &res);
    } else {
        napi.jsThrow(napi_env, "dump failed"); // TODO pass better error
    }
    return res;
}

pub fn save_common(filename: [:0]u8) !void {
    try errors.selva(selva.selva_dump_save_common(db.ctx.selva, filename.ptr));
}

pub fn save_range(te: db.Type, filename: [:0]u8, start: u32, end: u32) !void {
    try errors.selva(selva.selva_dump_save_range(db.ctx.selva, te, filename.ptr, start, end));
}

pub fn load_common(filename: [:0]u8) !void {
    try errors.selva(selva.selva_dump_load_common(db.ctx.selva, filename.ptr));
}

pub fn load_range(filename: [:0]u8) !void {
    try errors.selva(selva.selva_dump_load_range(db.ctx.selva, filename.ptr));
}
