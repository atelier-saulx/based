const utils = @import("../../utils.zig");
const Query = @import("../common.zig");
const t = @import("../../types.zig");
const Node = @import("../../selva/node.zig");
const Iterate = @import("./iterate.zig");
const Sort = @import("../../sort/sort.zig");

pub fn default(
    ctx: *Query.QueryCtx,
    q: []u8,
) !void {
    var i: usize = 0;
    const header = utils.readNext(t.QueryHeader, q, &i);
    const sizeIndex = try ctx.thread.query.reserve(4);
    const typeEntry = try Node.getType(ctx.db, header.typeId);
    var nodeCnt: u32 = 0;

    switch (header.iteratorType) {
        .default => {
            var it = Node.iterator(.asc, typeEntry);
            nodeCnt = try Iterate.node(.noFilter, ctx, q, &it, &header, typeEntry, &i);
        },
        .desc => {
            var it = Node.iterator(.desc, typeEntry);
            nodeCnt = try Iterate.node(.noFilter, ctx, q, &it, &header, typeEntry, &i);
        },

        .sort => {
            const sortHeader = utils.readNext(t.SortHeader, q, &i);
            var it = try Sort.iterator(.asc, ctx, header.typeId, &sortHeader);
            nodeCnt = try Iterate.node(.noFilter, ctx, q, &it, &header, typeEntry, &i);
        },
        .descSort => {
            const sortHeader = utils.readNext(t.SortHeader, q, &i);
            var it = try Sort.iterator(.desc, ctx, header.typeId, &sortHeader);
            nodeCnt = try Iterate.node(.noFilter, ctx, q, &it, &header, typeEntry, &i);
        },

        .filter => {
            var it = Node.iterator(.asc, typeEntry);
            nodeCnt = try Iterate.node(.filter, ctx, q, &it, &header, typeEntry, &i);
        },
        .descFilter => {
            var it = Node.iterator(.desc, typeEntry);
            nodeCnt = try Iterate.node(.filter, ctx, q, &it, &header, typeEntry, &i);
        },

        .filterSort => {
            const sortHeader = utils.readNext(t.SortHeader, q, &i);
            var it = try Sort.iterator(.asc, ctx, header.typeId, &sortHeader);
            nodeCnt = try Iterate.node(.filter, ctx, q, &it, &header, typeEntry, &i);
        },
        .descFilterSort => {
            const sortHeader = utils.readNext(t.SortHeader, q, &i);
            var it = try Sort.iterator(.desc, ctx, header.typeId, &sortHeader);
            nodeCnt = try Iterate.node(.filter, ctx, q, &it, &header, typeEntry, &i);
        },
        else => {
            // not handled
        },
    }
    ctx.thread.query.write(nodeCnt, sizeIndex);
}
