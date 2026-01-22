const selva = @import("selva.zig");
const Node = @import("node.zig");
const SelvaHash128 = @import("../string.zig").SelvaHash128;
const utils = @import("../utils.zig");
const Thread = @import("../thread/thread.zig");
const t = @import("../types.zig");
const DbCtx = @import("../db/ctx.zig").DbCtx;

pub fn blockHash(thread: *Thread.Thread, ctx: *DbCtx, q: []u8, op: t.OpType) !void {
    const id = utils.read(u32, q, 0);
    const resp = try thread.query.result(20, id, op);
    const start = utils.read(u32, q, 5);
    const typeCode = utils.read(u16, q, 9);
    const typeEntry = selva.c.selva_get_type_by_index(ctx.selva.?, typeCode);
    var err: c_int = selva.c.SELVA_EINTYPE;
    if (typeEntry) |te| {
        var hash: SelvaHash128 = 0;
        err = Node.getNodeBlockHash(ctx, te, start, &hash);
        utils.byteCopy(resp, &hash, 4);
    }
    utils.write(resp, err, 0);
}

pub fn blockStatuses(thread: *Thread.Thread, ctx: *DbCtx, q: []u8, op: t.OpType) !void {
    const id = utils.read(u32, q, 0);
    const typeCode = utils.read(u16, q, 5);
    const typeEntry = selva.c.selva_get_type_by_index(ctx.selva.?, typeCode);

    if (typeEntry) |te| {
        const len: usize = selva.c.selva_get_nr_blocks(te);
        const resp = try thread.query.result(4 + len, id, op);
        const resLen = selva.c.selva_get_type_status(te, resp.len - 4, resp.ptr + 4);
        utils.write(resp, @as(u32, @intCast(resLen)), 0);
    } else {
        const resp = try thread.query.result(4, id, op);
        utils.write(resp, 0, 0);
    }
}
