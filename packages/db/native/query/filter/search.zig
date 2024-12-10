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
const capitals: @Vector(vectorLen, u8) = @splat(32);

// TODO: Make this as context!
const seperatorChars: @Vector(8, u8) = .{ 10, 32, 34, 39, 45, 46, 59, 58 };
const minDist = 1;

pub const SearchCtx = struct {
    query: []u8,
    fields: []u8,
    queryDistance: []u8,
};

pub fn createSearchCtx(searchBuf: []u8) SearchCtx {
    const sLen = readInt(u16, searchBuf, 0);
    return .{
        .query = searchBuf[2 .. 2 + sLen],
        .queryDistance = searchBuf[3 .. 2 + sLen],
        .fields = searchBuf[2 + sLen .. searchBuf.len],
    };
}

fn levenshtein(
    value: []u8,
    i: usize,
    ctx: *const SearchCtx,
) u8 {
    const ql = ctx.queryDistance.len;
    const d = selva.strsearch_levenshtein_u8(
        value[i + 1 .. i + 1 + ql].ptr,
        ql,
        ctx.queryDistance.ptr,
        ql,
    );
    return d;
}

fn resultMatcher(
    dx: u8,
    matches: @Vector(vectorLen, bool),
    i: usize,
    value: []u8,
    ctx: *const SearchCtx,
) u8 {
    const query = ctx.query;
    var d: u8 = dx;
    const ql = query.len;
    const l = value.len;
    const result = @select(u8, matches, indexes, nulls);
    const index: usize = @reduce(.Min, result) + i;
    if (index + ql > l) {
        return d;
    }
    if (index == 0 or simd.countElementsWithValue(seperatorChars, value[index - 1]) > 0) {
        const nd = levenshtein(value, index, ctx);
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
                    const nd = levenshtein(value, p + i, ctx);
                    if (nd < minDist) {
                        return nd;
                    } else if (nd < d) {
                        d = nd;
                    }
                }
            }
        }
    }
    return d;
}

pub inline fn strSearch(
    value: []u8,
    ctx: *const SearchCtx,
) u8 {
    var i: usize = 0;
    const query = ctx.query;
    const l = value.len;
    const ql = query.len;
    const q1 = query[0];
    const q2 = query[0] - 32;
    var d: u8 = 255;
    if (l < vectorLen) {
        while (i < l - 1) : (i += 1) {
            if ((value[i + 1] == q1 or value[i + 1] == q2) and simd.countElementsWithValue(seperatorChars, value[i]) > 0) {
                if (i + ql - 1 > l) {
                    return d;
                }
                const nd = levenshtein(value, i + 1, ctx);
                if (nd < minDist) {
                    return nd;
                } else if (nd < d) {
                    d = nd;
                }
            }
        }
        return d;
    }
    const queryVector: @Vector(vectorLen, u8) = @splat(q1);
    const queryVectorCaptial: @Vector(vectorLen, u8) = @splat(q2);
    while (i <= (l - vectorLen)) : (i += vectorLen) {
        const h: @Vector(vectorLen, u8) = value[i..][0..vectorLen].*;
        var matches = h == queryVector;
        if (@reduce(.Or, matches)) {
            d = resultMatcher(d, matches, i, value, ctx);
            if (d < minDist) {
                return d;
            }
            matches = h == queryVectorCaptial;
            if (@reduce(.Or, matches)) {
                d = resultMatcher(d, matches, i, value, ctx);
                if (d < minDist) {
                    return d;
                }
            }
        }
    }
    while (i < l - 1) : (i += 1) {
        if ((value[i + 1] == q1 or value[i + 1] == q2) and simd.countElementsWithValue(seperatorChars, value[i]) > 0) {
            if (i + ql - 1 > l) {
                return d;
            }
            const nd = levenshtein(value, i + 1, ctx);
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
    ctx: *const SearchCtx,
    // ref: ?types.RefStruct,
    // comptime isEdge: bool,
) u32 {
    var j: usize = 0;
    var bestScore: u8 = 255;
    const fl = ctx.fields.len;
    while (j < fl) {
        const field = ctx.fields[j];
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
            const score = strSearch(value, ctx);
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
