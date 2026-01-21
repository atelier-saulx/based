const selva = @import("selva.zig").c;
const jemalloc = @import("../jemalloc.zig");
const SelvaHash128 = @import("../string.zig").SelvaHash128;
const utils = @import("../utils.zig");
const Thread = @import("../thread/thread.zig");
const t = @import("../types.zig");
const std = @import("std");
const read = utils.read;
const DbCtx = @import("../db/ctx.zig").DbCtx;

fn saveCommon(ctx: *DbCtx) c_int {
    var com: selva.selva_dump_common_data = .{
        .ids_data = ctx.ids.ptr,
        .ids_len = ctx.ids.len,
        .errlog_buf = null,
        .errlog_size = 0,
    };

    return selva.selva_dump_save_common(ctx.selva, &com);
}

pub fn saveBlock(thread: *Thread.Thread, ctx: *DbCtx, q: []u8, op: t.OpType) !void {
    const id = read(u32, q, 0);
    const resp = try thread.query.result(10, id, op);

    const start = read(u32, q, 5);
    const typeCode = read(u16, q, 9);
    var err: c_int = undefined;

    const te = selva.selva_get_type_by_index(ctx.selva, typeCode);
    if (te == null) {
        utils.write(resp, selva.SELVA_EINTYPE, 0);
        return;
    }

    err = selva.selva_dump_save_block(ctx.selva, te, start);
    utils.write(resp, err, 0);
    utils.byteCopy(resp, q[5..11], 4);

    // Free the query message allocated by dispatchSaveJob()
    jemalloc.free(q);
}

const DispatchSaveJobCtx = struct {
    threads: *Thread.Threads,
    thread: *Thread.Thread,
    qid: u32,
    nrDirtyBlocks: u32,
};

fn dispatchSaveJob(jobCtxP: ?*anyopaque, _: ?*selva.SelvaDb, te: ?*selva.SelvaTypeEntry, _: selva.block_id_t, start: selva.node_id_t) callconv(.c) void {
    const jobCtx: *DispatchSaveJobCtx = @alignCast(@ptrCast(jobCtxP.?));
    const typeCode = selva.selva_get_type(te);

    const msg = jemalloc.alloc(u8, 11);

    utils.write(msg, @as(u32, jobCtx.qid), 0); // id
    msg[4] = @intFromEnum(t.OpType.saveBlock); // op
    utils.write(msg, @as(u32, start), 5); // start
    utils.write(msg, @as(u16, typeCode), 9); // type

    // TODO Handle error
    jobCtx.threads.query(msg) catch return;
    jobCtx.nrDirtyBlocks += 1;
}

/// Save common and all blocks.
/// Dispatches a save job for each block.
/// This must be ran on the modify thread.
pub fn saveAll(threads: *Thread.Threads, thread: *Thread.Thread, q: []u8, op: t.OpType) !void {
    const qid = read(u32, q, 0);
    const resp = try thread.query.result(8, qid, op);
    var jobCtx: DispatchSaveJobCtx = .{
        .threads = threads,
        .thread = thread,
        .qid = qid,
        .nrDirtyBlocks = 0,
    };

    const errSaveCommon = saveCommon(threads.ctx);
    if (errSaveCommon == 0) {
        selva.selva_foreach_block(threads.ctx.selva, selva.SELVA_TYPE_BLOCK_STATUS_DIRTY, dispatchSaveJob, &jobCtx);
    }

    const err: i32 = @intCast(errSaveCommon);
    utils.write(resp, err, 0);
    utils.write(resp, jobCtx.nrDirtyBlocks, 4);
}

pub fn loadCommon(
    thread: *Thread.Thread,
    dbCtx: *DbCtx,
    m: []u8,
    op: t.OpType,
) !void {
    const resp = try thread.modify.result(512, read(u32, m, 0), op);
    const errlog = resp[4..resp.len];
    var com: selva.selva_dump_common_data = .{
        .errlog_buf = errlog.ptr,
        .errlog_size = errlog.len,
        .ids_data = null,
    };
    var err: c_int = undefined;

    err = selva.selva_dump_load_common(dbCtx.selva, &com);
    if (err == 0) {
        // Load all blocks
        for (com.blocks[0..com.blocks_len]) |el| {
            if (selva.selva_get_type_by_index(dbCtx.selva, el.type)) |te| {
                err = selva.selva_dump_load_block(dbCtx.selva, te, el.block, com.errlog_buf, com.errlog_size);
                if (err != 0) {
                    break;
                }
            }
        }
    }

    jemalloc.free(@as(?*anyopaque, com.blocks));

    if (com.ids_data != null) {
        dbCtx.ids = com.ids_data[0..com.ids_len];
    }

    utils.write(resp, err, 0);
}

pub fn loadBlock(
    thread: *Thread.Thread,
    dbCtx: *DbCtx,
    m: []u8,
    op: t.OpType,
) !void {
    const resp = try thread.modify.result(512, read(u32, m, 0), op);

    //const start: u32 = read(u32, m, 5);
    const typeCode: u16 = read(u16, m, 9);
    const block = read(u32, m, 11);
    var err: c_int = undefined;

    const errlog = resp[4..resp.len];

    const te = selva.selva_get_type_by_index(dbCtx.selva, typeCode);
    if (te == null) {
        utils.write(resp, selva.SELVA_EINTYPE, 0);
        return;
    }

    err = selva.selva_dump_load_block(dbCtx.selva, te, block, errlog.ptr, errlog.len);
    utils.write(resp, err, 0);
}

pub fn unloadBlock(
    thread: *Thread.Thread,
    dbCtx: *DbCtx,
    m: []u8,
    op: t.OpType,
) !void {
    const resp = try thread.modify.result(10, read(u32, m, 0), op);

    const start: u32 = read(u32, m, 5);
    const typeCode: u16 = read(u16, m, 9);
    var err: c_int = undefined;

    const te = selva.selva_get_type_by_index(dbCtx.selva, typeCode);
    if (te == null) {
        utils.write(resp, selva.SELVA_EINTYPE, 0);
        return;
    }

    err = selva.selva_dump_save_block(dbCtx.selva, te, start);
    if (err == 0) {
        selva.selva_del_block(dbCtx.selva, te, start);
        return;
    }

    utils.write(resp, err, 0);
    utils.byteCopy(resp, m[5..11], 4);
}
