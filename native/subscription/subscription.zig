const std = @import("std");
const errors = @import("../errors.zig");
const Query = @import("common.zig");
const utils = @import("../utils.zig");
const Thread = @import("../thread/thread.zig");
const t = @import("../types.zig");
const DbCtx = @import("../db/ctx.zig").DbCtx;
const napi = @import("../napi.zig");
const Id = @import("./singleId.zig");

pub fn subscribe(
    _: *DbCtx,
    buffer: []u8,
    _: *Thread.Thread,
) !void {
    var index: usize = 0;
    const subSize = utils.readNext(u32, buffer, &index);

    std.debug.print("FLURP? {any} \n", .{subSize});

    const header = utils.readNext(t.SubscriptionHeader, buffer, &index);
    const fields = utils.sliceNext(header.fieldsLen, buffer, &index);
    std.debug.print("flap {any} plen {any} \n", .{ buffer[index..subSize], header.partialLen });
    const partialFields = utils.sliceNext(header.partialLen * 2, buffer, &index);
    // TYPES

    const query = utils.sliceNext(buffer.len - subSize, buffer, &index);

    std.debug.print("HEADER: {any} q: {any} fields: {any} partial: {any} len: {any} \n", .{
        header,
        query,
        fields,
        partialFields,
        buffer.len - subSize,
    });

    index = 0;
    const subId = utils.readNext(u32, query, &index);

    std.debug.print("query {any} \n", .{query});

    const queryType: t.OpType = @enumFromInt(query[index]);

    std.debug.print("SUBID {any} {any} \n", .{ subId, queryType });

    // prob need to use 8 bytes for sub id...

    // get query as well

    // Id.addIdSubscription(
    //     dbCtx,
    //     header.subId,
    //     header.typeId,
    // );

    // typeId: u16,
    // id: u32,
    // fieldsLen: u8,
    // partialLen: u16,
    // queryLen
    // fields: []const u8,
    // partialFields: []const u8,
    // query

    // ----
}

pub fn unsubscribe(
    dbCtx: *DbCtx,
    buffer: []u8,
    thread: *Thread.Thread,
) !void {
    // only needs SUB-ID
    std.debug.print("derp {any} {any} {any}   \n", .{ dbCtx, buffer, thread });
    // ----

}
