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

const Instruction = @import("../instruction.zig");

// This is a trick to lower the amount of comptime generated options
// pub const Fixed = @import("./types.zig").Fixed;
// pub const Localized = @import("./types.zig").Localized;

const Type = enum(u8) {
    default = 0,
    fixed = 1,
    localized = 2,
    raw = 3,
};

inline fn valueType(
    thread: *Thread.Thread,
    query: []const u8,
    v: []const u8,
    compareFn: anytype,
) bool {
    var value: []const u8 = undefined;
    if (v.len == 0) {
        return false;
    } else if (v[1] == 1) {
        return deflate.decompress(thread, void, compareFn, query, v, undefined);
    } else {
        value = v[2 .. v.len - 4];
    }
    return compareFn(query, value);
}

pub fn parse(
    comptime T: Type,
    thread: *Thread.Thread,
    q: []const u8,
    v: []const u8,
    i: usize,
    c: *t.FilterCondition,
    compareFn: anytype,
) bool {
    const query: []const u8 = q[i .. c.size + i];
    if (T == .localized) {
        if (c.lang == t.LangCode.none) {
            var iter = Fields.textIterator(@constCast(v));
            while (iter.next()) |value| {
                if (valueType(thread, query, value, compareFn)) {
                    return true;
                }
            }
            return false;
        } else {
            return valueType(
                thread,
                query,
                Fields.textFromValue(@constCast(v), c.lang),
                compareFn,
            );
        }
    } else if (T == .raw) {
        return compareFn(query, v);
    } else if (T == .fixed) {
        return compareFn(query, v[1 + c.start .. v[c.start] + 1 + c.start]);
    } else {
        return valueType(thread, query, v, compareFn);
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

pub inline fn compare(
    T: Type, //
    comptime op: t.FilterOpCompare,
    q: []u8,
    v: []const u8,
    index: usize,
    c: *t.FilterCondition,
    thread: *Thread.Thread,
) bool {
    const meta = comptime Instruction.parseOp(op, true);
    const res = switch (meta.func) {
        // --------------------
        .eqCrc32 => eqCrc32(if (T == .localized) .localized else .default, q, v, index, c),
        .eqCrc32Batch => eqCrc32Batch(if (T == .localized) .localized else .default, q, v, index, c),
        // --------------------
        // *Can be wrapped like crc32
        .eqVar => parse(T, thread, q, v, index, c, eq),
        .eqVarBatch => parse(T, thread, q, v, index, c, eqBatch),
        // --------------------
        .inc => parse(T, thread, q, v, index, c, inc),
        .incLcase => parse(T, thread, q, v, index, c, incLcase),
        .incLcaseFast => parse(T, thread, q, v, index, c, incLcaseFast),
        .incBatch => parse(T, thread, q, v, index, c, incBatch),
        .incBatchLcase => parse(T, thread, q, v, index, c, incBatchLcase),
        .incBatchLcaseFast => parse(T, thread, q, v, index, c, incBatchLcaseFast),
        // --------------------
        .like => parse(T, thread, q, v, index, c, like),
        .likeBatch => parse(T, thread, q, v, index, c, likeBatch),
        // --------------------
    };
    return if (meta.invert) !res else res;
}
