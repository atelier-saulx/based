const std = @import("std");
const simd = std.simd;
const read = @import("../../utils.zig").read;
const selva = @import("../../selva.zig");

const vectorLen = std.simd.suggestVectorLength(u8).?;
const indexes = std.simd.iota(u8, vectorLen);
const nulls: @Vector(vectorLen, u8) = @splat(@as(u8, 255));

pub fn simdEqualsOr(
    T: type,
    value: []u8,
    values: []u8,
) bool {
    var i: usize = 0;
    const bytes: u16 = @sizeOf(T);
    const l = values.len / bytes;
    const valueExpanded = read(T, value, 0);
    // this has to be aligned in js

    const address = @intFromPtr(values.ptr);
    const delta = (address) & @sizeOf(T);

    std.debug.print("Incorrectly aligned {any} {any}  a {any} \n", .{ values.len, delta, address });

    if (delta != 0) {
        while (i < values.len) {
            if (std.mem.eql(u8, value, values[i .. i + @sizeOf(T)])) {
                return true;
            }

            i += @sizeOf(T);
        }

        return false;
    }

    const tmp: [*]T = @alignCast(@ptrCast(values.ptr));
    const ints: []T = tmp[0..l];
    if (vectorLen <= l) {
        while (i <= (l - vectorLen)) : (i += vectorLen) {
            const vec2: @Vector(vectorLen, T) = ints[i..][0..vectorLen].*;
            if (simd.countElementsWithValue(vec2, valueExpanded) != 0) {
                return true;
            }
        }
    }
    while (i < l) : (i += 1) {
        const id2 = ints[i];
        if (id2 == valueExpanded) {
            return true;
        }
    }
    return false;
}

// make the hasQueryValueORalgo

// make the query multiple (faster)
// have block decompression here
// buffer in the instance of db for dec
pub fn hasQueryValueOr(value: []u8, query: []u8) bool {
    // put block deocmpression here
    // query packed
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
        // do some math
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

pub fn equalsOr(
    valueSize: u16,
    value: []u8,
    values: []u8,
) bool {
    if (valueSize == 4) {
        if (!simdEqualsOr(u32, value, values)) {
            return false;
        }
    } else if (valueSize == 8) {
        if (!simdEqualsOr(u64, value, values)) {
            return false;
        }
    } else if (!simdEqualsOr(u8, value, values)) {
        return false;
    }
    return true;
}

// --------------------------------------------------------------------
// specific binary search
pub fn simdReferencesHasSingle(
    value: u32,
    values: []u8,
) bool {
    const l = values.len / 4;

    const address = @intFromPtr(values.ptr);
    const delta = (address) & 3;

    if (delta != 0) {
        if (values.len < 4) {
            return false;
        }
        std.debug.print("v1 {any} v {any} \n", .{ value, values.len });
        var i: usize = 0;

        while (i < values.len) {
            if (read(u32, values, i) == value) {
                return true;
            }
            i += 4;
        }
        return false;
    }

    const tmp: [*]u32 = @alignCast(@ptrCast(values.ptr));

    return selva.node_id_set_bsearch(tmp, l, value) != -1;
}

pub fn simdReferencesHas(
    value: []u8,
    values: []u8,
) bool {
    // // also potentialy wrong...
    // const tmp3: [*]u32 = @alignCast(@ptrCast(value.ptr));
    // const intsValue2: []u32 = tmp3[0 .. value.len / 4];
    var i: usize = 0;
    const l = values.len / 4;

    const address = @intFromPtr(values.ptr);
    const delta = (address) & 3;

    if (delta != 0) {
        return false;
    }

    const tmp: [*]u32 = @alignCast(@ptrCast(values.ptr));
    while (i < value.len) : (i += 4) {
        if (selva.node_id_set_bsearch(tmp, l, read(u32, value, i)) != -1) {
            return true;
        }
    }
    return false;
}
