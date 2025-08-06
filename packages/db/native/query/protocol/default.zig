const read = @import("../../utils.zig").read;
const createSearchCtx = @import("../filter/search.zig").createSearchCtx;
const isVectorSearch = @import("../filter/search.zig").isVectorSearch;
const t = @import("../types.zig");
const QuerySort = @import("../queryTypes/sort.zig");
const QueryDefault = @import("../queryTypes/default.zig");
const db = @import("../../db/db.zig");
const std = @import("std");
const ReadOp = @import("../../types.zig").ReadOp;

pub inline fn defaultProtocol(ctx: *t.QueryCtx, typeId: db.TypeId, q: []u8, indexI: usize, len: usize) !void {
    var index: usize = indexI;
    const offset = read(u32, q, index);
    index += 4;
    const limit = read(u32, q, index);
    index += 4;

    const filterSize = read(u16, q, index);
    index += 2;
    const isSimpleFilter = q[index] == 1;
    index += 1;
    const filterBuf = q[index .. index + filterSize];
    index += filterSize;

    const sortSize = read(u16, q, index);
    index += 2;
    const sortBuf = q[index .. index + sortSize];
    index += sortSize;

    const searchSize = read(u16, q, index);
    index += 2;
    const search = q[index .. index + searchSize];
    index += searchSize;

    const include = q[index..len];

    // These if statements are for comptime variables
    if (sortSize == 0) {
        if (searchSize > 0) {
            if (isVectorSearch(search)) {
                try QueryDefault.search(
                    true,
                    ctx,
                    offset,
                    limit,
                    typeId,
                    filterBuf,
                    include,
                    &createSearchCtx(true, search),
                );
            } else {
                try QueryDefault.search(
                    false,
                    ctx,
                    offset,
                    limit,
                    typeId,
                    filterBuf,
                    include,
                    &createSearchCtx(false, search),
                );
            }
        } else {
            if (isSimpleFilter) {
                try QueryDefault.defaultSimpleFilter(ctx, offset, limit, typeId, filterBuf, include);
            } else if (filterBuf.len > 0) {
                try QueryDefault.default(t.FilterType.default, ctx, offset, limit, typeId, filterBuf, include);
            } else {
                try QueryDefault.default(t.FilterType.none, ctx, offset, limit, typeId, filterBuf, include);
            }
        }
    } else {
        const s = sortBuf[1..sortBuf.len];
        const isAsc = sortBuf[0] == 0;

        if (searchSize > 0) {
            if (isVectorSearch(search)) {
                const searchCtx = &createSearchCtx(true, search);
                if (isAsc) {
                    try QuerySort.search(true, false, ctx, offset, limit, typeId, filterBuf, include, s, searchCtx);
                } else {
                    try QuerySort.search(true, true, ctx, offset, limit, typeId, filterBuf, include, s, searchCtx);
                }
            } else {
                const searchCtx = &createSearchCtx(false, search);
                if (isAsc) {
                    try QuerySort.search(false, false, ctx, offset, limit, typeId, filterBuf, include, s, searchCtx);
                } else {
                    try QuerySort.search(false, true, ctx, offset, limit, typeId, filterBuf, include, s, searchCtx);
                }
            }
        } else if (isAsc) {
            try QuerySort.default(false, ctx, offset, limit, typeId, filterBuf, include, s);
        } else if (s[0] == @intFromEnum(ReadOp.ID)) {
            try QuerySort.idDesc(ctx, offset, limit, typeId, filterBuf, include);
        } else {
            try QuerySort.default(true, ctx, offset, limit, typeId, filterBuf, include, s);
        }
    }
}
