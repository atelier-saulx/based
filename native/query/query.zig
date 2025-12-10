const std = @import("std");
const errors = @import("../errors.zig");
const napi = @import("../napi.zig");
const Sort = @import("../db/sort.zig");
const Query = @import("common.zig");
const utils = @import("../utils.zig");
const multiple = @import("multiple.zig");
const Thread = @import("../thread/thread.zig");
const t = @import("../types.zig");
const DbCtx = @import("../db/ctx.zig").DbCtx;
const Selva = @import("../selva");

// -------- NAPI ---------- (put in js bridge maybe?)
pub fn getQueryBufThread(env: napi.Env, info: napi.Info) callconv(.c) napi.Value {
    return getQueryBufInternalThread(env, info) catch |err| {
        napi.jsThrow(env, @errorName(err));
        return null;
    };
}

pub fn getQueryBufInternalThread(env: napi.Env, info: napi.Info) !napi.Value {
    const args = try napi.getArgs(2, env, info);
    const dbCtx = try napi.get(*DbCtx, env, args[0]);
    const q = try napi.get([]u8, env, args[1]);
    try dbCtx.threads.query(q);
    return null;
}
// -------------------------

pub fn getQueryThreaded(
    dbCtx: *DbCtx,
    buffer: []u8,
    thread: *Thread.Thread,
) !void {
    var index: usize = 0;

    var ctx: Query.QueryCtx = .{
        .db = dbCtx,
        .thread = thread,
        // .sort
    };

    const queryId = utils.readNext(u32, buffer, &index);
    const q = buffer[index .. buffer.len - 8]; // - checksum len
    const op = utils.read(t.OpType, q, 0);

    _ = try thread.query.result(0, queryId, op);

    switch (op) {
        .default => {
            try multiple.default(.default, &ctx, q, void);
        },
        .defaultSort => {
            const header = utils.readNext(t.QueryHeader, q, &index);
            const sortHeader = utils.readNext(t.SortHeader, q, &index);
            var sortIndex: *Sort.SortIndexMeta = undefined;
            if (Sort.getSortIndex(
                dbCtx.sortIndexes.get(header.typeId),
                sortHeader.prop,
                sortHeader.start,
                sortHeader.lang,
            )) |sortMetaIndex| {
                sortIndex = sortMetaIndex;
            } else {
                // needs multi threading ofc
                // add comptime dont create all
                // can now store sort indexes for refs as well!
                sortIndex = try Sort.createSortIndex(
                    dbCtx,
                    thread.decompressor,
                    header.typeId,
                    &sortHeader,
                    true,
                    false,
                );
            }
            try multiple.default(.defaultSort, &ctx, q, sortIndex);
        },
        .ids => {}, // can treat this the same as refs maybe?
        .id => {
            // const id = read(u32, q, 3);
            // const filterSize = read(u16, q, 7);
            // const filterBuf = q[9 .. 9 + filterSize];
            // const include = q[9 + filterSize .. len];
            // try QueryId.default(id, &ctx, typeId, filterBuf, include);
        },
        .alias => {},
        // t.OpType.aggregates => {},
        // t.OpType.aggregatesCount => {},
        else => {
            return errors.DbError.INCORRECT_QUERY_TYPE;
        },
    }

    // write checksum
    try ctx.thread.query.checksum();
}
