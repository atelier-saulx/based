const selva = @import("../../../selva.zig").c;
const std = @import("std");
const t = @import("../../../types.zig");

pub fn vec(func: t.FilterVectorFn, value: []const f32, query: []const f32) f32 {
    if (value.len != query.len) {
        return t.FilterMaxVectorScore;
    }

    switch (func) {
        t.FilterVectorFn.cosineSimilarity => {
            return @abs(1 - selva.vector_sc(value.ptr, query.ptr, query.len));
        },
        t.FilterVectorFn.dotProduct => {
            return @abs(1 - selva.vector_dot(value.ptr, query.ptr, query.len));
        },
        t.FilterVectorFn.manhattanDistance => {
            return @abs(selva.vector_l1(value.ptr, query.ptr, query.len));
        },
        t.FilterVectorFn.euclideanDistance => {
            return @abs(selva.vector_l2s(value.ptr, query.ptr, query.len));
        },
    }

    return t.FilterMaxVectorScore;
}
