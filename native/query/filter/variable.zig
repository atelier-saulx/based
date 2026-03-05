const std = @import("std");
const Query = @import("../common.zig");
const utils = @import("../../utils.zig");
const Node = @import("../../selva/node.zig");
const Schema = @import("../../selva/schema.zig");
const Fields = @import("../../selva/fields.zig");
const t = @import("../../types.zig");

// put this in file variableSize
const vectorLenU8 = std.simd.suggestVectorLength(u8).?;
const indexes = std.simd.iota(u8, vectorLenU8);
const nulls: @Vector(vectorLenU8, u8) = @splat(@as(u8, 255));

pub fn parseValue(
    q: []u8,
    v: []const u8,
    qI: usize,
    c: *t.FilterCondition,
    comptime fixedLen: bool,
    compare: anytype,
) bool {
    const query: []u8 = q[qI .. c.size + qI];
    // make fn
    var value: []const u8 = undefined;
    if (fixedLen) {
        value = v[1 + c.start .. v[c.start] + 1 + c.start];
    } else if (v[0] == 1) {
        // compressed different pathway
    } else {
        value = v[2 .. v.len - 4];
    }
    return compare(query, value);
}

pub fn include(
    query: []u8,
    value: []const u8,
) bool {
    // this is a seperate inline fn
    var i: usize = 0;
    const l = value.len;
    const ql = query.len;
    if (l < vectorLenU8) {
        while (i < l) : (i += 1) {
            if (value[i] == query[0]) {
                if (i + ql - 1 > l) {
                    return false;
                }
                var j: usize = 1;
                while (j < ql) : (j += 1) {
                    if (value[i + j] != query[j]) {
                        break;
                    }
                }
                if (j == ql) {
                    return true;
                }
            }
        }
        return false;
    }
    const queryVector: @Vector(vectorLenU8, u8) = @splat(query[0]);
    while (i <= (l - vectorLenU8)) : (i += vectorLenU8) {
        const h: @Vector(vectorLenU8, u8) = value[i..][0..vectorLenU8].*;
        const matches = h == queryVector;
        if (@reduce(.Or, matches)) {
            if (l > 1) {
                const result = @select(u8, matches, indexes, nulls);
                const index = @reduce(.Min, result) + i;
                if (index + ql - 1 > l) {
                    return false;
                }
                var j: usize = 1;
                while (j < ql) : (j += 1) {
                    if (value[index + j] != query[j]) {
                        break;
                    }
                }
                if (j == ql) {
                    return true;
                }
            }
        }
    }
    while (i < l and ql <= l - i) : (i += 1) {
        const id2 = value[i];
        if (id2 == query[0]) {
            if (i + ql - 1 > l) {
                return false;
            }
            var j: usize = 1;
            while (j < ql) : (j += 1) {
                if (value[i + j] != query[j]) {
                    break;
                }
            }
            if (j == ql) {
                return true;
            }
            return true;
        }
    }
    return false;
}

pub fn eqVar(
    query: []u8,
    value: []const u8,
) bool {
    var i: usize = 0;
    const l = value.len;
    const ql = query.len;
    if (l != ql) {
        return false;
    }
    if (l < vectorLenU8) {
        while (i < l) : (i += 1) {
            if (value[i] != query[i]) {
                return false;
            }
        }
        return true;
    }
    while (i + vectorLenU8 <= l) : (i += vectorLenU8) {
        const v: @Vector(vectorLenU8, u8) = value[i..][0..vectorLenU8].*;
        const q: @Vector(vectorLenU8, u8) = query[i..][0..vectorLenU8].*;
        if (!@reduce(.And, v == q)) {
            return false;
        }
    }
    if (i < l) {
        const offset = l - vectorLenU8;
        const v: @Vector(vectorLenU8, u8) = value[offset..][0..vectorLenU8].*;
        const q: @Vector(vectorLenU8, u8) = query[offset..][0..vectorLenU8].*;
        if (!@reduce(.And, v == q)) {
            return false;
        }
    }
    return true;
}

// different format
pub fn eqCrc32(
    q: []u8,
    v: []const u8,
    i: usize,
    c: *t.FilterCondition,
) bool {
    if (v[0] == 1) {
        // compressed different pathway (different positing)
    } else {
        if (utils.readPtr(u32, q, i + 4 + @alignOf(u32) - c.offset).* != v.len - 6) {
            return false;
        }
        if (utils.read(u32, v, v.len - 4) != utils.readPtr(u32, q, i + @alignOf(u32) - c.offset).*) {
            return false;
        }
    }
    return true;
}
