const errors = @import("../../errors.zig");
const std = @import("std");
const db = @import("../../db/db.zig");
const getFields = @import("../include/include.zig").getFields;
const QueryCtx = @import("../types.zig").QueryCtx;
const filter = @import("../filter/filter.zig").filter;
const sort = @import("../../db/sort.zig");
const types = @import("../../types.zig");

const QueryType = types.QueryType;
const QuerySort = @import("../queryTypes/sort.zig");
const QueryDefault = @import("../queryTypes/default.zig");
const QueryId = @import("../queryTypes/id.zig");
const QueryIds = @import("../queryTypes/ids.zig");
const QueryAlias = @import("../queryTypes/alias.zig");

const aggregateTypes = @import("../aggregate/types.zig");
const AggDefault = @import("../queryTypes/aggregate.zig");

const utils = @import("../../utils.zig");
const read = utils.read;
const createSearchCtx = @import("../filter/search.zig").createSearchCtx;
const isVectorSearch = @import("../filter/search.zig").isVectorSearch;

const defaultProtocol = @import("../protocol/default.zig").defaultProtocol;

const results = @import("./results.zig");

pub fn getQueryThreaded(
    dbCtx: *db.DbCtx,
    q: []u8,
    threadCtx: *db.DbThread,
) !void {
    var arena = std.heap.ArenaAllocator.init(std.heap.raw_c_allocator);
    defer arena.deinit();

    const allocator = arena.allocator();

    // len without the schema checksum space
    const len = q.len - 8;
    var ctx: QueryCtx = .{
        .results = std.array_list.Managed(results.Result).init(allocator),
        .db = dbCtx,
        .size = 0,
        .totalResults = 0,
        .aggResult = null,
        .allocator = allocator,
    };
    var index: usize = 0;
    const queryType: QueryType = @enumFromInt(q[index]);
    index += 1;
    const typeId: db.TypeId = read(u16, q, index);
    index += 2;

    if (queryType == QueryType.id) {
        const id = read(u32, q, 3);
        const filterSize = read(u16, q, 7);
        const filterBuf = q[9 .. 9 + filterSize];
        const include = q[9 + filterSize .. len];

        try QueryId.default(id, &ctx, typeId, filterBuf, include);
    } else {
        return errors.DbError.INCORRECT_QUERY_TYPE;
    }

    try results.createResultsBuffer(&ctx, threadCtx);
    // return d;
}
