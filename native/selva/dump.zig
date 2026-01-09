const selva = @import("selva.zig").c;
const jemalloc = @import("../jemalloc.zig");
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
    const resp = try thread.query.result(4, id, op);
    const filename = q[5..q.len];
    var com: selva.selva_dump_common_data = .{
        .meta_data = ctx.ids.ptr,
        .meta_len = ctx.ids.len * @sizeOf(u32),
        .errlog_buf = null,
        .errlog_size = 0,
    };
    var err: c_int = undefined;
    err = selva.selva_dump_save_common(ctx.selva, &com, filename.ptr);
    utils.write(resp, err, 0);
}

// sdbFilename must be nul-terminated
pub fn saveBlock(thread: *Thread.Thread, ctx: *DbCtx, q: []u8, op: t.OpType) !void {
    const id = read(u32, q, 0);
    const resp = try thread.query.result(26, id, op);

    const start = read(u32, q, 5);
    const typeCode = read(u16, q, 9);
    const filename = q[11..q.len];
    var hash: SelvaHash128 = 0;
    var err: c_int = undefined;

    const te = selva.selva_get_type_by_index(ctx.selva, typeCode);
    if (te == null) {
        utils.write(resp, selva.SELVA_EINTYPE, 0);
        return;
    }

    err = selva.selva_dump_save_block(ctx.selva, te, filename.ptr, start, &hash);
    utils.write(resp, err, 0);
    utils.byteCopy(resp, q[5..11], 4);
    utils.byteCopy(resp, &hash, 10);
}

const DispatchSaveJobCtx = struct {
    threads: *Thread.Threads,
    thread: *Thread.Thread,
    qid: u32,
    nrBlocks: u32,
};

fn makeDumpFilepath(allocator: std.mem.Allocator, fsPath: []const u8, typeId: selva.node_type_t, blockI: selva.block_id_t) ![]u8 {
    const filename = try std.fmt.allocPrint(allocator, "{d}_{d}.sdb", .{ typeId, blockI });
    return try std.fs.path.join(allocator, &[_][] const u8{ fsPath, filename });
}

// TODO Handle errors
fn dispatchSaveJob(jobCtxP: ?*anyopaque, _: ?*selva.SelvaDb, te: ?*selva.SelvaTypeEntry, blockI: selva.block_id_t, start: selva.node_id_t) callconv(.c) void {
    const jobCtx: *DispatchSaveJobCtx = @alignCast(@ptrCast(jobCtxP.?));
    const ctx = jobCtx.threads.ctx;
    const typeCode = selva.selva_get_type(te);

    jobCtx.threads.mutex.lock();
    const filepath = makeDumpFilepath(ctx.allocator, ctx.fsPath, typeCode, blockI) catch return;
    const msg = ctx.allocator.alloc(u8, 11 + filepath.len + 1) catch return;
    ctx.allocator.free(filepath);
    // TODO Free somewhere!
    //defer ctx.allocator.free(msg);
    jobCtx.threads.mutex.unlock();

    utils.write(msg, @as(u32, jobCtx.qid), 0); // id
    msg[4] = @intFromEnum(t.OpType.saveBlock); // op
    utils.write(msg, @as(u32, start), 5); // start
    utils.write(msg, @as(u16, typeCode), 9); // type
    utils.byteCopy(msg, filepath, 11);
    msg[11 + filepath.len] = 0; // nul-termination

    jobCtx.threads.query(msg) catch return;
    jobCtx.nrBlocks += 1;
}

/// Save all blocks.
/// Dispatches a save job for each block.
/// This must be ran on the modify thread.
pub fn saveAllBlocks(threads: *Thread.Threads, thread: *Thread.Thread, q: []u8, op: t.OpType) !void {
    const qid = read(u32, q, 0);
    const resp = try thread.query.result(8, qid, op);
    var jobCtx: DispatchSaveJobCtx = .{
        .threads = threads,
        .thread = thread,
        .qid = qid,
        .nrBlocks = 0,
    };

    selva.selva_foreach_block(threads.ctx.selva, dispatchSaveJob, &jobCtx);

    const err: u32 = 0;
    utils.write(resp, err, 0);
    utils.write(resp, jobCtx.nrBlocks, 4);
}

pub fn loadCommon(
    thread: *Thread.Thread,
    dbCtx: *DbCtx,
    m: []u8,
    op: t.OpType,
) !void {
    const resp = try thread.modify.result(512, read(u32, m, 0), op);
    const filename = m[5..m.len];
    const errlog = resp[4..resp.len];
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
        defer jemalloc.free(com.meta_data);
        dbCtx.ids = dbCtx.allocator.dupe(u32, ptr[0..len]) catch {
            err = selva.SELVA_ENOMEM;
            utils.write(resp, err, 0);
            return;
        };
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

    const start: u32 = read(u32, m, 5);
    const typeCode: u16 = read(u16, m, 9);
    const filename = m[11..m.len];
    var err: c_int = undefined;

    const errlog = resp[26..resp.len];

    const te = selva.selva_get_type_by_index(dbCtx.selva, typeCode);
    if (te == null) {
        utils.write(resp, selva.SELVA_EINTYPE, 0);
        return;
    }

    err = selva.selva_dump_load_block(dbCtx.selva, te, filename.ptr, errlog.ptr, errlog.len);
    if (err != 0) {
        utils.write(resp, err, 0);
        return;
    }

    var hash: SelvaHash128 = 0;
    err = selva.selva_node_block_hash(dbCtx.selva, te, start, &hash);
    utils.write(resp, err, 0);
    utils.byteCopy(resp, m[5..11], 4);
    utils.byteCopy(resp, &hash, 10);
}

pub fn unloadBlock(
    thread: *Thread.Thread,
    dbCtx: *DbCtx,
    m: []u8,
    op: t.OpType,
) !void {
    const resp = try thread.modify.result(20, read(u32, m, 0), op);

    const start: u32 = read(u32, m, 5);
    const typeCode: u16 = read(u16, m, 9);
    const filename = m[11..m.len];
    var err: c_int = undefined;

    const te = selva.selva_get_type_by_index(dbCtx.selva, typeCode);
    if (te == null) {
        utils.write(resp, selva.SELVA_EINTYPE, 0);
        return;
    }

    var hash: SelvaHash128 = 0;
    err = selva.selva_dump_save_block(dbCtx.selva, te, filename.ptr, start, &hash);
    if (err == 0) {
        selva.selva_del_block(dbCtx.selva, te, start);
        return;
    }

    utils.write(resp, err, 0);
    utils.byteCopy(resp, m[5..11], 4);
    utils.byteCopy(resp, &hash, 10);
}
