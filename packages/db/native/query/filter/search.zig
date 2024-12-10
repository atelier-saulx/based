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
const minDist = 2; // 0,1 is fine

pub const SearchCtx = struct {
    fields: []u8,
    len: u16,
    allQueries: []u8,
    words: u16,
    meh: u8,
    bad: u8,
};

pub fn createSearchCtx(searchBuf: []u8) SearchCtx {
    const sLen = readInt(u16, searchBuf, 0);
    const words = readInt(u8, searchBuf, 2);
    const fields = searchBuf[2 + sLen .. searchBuf.len];

    var totalWeights: u8 = 0;
    var j: usize = 0;
    var totalfields: u8 = 0;
    while (j < fields.len) {
        const weight = fields[j + 1];
        totalWeights += weight;
        j += 2;
        totalfields += 1;
    }
    // all weight / 2
    return .{
        .len = sLen,
        .allQueries = searchBuf[3..sLen],
        .fields = fields,
        .words = words,
        .meh = words * 2,
        .bad = (words - 1) * 3 + @divTrunc(totalWeights, totalfields),
    };
}

fn hamming(
    value: []u8,
    i: usize,
    query: []u8,
) u8 {
    const queryD = query[1..query.len];
    const ql = queryD.len;
    const d: u8 = @truncate(selva.strsearch_hamming(
        value[i + 1 .. i + 1 + ql].ptr,
        queryD.ptr,
        ql,
    ));
    return d;
}

fn resultMatcher(
    dx: u8,
    matches: @Vector(vectorLen, bool),
    i: usize,
    value: []u8,
    query: []u8,
) u8 {
    var d: u8 = dx;
    const ql = query.len;
    const l = value.len;
    const result = @select(u8, matches, indexes, nulls);
    const index: usize = @reduce(.Min, result) + i;
    if (index + ql > l) {
        return d;
    }
    if (index == 1 or simd.countElementsWithValue(seperatorChars, value[index - 1]) > 0) {
        const nd = hamming(value, index, query);
        if (nd < minDist) {
            return nd;
        } else if (nd < d) {
            d = nd;
        }
    }
    if (@reduce(.Xor, matches) == false) {
        var p: usize = index - i + 1;
        while (p < vectorLen) : (p += 1) {
            if (matches[p]) {
                if (simd.countElementsWithValue(seperatorChars, value[p + i - 1]) > 0) {
                    const nd = hamming(value, p + i, query);
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
    query: []u8,
) u8 {
    var i: usize = 1;
    const l = value.len;
    const ql = query.len;
    const q1 = query[0];
    const q2 = query[0] - 32;
    var d: u8 = 10;
    if (l < vectorLen) {
        while (i < l - 1) : (i += 1) {
            if ((value[i] == q1 or value[i] == q2) and (i == 1 or simd.countElementsWithValue(seperatorChars, value[i - 1]) > 0)) {
                if (i + ql - 1 > l) {
                    return d;
                }
                const nd = hamming(value, i, query);
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
            d = resultMatcher(d, matches, i, value, query);
            if (d < minDist) {
                return d;
            }
        }
        matches = h == queryVectorCaptial;
        if (@reduce(.Or, matches)) {
            d = resultMatcher(d, matches, i, value, query);
            if (d < minDist) {
                return d;
            }
        }
    }
    while (i < l - 1) : (i += 1) {
        if ((value[i + 1] == q1 or value[i + 1] == q2) and simd.countElementsWithValue(seperatorChars, value[i]) > 0) {
            if (i + ql - 1 > l) {
                return d;
            }
            const nd = hamming(value, i + 1, query);
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
    node: *selva.SelvaNode,
    typeEntry: *selva.SelvaTypeEntry,
    ctx: *const SearchCtx,
) u8 {
    const fl = ctx.fields.len;
    var p: usize = 0;
    var totalScore: u8 = 0;
    wordLoop: while (p < ctx.allQueries.len) {
        const qLen = readInt(u16, ctx.allQueries, p);
        const query = ctx.allQueries[p + 2 .. p + qLen + 2];
        p += qLen + 2;
        var j: usize = 0;
        var bestScore: u8 = 255;
        fieldLoop: while (j < fl) {
            const field = ctx.fields[j];
            const weight = ctx.fields[j + 1];
            const fieldSchema = db.getFieldSchema(field, typeEntry) catch {
                return 255;
            };
            const value = db.getField(typeEntry, 0, node, fieldSchema);
            if (value.len < query.len) {
                j += 2;
                continue :fieldLoop;
            }
            const isCompressed = value[0] == 1;
            if (isCompressed) {
                // ADD NOW
                // ---- do later
            } else {
                // if (totalScore + weight > ctx.bad) {
                //     return totalScore + weight;
                // }
                var score: u8 = 0;
                score = strSearch(value, query) + weight;
                if (score < bestScore) {
                    bestScore = score;
                }
                if (score - weight == 0) {
                    j += 2;
                    continue :wordLoop;
                }
            }
            j += 2;
        }
        totalScore += bestScore;
        if (totalScore > ctx.bad) {
            return totalScore;
        }
    }
    return totalScore;
}
