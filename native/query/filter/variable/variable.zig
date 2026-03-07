const std = @import("std");
const Query = @import("../../common.zig");
const utils = @import("../../../utils.zig");
const Node = @import("../../../selva/node.zig");
const Schema = @import("../../../selva/schema.zig");
const Fields = @import("../../../selva/fields.zig");
const t = @import("../../../types.zig");
const Thread = @import("../../../thread/thread.zig");

const deflate = @import("./deflate.zig");
const include = @import("./includes.zig");
const likeInner = @import("./like.zig").like;

// This is a trick to lower the amount of comptime generated options
// pub const Fixed = @import("./types.zig").Fixed;
// pub const Localized = @import("./types.zig").Localized;

pub const Type = @import("./types.zig").Type;

inline fn valueType(
    thread: *Thread.Thread,
    query: []const u8,
    v: []const u8,
    compare: anytype,
) bool {
    var value: []const u8 = undefined;
    if (v.len == 0) {
        return false;
    } else if (v[1] == 1) {
        return deflate.decompress(thread, void, compare, query, v, undefined);
    } else {
        value = v[2 .. v.len - 4];
    }
    return compare(query, value);
}

pub fn parse(
    comptime T: Type,
    thread: *Thread.Thread,
    q: []const u8,
    v: []const u8,
    i: usize,
    c: *t.FilterCondition,
    compare: anytype,
) bool {
    const query: []const u8 = q[i .. c.size + i];
    if (T == .localized) {
        if (c.lang == t.LangCode.none) {
            var iter = Fields.textIterator(@constCast(v));
            while (iter.next()) |value| {
                if (valueType(thread, query, value, compare)) {
                    return true;
                }
            }
            return false;
        } else {
            return valueType(
                thread,
                query,
                Fields.textFromValue(@constCast(v), c.lang),
                compare,
            );
        }
    } else if (T == .fixed) {
        return compare(query, v[1 + c.start .. v[c.start] + 1 + c.start]);
    } else {
        return valueType(thread, query, v, compare);
    }
}

// ---- Includes --------
inline fn iterateInc(comptime case: include.Case, query: []const u8, value: []const u8) bool {
    var i: usize = 0;
    while (i < query.len) {
        const size = utils.read(u32, query, i);
        if (include.include(case, query[i + 4 .. i + 4 + size], value)) {
            return true;
        }
        i += size + 4;
    }
    return false;
}

pub fn inc(query: []const u8, value: []const u8) bool {
    return include.include(.default, query, value);
}

pub fn incLcase(query: []const u8, value: []const u8) bool {
    return include.include(.lower, query, value);
}

pub fn incLcaseFast(query: []const u8, value: []const u8) bool {
    return include.include(.lowerFast, query, value);
}

pub fn incBatch(query: []const u8, value: []const u8) bool {
    return iterateInc(.default, query, value);
}

pub fn incBatchLcase(query: []const u8, value: []const u8) bool {
    return iterateInc(.lower, query, value);
}

pub fn incBatchLcaseFast(query: []const u8, value: []const u8) bool {
    return iterateInc(.lowerFast, query, value);
}

// ---- Like --------

pub fn like(query: []const u8, value: []const u8) bool {
    const minScore = query[0];
    return likeInner(minScore, query, value) <= minScore;
}

pub fn likeBatch(query: []const u8, value: []const u8) bool {
    const minScore = query[0];
    var i: usize = 1;
    while (i < query.len) {
        const size = utils.read(u32, query, i);
        if (likeInner(minScore, query[i + 4 .. i + 4 + size], value) <= minScore) {
            return true;
        }
        i += size + 4;
    }
    return false;
}

// ---- EqCrc --------

pub const eqCrc32 = @import("./eqCrc32.zig").eqCrc32;

pub const eqCrc32Batch = @import("./eqCrc32.zig").eqCrc32Batch;

// ---- Eq --------

pub const eq = @import("./eq.zig").eq;

pub const eqBatch = @import("./eq.zig").eqBatch;
