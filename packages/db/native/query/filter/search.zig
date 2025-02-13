const std = @import("std");
const simd = std.simd;
const read = @import("../../utils.zig").read;
const selva = @import("../../selva.zig");
const db = @import("../../db//db.zig");
const types = @import("../include/types.zig");
const compressed = @import("./compressed.zig");
const decompress = compressed.decompress;
const Prop = @import("../../types.zig").Prop;
const LangCode = @import("../../types.zig").LangCode;

const vectorLen = std.simd.suggestVectorLength(u8).?;
const nulls: @Vector(vectorLen, u8) = @splat(255);
const indexes = std.simd.iota(u8, vectorLen);
const capitals: @Vector(vectorLen, u8) = @splat(32);

const seperatorChars: @Vector(8, u8) = .{ '\n', ' ', '"', '\'', '-', '.', ':', ';' };
const minDist = 2; // 0,1 is fine

inline fn isSeparator(ch: u8) bool {
    return simd.countElementsWithValue(seperatorChars, ch) > 0;
}

pub const SearchCtx = struct {
    fields: []u8,
    len: u16,
    allQueries: []u8,
    words: u16,
    meh: u8,
    bad: u8,
};

pub fn createSearchCtx(searchBuf: []u8) SearchCtx {
    const sLen = read(u16, searchBuf, 0);
    const words = read(u8, searchBuf, 2);
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
    return .{
        .len = sLen,
        .allQueries = searchBuf[3..sLen],
        .fields = fields,
        .words = words,
        .meh = words * 1,
        .bad = 2 + (words - 1) * 3 + @divTrunc(totalWeights, totalfields),
    };
}

fn hamming_ascii(
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

fn hamming_mbs(
    value: []u8,
    i: usize,
    query: []u8,
) u8 {
    const mbs = value[i + 1 .. value.len];
    const t = query[1..query.len];
    const d: u8 = @truncate(selva.strsearch_hamming_mbs(mbs.ptr, mbs.len, t.ptr, t.len));

    return d;
}

inline fn min(a: usize, b: usize) usize {
    if (a < b) return a;
    return b;
}

fn hamming(
    value: []u8,
    i: usize,
    query: []u8,
) u8 {
    var j: usize = 1;
    const l = min(value.len, 5 * query.len);
    var res: bool = false;

    while (j < l) : (j += 8) {
        const x: u64 = read(u64, value, j);
        res = res or (x & 0x8080808080808080) != 0;
    }
    while (j < l) : (j += 4) {
        const x: u32 = read(u32, value, j);
        res = res or (x & 0x80808080) != 0;
    }
    while (j < l) : (j += 1) {
        res = res or (value[j] & 0x80) != 0;
    }
    if (res) {
        return hamming_mbs(value, i, query);
    }
    return hamming_ascii(value, i, query);
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
    if (index == 1 or isSeparator(value[index - 1])) {
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
                if (isSeparator(value[p + i - 1])) {
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

pub fn strSearch(
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
            if ((value[i] == q1 or value[i] == q2) and (i == 1 or isSeparator(value[i - 1]))) {
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
    const queryVectorCapital: @Vector(vectorLen, u8) = @splat(q2);
    while (i <= (l - vectorLen)) : (i += vectorLen) {
        const h: @Vector(vectorLen, u8) = value[i..][0..vectorLen].*;
        var matches = h == queryVector;
        if (@reduce(.Or, matches)) {
            d = resultMatcher(d, matches, i, value, query);
            if (d < minDist) {
                return d;
            }
        }
        matches = h == queryVectorCapital;
        if (@reduce(.Or, matches)) {
            d = resultMatcher(d, matches, i, value, query);
            if (d < minDist) {
                return d;
            }
        }
    }
    while (i < l - 1) : (i += 1) {
        if ((value[i + 1] == q1 or value[i + 1] == q2) and isSeparator(value[i])) {
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

pub fn strSearchCompressed(
    value: []u8,
    query: []u8,
    d: *u8,
) bool {
    const score = strSearch(value, query);
    if (score < d.*) {
        d.* = score;
    }
    if (score < minDist) {
        return true;
    }
    return false;
}

inline fn getScore(
    dbCtx: *db.DbCtx,
    value: []u8,
    query: []u8,
    score: *u8,
    penalty: u8,
) bool {
    const isCompressed = value[1] == 1;
    if (isCompressed) {
        _ = decompress(
            *u8,
            strSearchCompressed,
            query,
            value,
            dbCtx,
            score,
        );
        score.* = score.* + penalty;
    } else {
        if (value.len - 6 < query.len) {
            return true;
        }
        score.* = strSearch(value[2 .. value.len - 4], query) + penalty;
    }
    return false;
}

pub fn search(
    dbCtx: *db.DbCtx,
    node: *selva.SelvaNode,
    typeEntry: *selva.SelvaTypeEntry,
    ctx: *const SearchCtx,
) u8 {
    const fl = ctx.fields.len;
    var p: usize = 0;
    var totalScore: u8 = 0;
    var j: usize = 0;
    var bestScore: u8 = 255;
    wordLoop: while (p < ctx.allQueries.len) {
        const qLen = read(u16, ctx.allQueries, p);
        const query = ctx.allQueries[p + 2 .. p + qLen + 2];
        p += qLen + 2;
        j = 0;
        bestScore = 255;
        fieldLoop: while (j < fl) : (j += 5) {
            const field = ctx.fields[j];
            const penalty = ctx.fields[j + 1];
            const fieldSchema = db.getFieldSchema(field, typeEntry) catch {
                return 255;
            };
            var score: u8 = 255;
            if (field == 0) {
                const value = db.getField(typeEntry, 0, node, fieldSchema);
                const start = read(u16, ctx.fields, j + 2);
                const len = value[start];
                if (len < query.len) {
                    continue :fieldLoop;
                }
                const str = value[start + 1 .. start + 1 + len];
                score = strSearch(str, query) + penalty;
                if (score < bestScore) {
                    bestScore = score;
                    if (score - penalty == 0) {
                        totalScore += bestScore;
                        continue :wordLoop;
                    }
                }
            } else {
                const value = db.getField(typeEntry, 0, node, fieldSchema);
                if (value.len == 0) {
                    continue :fieldLoop;
                }
                const prop: Prop = @enumFromInt(fieldSchema.*.type);
                if (prop == Prop.TEXT) {
                    const code: LangCode = @enumFromInt(ctx.fields[j + 4]);
                    var iter = db.textIterator(value, code);
                    while (iter.next()) |s| {
                        score = 255;
                        _ = getScore(dbCtx, s, query, &score, penalty);
                        if (score < bestScore) {
                            bestScore = score;
                            if (score - penalty == 0) {
                                totalScore += bestScore;
                                continue :wordLoop;
                            }
                        }
                    }
                } else {
                    if (getScore(dbCtx, value, query, &score, penalty)) {
                        continue :fieldLoop;
                    }
                    if (score < bestScore) {
                        bestScore = score;
                        if (score - penalty == 0) {
                            totalScore += bestScore;
                            continue :wordLoop;
                        }
                    }
                }
            }
        }
        totalScore += bestScore;
        if (totalScore > ctx.bad) {
            return totalScore;
        }
    }
    return totalScore;
}
