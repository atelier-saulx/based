const db = @import("db.zig");
const errors = @import("../errors.zig");
const napi = @import("../napi.zig");
const selva = @import("../selva.zig").c;
const std = @import("std");
const copy = @import("../utils.zig").copy;
const SelvaHash128 = @import("../selva.zig").SelvaHash128;

// sdbFilename must be nul-terminated
pub fn saveCommon(ctx: *db.DbCtx, sdbFilename: []u8) c_int {
    var com: selva.selva_dump_common_data = .{
        .meta_data = ctx.ids.ptr,
        .meta_len = ctx.ids.len * @sizeOf(u32),
        .errlog_buf = null,
        .errlog_size = 0,
    };
    return selva.selva_dump_save_common(ctx.selva, &com, sdbFilename.ptr);
}

// sdbFilename must be nul-terminated
pub fn saveBlock(ctx: *db.DbCtx, typeCode: u16, start: u32, sdbFilename: []u8, hashOut: *SelvaHash128) c_int {
    const te = selva.selva_get_type_by_index(ctx.selva, typeCode);
    if (te == null) {
        return selva.SELVA_ENOENT;
    }
    return selva.selva_dump_save_block(ctx.selva, te, sdbFilename.ptr, start, hashOut);
}

pub fn loadCommon(napi_env: napi.Env, info: napi.Info) callconv(.c) napi.Value {
    const args = napi.getArgs(3, napi_env, info) catch return null;
    const sdb_filename = napi.get([]u8, napi_env, args[0]) catch return null;
    const ctx = napi.get(*db.DbCtx, napi_env, args[1]) catch return null;
    const errlog = napi.get([]u8, napi_env, args[2]) catch return null;

    var com: selva.selva_dump_common_data = .{
        .errlog_buf = errlog.ptr,
        .errlog_size = errlog.len,
    };
    const rc = selva.selva_dump_load_common(ctx.selva, &com, sdb_filename.ptr);
    var res: napi.Value = null;
    _ = napi.c.napi_create_int32(napi_env, rc, &res);

    if (com.meta_data != null) {
        const ptr: [*]u32 = @ptrCast(@alignCast(@constCast(com.meta_data)));
        const len = com.meta_len / @sizeOf(u32);
        // TODO This doesn't work with EN_VALGRIND=1
        defer selva.selva_free(@constCast(com.meta_data));
        ctx.ids = ctx.allocator.dupe(u32, ptr[0..len]) catch return null;
    }

    return res;
}

pub fn loadBlock(ctx: *db.DbCtx, typeCode: u16, start: u32, sdbFilename: []u8, errlog: []u8, hashOut: *SelvaHash128) c_int {
    const err = selva.selva_dump_load_block(ctx.selva, sdbFilename.ptr, errlog.ptr, errlog.len);
    if (err < 0) {
        return err;
    }

    const te = selva.selva_get_type_by_index(ctx.selva, typeCode);
    if (te == null) {
        return selva.SELVA_ENOENT;
    }

    selva.selva_node_block_hash(ctx.selva, te, start, hashOut);

    return 0;
}

pub fn unloadBlock(ctx: *db.DbCtx, typeCode: u16, start: u32, sdbFilename: []u8, hashOut: *SelvaHash128) c_int {
    const te = selva.selva_get_type_by_index(ctx.selva, typeCode);
    if (te == null) {
        return selva.SELVA_ENOENT;
    }

    const err = selva.selva_dump_save_block(ctx.selva, te, sdbFilename.ptr, start, hashOut);
    if (err == 0) {
        selva.selva_del_block(ctx.selva, te, start);
    }

    return err;
}
