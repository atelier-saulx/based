const t = @import("../../../types.zig");
const utils = @import("../../../utils.zig");
const std = @import("std");

const vectorLenU8 = std.simd.suggestVectorLength(u8) orelse 16;
const MAX_FIXED_LEN = 64;

pub fn eq(
    query: []const u8,
    value: []const u8,
) bool {
    var i: usize = 0;
    const l = value.len;

    // Compiler optmization will unroll some while loops
    if (l > MAX_FIXED_LEN) unreachable;

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

pub fn eqBatch(
    query: []const u8,
    value: []const u8,
) bool {
    var i: usize = 0;
    while (i < query.len) {
        const size = query[i];
        if (eq(query[i + 1 .. i + 1 + size], value)) {
            return true;
        }
        i += size + 1;
    }
    return false;
}
