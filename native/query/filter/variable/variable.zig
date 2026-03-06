const std = @import("std");
const Query = @import("../../common.zig");
const utils = @import("../../../utils.zig");
const Node = @import("../../../selva/node.zig");
const Schema = @import("../../../selva/schema.zig");
const Fields = @import("../../../selva/fields.zig");
const t = @import("../../../types.zig");
const Thread = @import("../../../thread/thread.zig");

const deflate = @import("./deflate.zig");
const includeInner = @import("./includes.zig").includeInner;

pub fn parse(
    thread: *Thread.Thread,
    q: []u8,
    v: []const u8,
    qI: usize,
    c: *t.FilterCondition,
    comptime fixedLen: bool,
    compare: anytype,
) bool {
    const query: []u8 = q[qI .. c.size + qI];
    var value: []const u8 = undefined;
    if (fixedLen) {
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

const includeInner2 = @import("./includesLcase.zig").loose;

pub fn incLcase(query: []const u8, value: []const u8) bool {
    return includeInner(true, query, value);
}

pub fn inc(query: []const u8, value: []const u8) bool {
    return includeInner(false, query, value);
}

pub const eqCrc32 = @import("./eqCrc32.zig").eqCrc32;

pub const eq = @import("./eq.zig").eq;
