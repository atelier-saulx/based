const selva = @import("selva.zig");
const Node = @import("node.zig");
const SelvaHash128 = @import("../string.zig").SelvaHash128;
const utils = @import("../utils.zig");
const Thread = @import("../thread/thread.zig");
const t = @import("../types.zig");
const DbCtx = @import("../db/ctx.zig").DbCtx;

pub fn blockHash(thread: *Thread.Thread, ctx: *DbCtx, q: []u8, op: t.OpType) !void {
    const id = utils.read(u32, q, 0);
    const data = try thread.query.result(20, id, op);
    const start = utils.read(u32, q, 5);
    const typeCode = utils.read(u16, q, 9);
    const typeEntry = selva.c.selva_get_type_by_index(ctx.selva.?, typeCode);
    var err: c_int = selva.c.SELVA_EINTYPE;
    if (typeEntry) |te| {
        var hash: SelvaHash128 = 0;
        err = Node.getNodeBlockHash(ctx, te, start, &hash);
        utils.byteCopy(data, &hash, 4);
    }
    utils.write(data, err, 0);
}
