const simd = @import("std").simd;
const std = @import("std");

pub fn hasId(
    id: u32,
    ids: []u32,
    last: *usize,
    low: u32,
    high: u32,
) bool {
    var i: usize = 0;
    const vectorLen = 32;
    const l = last.*;

    if (id < low) {
        return false;
    }

    if (id > high) {
        return false;
    }

    while (i <= l) : (i += vectorLen) {
        const vec2: @Vector(vectorLen, u32) = ids[i..][0..vectorLen].*;
        if (simd.countElementsWithValue(vec2, id) != 0) {
            const index = simd.firstIndexOfValue(vec2, id);
            ids[index.? + i] = ids[l];
            last.* -= 1;
            return true;
        }
    }
    while (i <= l) : (i += 1) {
        const id2 = ids[i];
        if (id2 == id) {
            ids[i] = ids[l];
            last.* -= 1;
            return true;
        }
    }
    return false;
}
