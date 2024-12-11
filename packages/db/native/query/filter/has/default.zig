const std = @import("std");
const simd = std.simd;
const readInt = @import("../../../utils.zig").readInt;
const selva = @import("../../../selva.zig");

const vectorLen = std.simd.suggestVectorLength(u8).?;
const nulls: @Vector(vectorLen, u8) = @splat(255);
const indexes = std.simd.iota(u8, vectorLen);

pub fn default(value: []const u8, query: []const u8) bool {
    std.debug.print("HELLO DEFAULT {any} {d}\n", .{ value[0..50], value.len });

    var i: usize = 0;
    const l = value.len;
    const ql = query.len;
    if (l < vectorLen) {
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
    const queryVector: @Vector(vectorLen, u8) = @splat(query[0]);
    while (i <= (l - vectorLen)) : (i += vectorLen) {
        const h: @Vector(vectorLen, u8) = value[i..][0..vectorLen].*;
        const matches = h == queryVector;
        if (@reduce(.Or, matches)) {
            const result = @select(u8, matches, indexes, nulls);
            const index = @reduce(.Min, result) + i;
            if (index + ql - 1 > l) {
                return false;
            }
            var j: usize = 1;
            while (j < ql) : (j += 1) {
                const v = value[index + j];
                const q = query[j];
                if ((v != q)) {
                    break;
                }
            }
            if (j == ql) {
                return true;
            } else if (@reduce(.Xor, matches) == false) {
                var p: usize = index - i;
                while (p < vectorLen) : (p += 1) {
                    if (matches[p]) {
                        j = 1;
                        if (p + i + ql - 1 > l) {
                            return false;
                        }
                        while (j < ql) : (j += 1) {
                            const v = value[p + i + j];
                            const q = query[j];
                            if ((v != q)) {
                                break;
                            }
                        }
                        if (j == ql) {
                            return true;
                        }
                    }
                }
            }
        }
    }
    while (i < l) : (i += 1) {
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
        }
    }
    return false;
}
