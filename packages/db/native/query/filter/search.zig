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

var locale: ?selva.locale_t = null;
var transform: ?selva.wctrans_t = null;

// TODO: Make this as context!
const seperatorChars: @Vector(8, u8) = .{ 10, 32, 34, 39, 45, 46, 59, 58 };
const minDist = 1;

fn levenshtein(
    value: []u8,
    i: usize,
    query: []u8,
    _: *selva.strsearch_wneedle,
) u8 {
    const ql = query.len;

    const d = selva.strsearch_levenshtein_u8(
    // locale.?,
    // transform.?,
    value[i .. i + ql].ptr, ql, query.ptr, ql
    // queryNeedle,
    );

    // std.debug.print("derp {any} \n", .{d});

    return d;
}

fn resultMatcher(
    dx: u8,
    matches: @Vector(vectorLen, bool),
    i: usize,
    value: []u8,
    query: []u8,
    queryNeedle: *selva.strsearch_wneedle,
) u8 {
    var d: u8 = dx;
    const ql = query.len;
    const l = value.len;
    const result = @select(u8, matches, indexes, nulls);
    const index: usize = @reduce(.Min, result) + i;
    if (index + ql > l) {
        return d;
    }
    if (index == 0 or simd.countElementsWithValue(seperatorChars, value[index - 1]) > 0) {
        const nd = levenshtein(value, index, query, queryNeedle);
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
                    const nd = levenshtein(value, p + i, query, queryNeedle);
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
    queryNeedle: *selva.strsearch_wneedle,
) u8 {
    var i: usize = 0;
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
                const nd = levenshtein(value, i + 1, query, queryNeedle);
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
    while (i <= (l - vectorLen)) : (i += vectorLen) {
        const h: @Vector(vectorLen, u8) = value[i..][0..vectorLen].*;
        var matches = h == queryVector;
        if (@reduce(.Or, matches)) {
            d = resultMatcher(d, matches, i, value, query, queryNeedle);
            if (d < minDist) {
                return d;
            }
        } else {
            matches = (h + capitals) == queryVector;
            if (@reduce(.Or, matches)) {
                d = resultMatcher(d, matches, i, value, query, queryNeedle);
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
            const nd = levenshtein(value, i + 1, query, queryNeedle);
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
    queryNeedle: *selva.strsearch_wneedle,
    // ref: ?types.RefStruct,
    // comptime isEdge: bool,
) u32 {
    if (locale == null) {
        locale = selva.selva_lang_getlocale2(selva.selva_lang_nl);
        transform = selva.selva_lang_wctrans(
            selva.selva_lang_nl,
            selva.SELVA_LANGS_TRANS_TOLOWER,
        );
    }

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
            const score = strSearch(value, searchBuf[2 .. searchLen + 2], queryNeedle);
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
