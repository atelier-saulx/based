const selva = @import("selva.zig").c;
const jemalloc = @import("../jemalloc.zig");
const SelvaHash128 = @import("../string.zig").SelvaHash128;
const utils = @import("../utils.zig");
const Thread = @import("../thread/thread.zig");
const t = @import("../types.zig");
const std = @import("std");
const read = utils.read;
const DbCtx = @import("../db/ctx.zig").DbCtx;
const Node = @import("node.zig");

fn saveCommon(ctx: *DbCtx, te: Node.Type) c_int {
    var com: selva.selva_dump_common_data = .{
        .max_id = ctx.ids[selva.selva_get_type(te) - 1],
        .errlog_buf = null,
        .errlog_size = 0,
    };

    return selva.selva_dump_save_common(ctx.selva, te, &com);
}

pub fn saveBlock(thread: *Thread.Thread, ctx: *DbCtx, q: []u8, op: t.OpType) !void {
    const id = read(u32, q, 0);
    const resp = try thread.query.result(10, id, op);

    const block = read(u32, q, 5);
    const typeCode = read(u16, q, 9);
    var err: c_int = undefined;

    const te = selva.selva_get_type_by_index(ctx.selva, typeCode);
    if (te == null) {
        utils.write(resp, selva.SELVA_EINTYPE, 0);
        return;
    }

    err = selva.selva_dump_save_block(ctx.selva, te, block);
    if (err == selva.SELVA_EINPROGRESS) {
        // This is "weird" but probably ok.
        err = 0;
    }
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

fn dispatchSaveJob(jobCtxP: ?*anyopaque, _: ?*selva.SelvaDb, te: ?*selva.SelvaTypeEntry, block: selva.block_id_t, _: selva.node_id_t) callconv(.c) void {
    const jobCtx: *DispatchSaveJobCtx = @alignCast(@ptrCast(jobCtxP.?));
    const typeCode = selva.selva_get_type(te);
    const msg = jemalloc.alloc(u8, 11);

    utils.write(msg, @as(u32, jobCtx.qid), 0); // id
    msg[4] = @intFromEnum(t.OpType.saveBlock); // op
    utils.write(msg, @as(u32, block), 5); // block
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
    const maxType = Node.getMaxType(threads.ctx);
    const resp = try thread.query.result(8, qid, op);
    var jobCtx: DispatchSaveJobCtx = .{
        .threads = threads,
        .thread = thread,
        .qid = qid,
        .nrDirtyBlocks = 0,
    };

    utils.write(resp, @as(i32, 0), 0);

    var i: t.TypeId = 0;
    while (i < maxType) : (i += 1) {
        var err: c_int = selva.SELVA_ENOENT;

        if (Node.getType(threads.ctx, i + 1) catch null) |te| {
            err = saveCommon(threads.ctx, te);
            if (err == 0) {
                selva.selva_foreach_block(threads.ctx.selva, te, selva.SELVA_TYPE_BLOCK_STATUS_DIRTY, dispatchSaveJob, &jobCtx);
            }
        }

        // TODO We might want to try to save every type and return each error
        if (err != 0) {
            utils.write(resp, @as(i32, @intCast(err)), 0);
            break;
        }
    }

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
    const maxType = Node.getMaxType(dbCtx);
    const ids = jemalloc.alloc(t.NodeId, maxType);
    var com: selva.selva_dump_common_data = .{
        .errlog_buf = errlog.ptr,
        .errlog_size = errlog.len,
        .blocks = null,
        .blocks_len = 0,
    };
    var err: c_int = 0;

    var i: t.TypeId = 0;
    outer: while (i < maxType) : (i += 1) {
        if (Node.getType(dbCtx, i + 1) catch null) |te| {
            defer selva.selva_dump_deinit_common(&com);
            err = selva.selva_dump_load_common(dbCtx.selva, te, &com);
            if (err == 0) {
                ids[i] = com.max_id;

                // Load all blocks
                for (com.blocks[0..com.blocks_len]) |el| {
                    err = selva.selva_dump_load_block(dbCtx.selva, te, el.block, com.errlog_buf, com.errlog_size);
                    if (err != 0) {
                        break :outer;
                    }
                }
            }
        }
    }

    if (dbCtx.ids.len > 0) {
        jemalloc.free(dbCtx.ids);
    }
    dbCtx.ids = ids;

    utils.write(resp, @as(i32, @intCast(err)), 0);
}

pub fn loadBlock(
    thread: *Thread.Thread,
    dbCtx: *DbCtx,
    m: []u8,
    op: t.OpType,
) !void {
    const resp = try thread.modify.result(512, read(u32, m, 0), op);

    const block = read(u32, m, 5);
    const typeCode: u16 = read(u16, m, 9);
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

    const block: u32 = read(u32, m, 5);
    const typeCode: u16 = read(u16, m, 9);
    var err: c_int = undefined;

    const te = selva.selva_get_type_by_index(dbCtx.selva, typeCode);
    if (te == null) {
        utils.write(resp, selva.SELVA_EINTYPE, 0);
        return;
    }

    err = selva.selva_dump_save_block(dbCtx.selva, te, block);
    if (err == 0) {
        selva.selva_del_block(dbCtx.selva, te, block);
        return;
    }

    utils.write(resp, err, 0);
    utils.byteCopy(resp, m[5..11], 4);
}
