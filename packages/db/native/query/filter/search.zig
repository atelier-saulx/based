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
const VectorFn = @import("./types.zig").VectorFn;
const MAIN_PROP = @import("../../types.zig").MAIN_PROP;
const MaxVectorScore = @import("./types.zig").MaxVectorScore;
const vectorScore = @import("./has/vector.zig").vec;
const move = @import("../../utils.zig").move;
const Compression = @import("../../types.zig").Compression;
const LibdeflateDecompressor = @import("../../db/decompress.zig").LibdeflateDecompressor;
const LibdeflateBlockState = @import("../../db/decompress.zig").LibdeflateBlockState;

const vectorLen = std.simd.suggestVectorLength(u8).?;
const nulls: @Vector(vectorLen, u8) = @splat(255);
const indexes = std.simd.iota(u8, vectorLen);
const capitals: @Vector(vectorLen, u8) = @splat(32);
const seperatorChars: @Vector(8, u8) = .{ '\n', ' ', '"', '\'', '-', '.', ':', ';' };
const minDist = 2; // 0,1 is fine

inline fn isSeparator(ch: u8) bool {
    return simd.countElementsWithValue(seperatorChars, ch) > 0;
}

pub fn SearchCtx(comptime isVector: bool) type {
    if (isVector) {
        return struct {
            field: u8,
            query: []f32,
            func: VectorFn,
            score: f32,
        };
    }
    return struct {
        fields: []u8,
        len: u16,
        allQueries: []u8,
        words: u16,
        meh: u8,
        bad: u8,
        score: u8,
    };
}

pub fn createSearchCtx(comptime isVector: bool, searchBuf: []u8) SearchCtx(isVector) {
    if (!isVector) {

        // Non-Vector Search Binary Schema:

        // | Offset | Field    | Size (bytes) | Description                                |
        // |--------|----------|--------------|--------------------------------------------|
        // | 0      | isVector | 1            | Indicates if search is a vector (always 0) |
        // | 1      | queryLen | 2            | Length of the query in bytes (u16)         |
        // | 3      | words    | 1            | Query words                                 |
        // | X      | fields   | Variable     | Sorted fields metadata                     |

        // ### Fields Metadata Structure:
        // Each field entry consists of 6 bytes:

        // | Offset | Field     | Size (bytes)| Description                          |
        // |--------|-----------|-------------|--------------------------------------|
        // | 0      | field     | 1           | Field identifier                     |
        // | 1      | typeIndex | 1           | Type index of the field              |
        // | 2      | weight    | 1           | Field weight value                   |
        // | 3      | start     | 2           | Start position in the query (u16)    |
        // | 5      | lang      | 1           | Language identifier                  |
        // | 6      | fallback  | 4           | Language fallback                    |

        const sLen = read(u16, searchBuf, 1);
        const words = read(u8, searchBuf, 3);
        const fields = searchBuf[3 + sLen .. searchBuf.len];
        var j: usize = 0;
        var totalfields: u8 = 0;
        var totalWeights: u8 = 0;
        while (j < fields.len) {
            const weight = fields[j + 2];
            totalWeights += weight;
            j += 10;
            totalfields += 1;
        }
        return .{
            .len = sLen,
            .allQueries = searchBuf[4 .. sLen + 3],
            .fields = fields,
            .words = words,
            .meh = words * 1,
            .bad = 2 + (words - 1) * 3 + @divTrunc(totalWeights, totalfields),
            .score = 0,
        };
    } else {
        // Vector Binary Schema:
        // | Offset | Field    | Size (bytes) | Description                                     |
        // |--------|----------|--------------|-------------------------------------------------|
        // | 0      | isVector | 1            | Indicates if search is a vector (always 1)      |
        // | 1      | queryLen | 2            | Length of the query in bytes (u16)              |
        // | 3      | field    | 1            | Field identifier                                |
        // | 4      | func     | 1            | Function identifier (enum)                      |
        // | 5      | score    | 4            | Score value (f32)                               |
        // | 9      | align    | 8            | Space for alignment                             |
        // | 17     | query    | queryLen     | Query data (array of f32 values)                |

        const alignedV = searchBuf[9..searchBuf.len];
        const address = @intFromPtr(alignedV.ptr);
        const offset = address % 8;

        move(alignedV[8 - offset .. alignedV.len - offset], alignedV[8..alignedV.len]);

        return .{
            .field = searchBuf[3],
            .func = @enumFromInt(searchBuf[4]),
            .score = read(f32, searchBuf, 5),
            .query = read([]f32, alignedV[8 - offset .. alignedV.len - offset], 0),
        };
    }
}

inline fn min(a: usize, b: usize) usize {
    if (a < b) return a;
    return b;
}

fn hamming_ascii(
    value: []u8,
    i: usize,
    query: []u8,
) u8 {
    const queryD = query[1..query.len];
    const ql = queryD.len;
    const d: u8 = @truncate(selva.strsearch_hamming(
        value[i + 1 .. min(value.len, i + 1 + ql)].ptr,
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

fn hamming(
    value: []u8,
    i: usize,
    query: []u8,
) u8 {
    var j: usize = 1;
    const l = min(value.len, 5 * query.len);
    var res: bool = false;
    while (j + 8 < l) : (j += 8) {
        const x: u64 = read(u64, value, j);
        res = res or (x & 0x8080808080808080) != 0;
    }
    while (j + 4 < l) : (j += 4) {
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
    if (index == 1 or index > 0 and isSeparator(value[index - 1])) {
        const nd = hamming(value, index, query);
        if (nd < minDist) {
            return nd;
        } else if (nd < d) {
            d = nd;
        }
    }
    if (simd.countElementsWithValue(matches, true) != 1) {
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
    var i: usize = 0;
    const l = value.len;
    const ql = query.len;
    const q1 = query[0];
    const q2 = query[0] - 32;
    var d: u8 = 10;
    if (l < vectorLen) {
        while (i < l) : (i += 1) {
            // needs to start at 0...
            if ((value[i] == q1 or value[i] == q2) and (i == 0 or isSeparator(value[i - 1]))) {
                if (i + ql > l) {
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
    // this nessecary :/ ?
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
    decompressor: *LibdeflateDecompressor,
    blockState: *LibdeflateBlockState,
    value: []u8,
    query: []u8,
    score: *u8,
    penalty: u8,
) bool {
    if (value[1] == @intFromEnum(Compression.compressed)) {
        _ = decompress(
            decompressor,
            blockState,
            *u8,
            strSearchCompressed,
            query,
            value,
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
    decompressor: *LibdeflateDecompressor,
    blockState: *LibdeflateBlockState,
    node: *selva.SelvaNode,
    typeEntry: *selva.SelvaTypeEntry,
    ctx: *const SearchCtx(false),
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
        fieldLoop: while (j < fl) : (j += 10) {
            const field = ctx.fields[j];
            const prop: Prop = @enumFromInt(ctx.fields[j + 1]);
            const penalty = ctx.fields[j + 2];
            const fieldSchema = db.getFieldSchema(typeEntry, field) catch {
                return 255;
            };
            var score: u8 = 255;
            if (field == MAIN_PROP) {
                const value = db.getField(typeEntry, 0, node, fieldSchema, prop);
                const start = read(u16, ctx.fields, j + 3);
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
                const value = db.getField(typeEntry, 0, node, fieldSchema, prop);
                if (value.len == 0) {
                    continue :fieldLoop;
                }
                if (prop == Prop.TEXT) {
                    const code: LangCode = @enumFromInt(ctx.fields[j + 5]);
                    score = 255;
                    if (code == LangCode.NONE) {
                        var iter = db.textIterator(value);
                        while (iter.next()) |s| {
                            _ = getScore(decompressor, blockState, s, query, &score, penalty);
                            if (score < bestScore) {
                                bestScore = score;
                                if (score - penalty == 0) {
                                    totalScore += bestScore;
                                    continue :wordLoop;
                                }
                            }
                        }
                    } else {
                        const fallbacks = ctx.fields[j + 6];
                        const s = if (fallbacks > 0) db.getTextFromValueFallback(value, code, ctx.fields[j + 7 .. j + 7 + fallbacks]) else db.getTextFromValue(value, code);
                        if (s.len > 0) {
                            _ = getScore(decompressor, blockState, s, query, &score, penalty);
                            if (score < bestScore) {
                                bestScore = score;
                                if (score - penalty == 0) {
                                    totalScore += bestScore;
                                    continue :wordLoop;
                                }
                            }
                        }
                    }
                } else {
                    if (getScore(decompressor, blockState, value, query, &score, penalty)) {
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

pub fn searchVector(
    node: *selva.SelvaNode,
    typeEntry: *selva.SelvaTypeEntry,
    ctx: *const SearchCtx(true),
) f32 {
    const fieldSchema = db.getFieldSchema(typeEntry, ctx.field) catch {
        return MaxVectorScore;
    };
    const value = db.getField(typeEntry, ctx.field, node, fieldSchema, Prop.VECTOR);
    if (value.len == 0) {
        return MaxVectorScore;
    }
    return vectorScore(ctx.func, read([]f32, value, 0), ctx.query);
}

pub inline fn isVectorSearch(src: []u8) bool {
    return src[0] == 1;
}
