const std = @import("std");
const simd = std.simd;
const readInt = @import("../../utils.zig").readInt;
const selva = @import("../../selva.zig");
const db = @import("../../db//db.zig");
const types = @import("../include//types.zig");
const like = @import("./like.zig").default;
const compressed = @import("./compressed.zig");
const decompress = compressed.decompress;

const vectorLen = std.simd.suggestVectorLength(u8).?;
const nulls: @Vector(vectorLen, u8) = @splat(255);
const indexes = std.simd.iota(u8, vectorLen);

// TODO: Make this as context!
const seperatorChars: @Vector(8, u8) = .{ 10, 32, 34, 39, 45, 46, 59, 58 };
const minDist = 1;

pub inline fn strSearch(value: []const u8, query: []const u8) u8 {
    var i: usize = 0;
    const l = value.len;
    const ql = query.len;
    const q1 = query[0];
    var d: u8 = 255;
    if (l < vectorLen) {
        while (i < l - 1) : (i += 1) {
            if (value[i + 1] == q1 and simd.countElementsWithValue(seperatorChars, value[i]) > 0) {
                if (i + ql - 1 > l) {
                    return d;
                }
                const nd = selva.strsearch_levenshtein_u8(
                    value[i + 1 .. i + 1 + query.len].ptr,
                    query.len,
                    query.ptr,
                    query.len,
                );
                if (nd < minDist) {
                    return nd;
                } else if (nd < d) {
                    d = nd;
                }
            }
        }
    }
    const queryVector: @Vector(vectorLen, u8) = @splat(q1);
    while (i <= (l - vectorLen)) : (i += vectorLen) {
        const h: @Vector(vectorLen, u8) = value[i..][0..vectorLen].*;
        const matches = h == queryVector;
        if (@reduce(.Or, matches)) {
            const result = @select(u8, matches, indexes, nulls);
            const index = @reduce(.Min, result) + i;
            if (index + ql - 1 > l) {
                return d;
            }
            if (index == 0 or simd.countElementsWithValue(seperatorChars, value[index - 1]) > 0) {
                const nd = selva.strsearch_levenshtein_u8(
                    value[index .. index + query.len].ptr,
                    query.len,
                    query.ptr,
                    query.len,
                );
                if (nd < minDist) {
                    return nd;
                } else if (nd < d) {
                    d = nd;
                }
            }
            if (@reduce(.Xor, matches) == false) {
                var p: usize = index - i;
                while (p < vectorLen) : (p += 1) {
                    if (matches[p]) {
                        if (simd.countElementsWithValue(seperatorChars, value[p + i - 1]) > 0) {
                            const nd = selva.strsearch_levenshtein_u8(
                                value[p + i .. p + i + query.len].ptr,
                                query.len,
                                query.ptr,
                                query.len,
                            );
                            if (nd < minDist) {
                                return nd;
                            } else if (nd < d) {
                                d = nd;
                            }
                        }
                    }
                }
            }
        }
    }
    while (i < l - 1) : (i += 1) {
        if (value[i + 1] == q1 and simd.countElementsWithValue(seperatorChars, value[i]) > 0) {
            if (i + ql - 1 > l) {
                return d;
            }
            const nd = selva.strsearch_levenshtein_u8(
                value[i + 1 .. i + 1 + query.len].ptr,
                query.len,
                query.ptr,
                query.len,
            );
            if (nd < minDist) {
                return nd;
            } else if (nd < d) {
                d = nd;
            }
        }
    }
    return d;
}

pub fn search(
    _: *db.DbCtx,
    node: *selva.SelvaNode,
    typeEntry: *selva.SelvaTypeEntry,
    searchBuf: []u8,
    searchLen: u16,
    // ref: ?types.RefStruct,
    // comptime isEdge: bool,
) u32 {
    const sl = searchBuf.len;
    var j: usize = searchLen + 2;
    var bestScore: u8 = 255;
    while (j < sl) {
        const field = searchBuf[j];
        const fieldSchema = db.getFieldSchema(field, typeEntry) catch {
            return 0;
        };
        const value = db.getField(typeEntry, 0, node, fieldSchema);
        if (value.len == 0) {
            j += 2;

            continue;
        }
        const isCompressed = value[0] == 1;
        if (isCompressed) {
            // ---- do later
        } else {
            const score = strSearch(value, searchBuf[2 .. searchLen + 2]);
            if (score < 2) {
                return score;
            } else if (score < bestScore) {
                bestScore = score;
            }
        }
        j += 2;
    }

    return bestScore;
}
