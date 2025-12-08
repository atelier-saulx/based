const std = @import("std");

pub const c = @cImport({
    @cDefine("__zig", "1");

    @cDefine("true", "(_Bool)1");
    @cDefine("false", "(_Bool)0");
    @cInclude("stdbool.h");
    @cUndef("true");
    @cUndef("false");
    @cDefine("true", "(_Bool)1");
    @cDefine("false", "(_Bool)0");

    @cInclude("cdefs.h");
    @cInclude("jemalloc_selva.h");
});

pub fn create(comptime T: type) *T {
    if (@sizeOf(T) == 0) {
        const ptr = comptime std.mem.alignBackward(usize, std.math.maxInt(usize), @alignOf(T));
        return @ptrFromInt(ptr);
    }
    return @alignCast(@ptrCast(c.selva_aligned_alloc(@alignOf(T), @sizeOf(T)).?));
}

pub fn free(ptr: anytype) void {
    const info = @typeInfo(@TypeOf(ptr)).pointer;
    if (info.size == .one) {
        const T = info.child;
        if (@sizeOf(T) == 0) return;
        c.selva_free(ptr);
    } else {
        c.selva_free(ptr.ptr);
    }
}

fn slicify(comptime T: type, ptr: *anyopaque, n: usize) []T {
    const p: [*]T = @as([*]T, @ptrCast(ptr));
    return p[0..n];
}

pub fn alloc(comptime T: type, n: usize) []T {
    const ptr = c.selva_calloc(n, @sizeOf(T)).?;
    return slicify(T, ptr, n);
}

pub const ReallocError = error{InvalidOld};

pub fn realloc(old: anytype, n: usize) @TypeOf(old) {
    const Slice = @typeInfo(@TypeOf(old)).pointer;
    const T = Slice.child;
    const ptr = c.selva_realloc(old.ptr, n * @sizeOf(T)).?;
    return slicify(T, ptr, n);
}
