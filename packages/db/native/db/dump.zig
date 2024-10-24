const c = @import("../c.zig");
const db = @import("db.zig");
const errors = @import("../errors.zig");
const napi = @import("../napi.zig");
const selva = @import("../selva.zig");
const std = @import("std");

pub fn load(ctx: *db.DbCtx, filename: [:0]u8) !void {
    try errors.selva(selva.selva_dump_load(filename.ptr, &ctx.selva));
}

pub fn save(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    const args = napi.getArgs(2, napi_env, info) catch return null;
    const sdb_filename = napi.get([]u8, napi_env, args[0]) catch return null;
    const ctx = napi.get(*db.DbCtx, napi_env, args[1]) catch return null;

    var result: c.napi_value = null;
    const pid = selva.selva_dump_save_async(ctx.selva, sdb_filename.ptr);
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
        napi.jsThrow(napi_env, selva.strerror(rc));
    }
    return res;
}

pub fn saveCommon(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    const args = napi.getArgs(2, napi_env, info) catch return null;
    const sdb_filename = napi.get([]u8, napi_env, args[0]) catch return null;
    const ctx = napi.get(*db.DbCtx, napi_env, args[1]) catch return null;

    var res: c.napi_value = null;
    const rc = selva.selva_dump_save_common(ctx.selva, sdb_filename.ptr);
    _ = c.napi_create_int32(napi_env, rc, &res);
    return res;
}

pub fn saveRange(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    const args = napi.getArgs(5, napi_env, info) catch return null;
    const sdb_filename = napi.get([]u8, napi_env, args[0]) catch return null;
    const typeCode = napi.get(u16, napi_env, args[1]) catch return null;
    const start = napi.get(u32, napi_env, args[2]) catch return null;
    const end = napi.get(u32, napi_env, args[3]) catch return null;
    const ctx = napi.get(*db.DbCtx, napi_env, args[4]) catch return null;

    var res: c.napi_value = null;

    const te = selva.selva_get_type_by_index(ctx.selva, typeCode);
    if (te == null) {
        _ = c.napi_create_int32(napi_env, selva.SELVA_ENOENT, &res);
        return res;
    }

    const rc = selva.selva_dump_save_range(ctx.selva, te, sdb_filename.ptr, start, end);
    _ = c.napi_create_int32(napi_env, rc, &res);

    return res;
}

pub fn loadCommon(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    const args = napi.getArgs(2, napi_env, info) catch return null;
    const sdb_filename = napi.get([]u8, napi_env, args[0]) catch return null;
    const ctx = napi.get(*db.DbCtx, napi_env, args[1]) catch return null;

    var res: c.napi_value = null;
    const rc = selva.selva_dump_load_common(ctx.selva, sdb_filename.ptr);
    _ = c.napi_create_int32(napi_env, rc, &res);
    return res;
}

pub fn loadRange(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    const args = napi.getArgs(2, napi_env, info) catch return null;
    const sdb_filename = napi.get([]u8, napi_env, args[0]) catch return null;
    const ctx = napi.get(*db.DbCtx, napi_env, args[1]) catch return null;

    var res: c.napi_value = null;
    const rc = selva.selva_dump_load_range(ctx.selva, sdb_filename.ptr);
    _ = c.napi_create_int32(napi_env, rc, &res);
    return res;
}
