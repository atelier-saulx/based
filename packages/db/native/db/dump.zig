const c = @import("../c.zig");
const db = @import("db.zig");
const errors = @import("../errors.zig");
const napi = @import("../napi.zig");
const selva = @import("../selva.zig");

pub fn save(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    const args = napi.getArgs(1, napi_env, info) catch return null;
    const sdb_filename = napi.getBuffer("sdb_filename", napi_env, args[0]) catch return null;
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
    const pid = napi.getInt32_2("pid", napi_env, args[0]) catch return null;
    const sdb_filename = napi.getBuffer("sdb_filename", napi_env, args[1]) catch return null;
    const err_msg = napi.getBuffer("err_msg", napi_env, args[2]) catch return null;
    var res: c.napi_value = null;

    const rc = selva.selva_is_dump_ready(pid, sdb_filename.ptr, err_msg.ptr, err_msg.len);
    if (rc == 0) {
        _ = c.napi_get_boolean(napi_env, true, &res);
    } else if (rc == selva.SELVA_EINPROGRESS) {
        _ = c.napi_get_boolean(napi_env, false, &res);
    } else {
        napi.jsThrow(napi_env, "dump failed"); // TODO pass better error
    }

    return res;
}
