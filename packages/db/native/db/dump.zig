const c = @import("../c.zig");
const db = @import("db.zig");
const errors = @import("../errors.zig");
const napi = @import("../napi.zig");
const selva = @import("../selva.zig");
const std = @import("std");
const copy = @import("../utils.zig").copy;

pub fn saveCommon(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    const args = napi.getArgs(2, napi_env, info) catch return null;
    const sdb_filename = napi.get([]u8, napi_env, args[0]) catch return null;
    const ctx = napi.get(*db.DbCtx, napi_env, args[1]) catch return null;

    // TODO Replace this
    const tst = "hello world";
    var com: selva.selva_dump_common_data = .{
        .meta_data = tst.ptr,
        .meta_len = tst.len,
        .errlog_buf = null,
        .errlog_size = 0,
    };
    var res: c.napi_value = null;
    const rc = selva.selva_dump_save_common(ctx.selva, &com, sdb_filename.ptr);
    _ = c.napi_create_int32(napi_env, rc, &res);
    return res;
}

pub fn saveBlock(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    const args = napi.getArgs(6, napi_env, info) catch return null;
    const sdb_filename = napi.get([]u8, napi_env, args[0]) catch return null;
    const typeCode = napi.get(u16, napi_env, args[1]) catch return null;
    const start = napi.get(u32, napi_env, args[2]) catch return null;
    const ctx = napi.get(*db.DbCtx, napi_env, args[3]) catch return null;
    const hash_out = napi.get([]u8, napi_env, args[4]) catch return null;

    var res: c.napi_value = null;

    const te = selva.selva_get_type_by_index(ctx.selva, typeCode);
    if (te == null) {
        _ = c.napi_create_int32(napi_env, selva.SELVA_ENOENT, &res);
        return res;
    }

    var hash: selva.SelvaHash128 = 0;
    const rc = selva.selva_dump_save_block(ctx.selva, te, sdb_filename.ptr, start, &hash);
    _ = c.napi_create_int32(napi_env, rc, &res);
    const hp: [*]u8 = @ptrCast(&hash);
    copy(hash_out, hp[0..16]);

    return res;
}

pub fn loadCommon(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    const args = napi.getArgs(3, napi_env, info) catch return null;
    const sdb_filename = napi.get([]u8, napi_env, args[0]) catch return null;
    const ctx = napi.get(*db.DbCtx, napi_env, args[1]) catch return null;
    const errlog = napi.get([]u8, napi_env, args[2]) catch return null;

    var com: selva.selva_dump_common_data = .{
        .errlog_buf = errlog.ptr,
        .errlog_size = errlog.len,
    };
    const rc = selva.selva_dump_load_common(ctx.selva, &com, sdb_filename.ptr);
    var res: c.napi_value = null;
    _ = c.napi_create_int32(napi_env, rc, &res);

    if (com.meta_data != null) {
        // TODO read this data
        const metadata: [*]u8 = @ptrCast(@constCast(com.meta_data));
        std.log.err("meta: {s}", .{ metadata[0..com.meta_len] });
        selva.selva_free(@constCast(com.meta_data));
    }

    return res;
}

pub fn loadBlock(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    const args = napi.getArgs(3, napi_env, info) catch return null;
    const sdb_filename = napi.get([]u8, napi_env, args[0]) catch return null;
    const ctx = napi.get(*db.DbCtx, napi_env, args[1]) catch return null;
    const errlog = napi.get([]u8, napi_env, args[2]) catch return null;

    var res: c.napi_value = null;
    const rc = selva.selva_dump_load_block(ctx.selva, sdb_filename.ptr, errlog.ptr, errlog.len);
    _ = c.napi_create_int32(napi_env, rc, &res);
    return res;
}

pub fn delBlock(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    const args = napi.getArgs(3, napi_env, info) catch return null;
    const ctx = napi.get(*db.DbCtx, napi_env, args[0]) catch return null;
    const typeId = napi.get(u16, napi_env, args[1]) catch return null;
    const start = napi.get(u32, napi_env, args[2]) catch return null;

    const te = selva.selva_get_type_by_index(ctx.selva, typeId);


    selva.selva_del_block(ctx.selva, te, start);
    return null;
}
