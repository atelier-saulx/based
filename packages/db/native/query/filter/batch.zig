const std = @import("std");
const simd = std.simd;
const readInt = @import("../../utils.zig").readInt;
const selva = @import("../../selva.zig");

pub fn simdEqualsOr(
    T: type,
    value: []u8,
    values: []u8,
) bool {
    var i: u16 = 0;
    const vectorLen = std.simd.suggestVectorLength(T).?;
    const bytes: u16 = @divExact(@typeInfo(T).Int.bits, 8);
    const l = values.len / bytes;
    const valueExpanded = readInt(T, value, 0);
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
    while (i < ints.len) : (i += 1) {
        const id2 = ints[i];
        if (id2 == valueExpanded) {
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
    const tmp: [*]u32 = @alignCast(@ptrCast(values.ptr));
    return selva.node_id_set_bsearch(tmp, l, value) != -1;
}

pub fn simdReferencesHas(
    value: []u8,
    values: []u8,
) bool {
    const tmp3: [*]u32 = @alignCast(@ptrCast(value.ptr));
    const intsValue2: []u32 = tmp3[0 .. value.len / 4];
    var i: usize = 0;
    const l = values.len / 4;
    const tmp: [*]u32 = @alignCast(@ptrCast(values.ptr));
    while (i < intsValue2.len) : (i += 1) {
        if (selva.node_id_set_bsearch(tmp, l, intsValue2[i]) != -1) {
            return true;
        }
    }
    return false;
}
