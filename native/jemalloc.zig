const std = @import("std");
const config = @import("config");

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

fn slicify(comptime T: type, ptr: *anyopaque, n: usize) []T {
    const p: [*]T = @as([*]T, @alignCast(@ptrCast(ptr)));
    return p[0..n];
}

fn valgrindMalloc(ptr: *anyopaque, len: usize) void {
    if (config.enable_debug and std.valgrind.runningOnValgrind() > 0) {
        const buf = slicify(u8, ptr, len);
        _ = std.valgrind.memcheck.createBlock(buf, "Zig alloc");
        _ = std.valgrind.memcheck.makeMemUndefined(buf);
    }
}

fn valgrindFree(ptr: *anyopaque, len: usize) void {
    if (config.enable_debug and std.valgrind.runningOnValgrind() > 0) {
        const buf = slicify(u8, ptr, len);
        std.valgrind.memcheck.makeMemNoAccess(buf);
    }
}

pub fn create(comptime T: type) *T {
    if (@sizeOf(T) == 0) {
        const ptr = comptime std.mem.alignBackward(usize, std.math.maxInt(usize), @alignOf(T));
        return @ptrFromInt(ptr);
    }
    const ptr: *T = @alignCast(@ptrCast(c.selva_aligned_alloc(@alignOf(T), @sizeOf(T)).?));
    valgrindMalloc(ptr, @sizeOf(T));
    return ptr;
}

pub fn alloc(comptime T: type, n: usize) []T {
    const ptr = c.selva_calloc(n, @sizeOf(T)).?;

    if (config.enable_debug) {
        const buf = slicify(u8, ptr, n * @sizeOf(T));
        valgrindMalloc(buf.ptr, buf.len);
    }

    return slicify(T, ptr, n);
}

pub const ReallocError = error{InvalidOld};

pub fn realloc(old: anytype, n: usize) @TypeOf(old) {
    const Slice = @typeInfo(@TypeOf(old)).pointer;
    const T = Slice.child;
    const ptr = c.selva_realloc(@ptrCast(old.ptr), n * @sizeOf(T)).?;

    if (config.enable_debug and std.valgrind.runningOnValgrind() > 0) {
        const oldSize: usize = old.len * @sizeOf(T);
        const newSize = n * @sizeOf(T);
        const oldBuf = slicify(u8, @ptrCast(old.ptr), oldSize);
        const newBuf = slicify(u8, ptr, newSize);

        std.valgrind.memcheck.makeMemNoAccess(oldBuf);
        std.valgrind.memcheck.makeMemDefined(newBuf[0..oldSize]);
        std.valgrind.memcheck.makeMemUndefined(newBuf[oldSize..newSize]);
    }

    return slicify(T, ptr, n);
}

pub fn rallocx(old: anytype, n: usize) ?@TypeOf(old) {
    const Slice = @typeInfo(@TypeOf(old)).pointer;
    const T = Slice.child;

    if (c.selva_rallocx(@ptrCast(old.ptr), n * @sizeOf(T), c.MALLOCX_ZERO)) |ptr| {
        if (config.enable_debug and std.valgrind.runningOnValgrind() > 0) {
            const oldSize: usize = old.len * @sizeOf(T);
            const newSize = n * @sizeOf(T);
            const oldBuf = slicify(u8, @ptrCast(old.ptr), oldSize);
            const newBuf = slicify(u8, ptr, newSize);

            std.valgrind.memcheck.makeMemNoAccess(oldBuf);
            std.valgrind.memcheck.makeMemDefined(newBuf[0..oldSize]);
            std.valgrind.memcheck.makeMemUndefined(newBuf[oldSize..newSize]);
        }

        return slicify(T, ptr, n);
    } else {
        return null;
    }
}

pub fn free(ptr: anytype) void {
    switch (@typeInfo(@TypeOf(ptr))) {
        .optional => {
            return free(ptr.?);
        },
        else => {
        }
    }
    const info = @typeInfo(@TypeOf(ptr)).pointer;
    if (info.size == .one) {
        const T = info.child;
        if (T != anyopaque and @sizeOf(T) == 0) return;
        c.selva_free(@constCast(ptr));
        if (T != anyopaque) {
            valgrindFree(@constCast(ptr), @sizeOf(T));
        }
    } else {
        c.selva_free(@ptrCast(ptr.ptr));
        valgrindFree(@ptrCast(ptr.ptr), ptr.len * @sizeOf(info.child));
    }
}
