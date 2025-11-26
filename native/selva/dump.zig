const selva = @import("selva.zig").c;
const SelvaHash128 = @import("../string.zig").SelvaHash128;
const utils = @import("../utils.zig");
const Thread = @import("../thread/thread.zig");
const t = @import("../types.zig");
const std = @import("std");
const read = utils.read;
const DbCtx = @import("../db/ctx.zig").DbCtx;

// sdbFilename must be nul-terminated
pub fn saveCommon(thread: *Thread.Thread, ctx: *DbCtx, q: []u8, op: t.OpType) !void {
    const id = read(u32, q, 0);
    const data = try thread.query.result(4, id, op);
    const filename = q[5..q.len];
    var com: selva.selva_dump_common_data = .{
        .meta_data = ctx.ids.ptr,
        .meta_len = ctx.ids.len * @sizeOf(u32),
        .errlog_buf = null,
        .errlog_size = 0,
    };
    var err: c_int = undefined;
    err = selva.selva_dump_save_common(ctx.selva, &com, filename.ptr);
    utils.write(data, err, 0);
}

// sdbFilename must be nul-terminated
pub fn saveBlock(thread: *Thread.Thread, ctx: *DbCtx, q: []u8, op: t.OpType) !void {
    const id = read(u32, q, 0);
    const data = try thread.query.result(26, id, op);

    const start = read(u32, q, 5);
    const typeCode = read(u16, q, 9);
    const filename = q[11..q.len];
    var hash: SelvaHash128 = 0;
    var err: c_int = undefined;

    utils.byteCopy(data, q[5..11], 4);

    const te = selva.selva_get_type_by_index(ctx.selva, typeCode);
    if (te == null) {
        utils.write(data, selva.SELVA_EINTYPE, 0);
        return;
    }

    err = selva.selva_dump_save_block(ctx.selva, te, filename.ptr, start, &hash);
    utils.write(data, err, 0);
    utils.byteCopy(data, &hash, 10);
}

pub fn loadCommon(
    thread: *Thread.Thread,
    dbCtx: *DbCtx,
    m: []u8,
    op: t.OpType,
) !void {
    const data = try thread.modify.result(20 + 492, read(u32, m, 0), op);
    const filename = m[5..m.len];
    const errlog = data[5..data.len];
    var com: selva.selva_dump_common_data = .{
        .errlog_buf = errlog.ptr,
        .errlog_size = errlog.len,
        .meta_data = null,
    };
    var err: c_int = undefined;

    err = selva.selva_dump_load_common(dbCtx.selva, &com, filename.ptr);

    if (com.meta_data != null) {
        const ptr: [*]u32 = @ptrCast(@alignCast(@constCast(com.meta_data)));
        const len = com.meta_len / @sizeOf(u32);
        // TODO This doesn't work with EN_VALGRIND=1
        defer selva.selva_free(@constCast(com.meta_data));
        dbCtx.ids = dbCtx.allocator.dupe(u32, ptr[0..len]) catch {
            err = selva.SELVA_ENOMEM;
            utils.write(data, err, 0);
            return;
        };
    }

    utils.write(data, err, 0);
}

pub fn loadBlock(
    thread: *Thread.Thread,
    dbCtx: *DbCtx,
    m: []u8,
    op: t.OpType,
) !void {
    const data = try thread.modify.result(20 + 492, read(u32, m, 0), op);

    const start: u32 = read(u32, m, 5);
    const typeCode: u16 = read(u16, m, 9);
    const filename = m[11..m.len];
    var err: c_int = undefined;

    const errlog = data[16..data.len];

    err = selva.selva_dump_load_block(dbCtx.selva, filename.ptr, errlog.ptr, errlog.len);
    if (err != 0) {
        utils.write(data, err, 0);
        return;
    }

    const te = selva.selva_get_type_by_index(dbCtx.selva, typeCode);
    if (te == null) {
        utils.write(data, selva.SELVA_EINTYPE, 0);
        return;
    }

    var hash: SelvaHash128 = 0;
    err = selva.selva_node_block_hash(dbCtx.selva, te, start, &hash);
    utils.write(data, err, 0);
    utils.byteCopy(data, m[5..11], 4);
    utils.byteCopy(data, &hash, 10);
}

pub fn unloadBlock(
    thread: *Thread.Thread,
    dbCtx: *DbCtx,
    m: []u8,
    op: t.OpType,
) !void {
    const data = try thread.modify.result(20, read(u32, m, 0), op);

    const start: u32 = read(u32, m, 5);
    const typeCode: u16 = read(u16, m, 9);
    const filename = m[11..m.len];
    var err: c_int = undefined;

    const te = selva.selva_get_type_by_index(dbCtx.selva, typeCode);
    if (te == null) {
        utils.write(data, selva.SELVA_EINTYPE, 0);
        return;
    }

    var hash: SelvaHash128 = 0;
    err = selva.selva_dump_save_block(dbCtx.selva, te, filename.ptr, start, &hash);
    if (err == 0) {
        selva.selva_del_block(dbCtx.selva, te, start);
        return;
    }

    utils.write(data, err, 0);
    utils.byteCopy(data, m[5..11], 4);
    utils.byteCopy(data, &hash, 10);
}
