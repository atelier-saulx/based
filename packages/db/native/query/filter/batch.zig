const std = @import("std");
const simd = std.simd;
const readInt = @import("../../utils.zig").readInt;

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

    // even if its less then 2 still worth it
    // this is doing the same as the other one without a loop
    // nice to premake the vectors prob
    // using this for 2 vector values is allrdy valuable
    // premake vector first time filter gets executed

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

// specific binary search
pub fn simdReferencesHasSingle(
    value: u32,
    values: []u8,
) bool {
    const vectorLen = std.simd.suggestVectorLength(u32).?;
    const l = values.len / 4;
    const tmp: [*]u32 = @alignCast(@ptrCast(values.ptr));
    const ints: []u32 = tmp[0..l];
    var right: usize = l - 1;
    var left: usize = 0;
    while (left <= right) {
        const middle: usize = @divTrunc(left + right, 2);
        // dont make vector is amount is too small
        const mid: @Vector(vectorLen, u32) = ints[middle..][0..vectorLen].*;
        if (simd.countElementsWithValue(mid, value) != 0) {
            return true;
        } else if (value < ints[middle]) {
            right = middle - vectorLen;
        } else {
            left = middle + vectorLen;
        }
    }
    // if (vectorLen <= l) {
    //     while (i <= (l - vectorLen)) : (i += vectorLen) {
    //         const vec2: @Vector(vectorLen, T) = ints[i..][0..vectorLen].*;
    //         if (simd.countElementsWithValue(vec2, valueExpanded) != 0) {
    //             return true;
    //         }
    //     }
    // }
    return false;
}

pub fn simdReferencesHas(
    value: []u8,
    values: []u8,
) bool {
    // var i: usize = 0;
    const vectorLen = std.simd.suggestVectorLength(u32).?;
    const l = values.len / 4;
    const tmp: [*]u32 = @alignCast(@ptrCast(values.ptr));
    const ints: []u32 = tmp[0..l];
    // ----------------------------
    const tmp3: [*]u32 = @alignCast(@ptrCast(value.ptr));
    const intsValue2: []u32 = tmp3[0 .. value.len / 4];
    // ----------------------------
    // if larger need to make more
    const target: @Vector(vectorLen, u32) = intsValue2[0..vectorLen].*;
    // fix more then 4...
    // and less has to use less vectorLen as well...
    // ----------------------------
    const lowest = intsValue2[0];
    var right: usize = l - 1;
    var left: usize = 0;
    while (left <= right) {
        const middle: usize = @divTrunc(left + right, 2);
        const mid = ints[middle];
        // prep all of them
        if (simd.countElementsWithValue(target, mid) != 0) {
            return true;
        } else if (lowest < mid) {
            right = middle - 1;
        } else {
            left = middle + 1;
        }
    }
    return false;
}
