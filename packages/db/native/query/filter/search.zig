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

pub inline fn default(value: []const u8, query: []const u8) bool {
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

inline fn blockCompare(_: []const u8, _: []const u8) bool {
    // const d = selva.strsearch_has_u8(
    //     @ptrCast(value.ptr),
    //     value.len,
    //     @ptrCast(query.ptr),
    //     query.len,
    //     2,
    //     true,
    // );

    // if (d < 2) {
    //     return true;
    // }
    return false;
}

pub fn search(
    _: *db.DbCtx,
    node: *selva.SelvaNode,
    typeEntry: *selva.SelvaTypeEntry,
    searchBuf: []u8,
    searchCtx: *selva.strsearch_needle,
    // ref: ?types.RefStruct,
    // comptime isEdge: bool,
) u32 {
    const sl = searchBuf.len;
    var j: usize = searchCtx.len + 2;

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

        var d: c_int = undefined;
        if (isCompressed) {} else {

            // 190000

            d = selva.strsearch_has_u8(
                @ptrCast(value.ptr),
                value.len,
                // offset
                searchCtx,
            );
        }

        if (d < 3) {
            const x: u32 = @bitCast(d);
            return x;
        }

        j += 2;
    }

    return 10;
}
