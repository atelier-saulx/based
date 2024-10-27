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

// --------------------------------------------------------------------
inline fn checkSimd(index: usize, values: []u32, value: u32, vectorLen: comptime_int) bool {
    const rest = (index + vectorLen) - values.len;
    if (rest == 1) {
        return value == values[index];
    }
    var vec: @Vector(vectorLen, u32) = undefined;
    if (rest < vectorLen) {
        vec = values[index - rest ..][0..vectorLen].*;
    } else {
        vec = values[index..][0..vectorLen].*;
    }
    if (simd.countElementsWithValue(vec, value) != 0) {
        return true;
    }
    return false;
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
        if (checkSimd(middle, ints, value, vectorLen)) {
            return true;
        } else if (middle <= 0 or right <= 0) {
            return false;
        } else if (value < ints[middle]) {
            if (vectorLen > middle) {
                right = 0;
            } else {
                right = middle - vectorLen;
            }
        } else {
            if (middle + vectorLen > l - 1) {
                left = l - 1;
            } else {
                left = middle + vectorLen;
            }
        }
    }
    return false;
}

inline fn checkMultiValue(vectorLen: comptime_int, target: @Vector(vectorLen, u32), value: u32, intsValue2: []u32) bool {
    if (simd.countElementsWithValue(target, value) != 0) {
        // std.debug.print("FOUND\n", .{});
        return true;
    }
    var i: usize = vectorLen;
    while (i < intsValue2.len and i - vectorLen <= vectorLen) : (i += vectorLen) {
        const t: @Vector(vectorLen, u32) = intsValue2[i..][0..vectorLen].*;
        if (simd.countElementsWithValue(t, value) != 0) {
            // std.debug.print("FOUND 2\n", .{});
            return true;
        }
    }
    if (intsValue2.len - (i) > 0) {
        while (i < intsValue2.len) : (i += 1) {
            if (value == intsValue2[i]) {
                // std.debug.pr/int("FOUND 3\n", .{});
                return true;
            }
        }
    }

    return false;
}

pub fn simdReferencesHas(
    vectorLen: comptime_int,
    value: []u8,
    values: []u8,
) bool {
    // var i: usize = 0;
    const l = values.len / 4;
    const tmp: [*]u32 = @alignCast(@ptrCast(values.ptr));
    const ints: []u32 = tmp[0..l];
    // ----------------------------
    const tmp3: [*]u32 = @alignCast(@ptrCast(value.ptr));
    const intsValue2: []u32 = tmp3[0 .. value.len / 4];
    // ----------------------------
    const target: @Vector(vectorLen, u32) = intsValue2[0..vectorLen].*;
    const largeTarget = intsValue2.len > vectorLen;
    var right: usize = l - 1;
    var left: usize = 0;
    var max = l;

    const low = intsValue2[0];
    const hi = intsValue2[intsValue2.len];

    while (left <= right) {
        const mid = left + (right - left) / 2;
        const midValue = ints[mid];
        if (midValue == low) {
            return true;
        } else if (midValue < low) {
            left = mid + 1;
        } else {
            if (mid == 0) break;
            right = mid - 1;
        }
        if (midValue > hi) {
            max = mid;
        }
    }

    if (largeTarget) {
        while (left < max) : (left += 1) {
            if (checkMultiValue(vectorLen, target, ints[left], intsValue2)) {
                return true;
            }
        }
    } else {
        while (left < max) : (left += 1) {
            if (simd.countElementsWithValue(target, ints[left]) != 0) {
                return true;
            }
        }
    }

    return false;
}

pub fn referencesHas(repeat: u32, query: []u8, v: []u8) bool {
    comptime var vectorLen = std.simd.suggestVectorLength(u32).?;
    if (vectorLen > 8) {
        vectorLen = 8; // tmp
    }
    if (repeat < vectorLen) {
        if (repeat == 2) {
            if (!simdReferencesHas(2, query, v)) {
                return false;
            }
        } else if (repeat == 3) {
            if (!simdReferencesHas(3, query, v)) {
                return false;
            }
        } else if (repeat == 4) {
            if (!simdReferencesHas(4, query, v)) {
                return false;
            }
        } else if (repeat == 5) {
            if (!simdReferencesHas(5, query, v)) {
                return false;
            }
            // max
        } else if (repeat == 6) {
            if (!simdReferencesHas(6, query, v)) {
                return false;
            }
        } else if (repeat == 7) {
            if (!simdReferencesHas(7, query, v)) {
                return false;
            }
        } else if (repeat == 8) {
            if (!simdReferencesHas(8, query, v)) {
                return false;
            }
        }
        // up till 16
    } else if (!simdReferencesHas(vectorLen, query, v)) {
        return false;
    }
    return true;
}
