const std = @import("std");
const Query = @import("../../common.zig");
const utils = @import("../../../utils.zig");
const Node = @import("../../../selva/node.zig");
const Schema = @import("../../../selva/schema.zig");
const Fields = @import("../../../selva/fields.zig");
const t = @import("../../../types.zig");
const Thread = @import("../../../thread/thread.zig");

const deflate = @import("./deflate.zig");
const includeInner = @import("./includes.zig").include;
const likeInner = @import("./like.zig").like;
const MAX_FIXED_LEN = 64;

pub fn parse(
    thread: *Thread.Thread,
    q: []u8,
    v: []const u8,
    i: usize,
    c: *t.FilterCondition,
    comptime fixedLen: bool,
    compare: anytype,
) bool {
    const query: []u8 = q[i .. c.size + i];
    var value: []const u8 = undefined;
    if (fixedLen) {
        // Can add assertion with unreachable for 64
        value = v[1 + c.start .. v[c.start] + 1 + c.start];
    } else if (v.len == 0) {
        return false;
    } else if (v[1] == 1) {
        return deflate.decompress(thread, void, compare, query, v, undefined);
    } else {
        value = v[2 .. v.len - 4];
    }
    return compare(query, value);
}

pub fn incLcase(query: []const u8, value: []const u8) bool {
    return includeInner(.lower, query, value);
}

pub fn incLcaseFast(query: []const u8, value: []const u8) bool {
    return includeInner(.lowerFast, query, value);
}

pub fn inc(query: []const u8, value: []const u8) bool {
    return includeInner(.default, query, value);
}

pub fn like(query: []const u8, value: []const u8) bool {
    // for search it passes a number might add a comptime var
    const bla = likeInner(3, query, value);
    // std.debug.print("bla {any} \n", .{bla});
    return bla < 4; // make this config first number in query
}

pub const eqCrc32 = @import("./eqCrc32.zig").eqCrc32;

pub const eqCrc32Batch = @import("./eqCrc32.zig").eqCrc32Batch;

pub const eq = @import("./eq.zig").eq;

pub const eqBatch = @import("./eq.zig").eqBatch;
