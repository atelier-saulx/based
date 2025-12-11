const std = @import("std");
const valgrind = std.valgrind;
const mem = std.mem;
const Allocator = mem.Allocator;
const debugPrint = @import("./utils.zig").debugPrint;

pub const ValgrindAllocator = struct {
    childAllocator: std.mem.Allocator,

    pub fn init(childAllocator: std.mem.Allocator) ValgrindAllocator {
        return .{
            .childAllocator = childAllocator,
        };
    }

    fn allocFn(ctx: *anyopaque, len: usize, alignment: mem.Alignment, ret_addr: usize) ?[*]u8 {
        const self: *ValgrindAllocator = @ptrCast(@alignCast(ctx));
        const maybe_ptr = self.childAllocator.rawAlloc(len, alignment, ret_addr);

        if (maybe_ptr) |ptr| {
            if (valgrind.runningOnValgrind() > 0) {
                _ = valgrind.memcheck.createBlock(ptr[0..len], "Zig alloc");
                _ = valgrind.memcheck.makeMemUndefined(ptr[0..len]);
            }
        }
        return maybe_ptr;
    }

    fn resizeFn(
        ctx: *anyopaque,
        buf: []u8,
        alignment: mem.Alignment,
        new_len: usize,
        ret_addr: usize,
    ) bool {
        const self: *ValgrindAllocator = @ptrCast(@alignCast(ctx));

        const old_len = buf.len;
        const success = self.childAllocator.rawResize(buf, alignment, new_len, ret_addr);

        if (success) {
            if (valgrind.runningOnValgrind() > 0) {
                if (new_len > old_len) {
                    const new_part_slice = buf.ptr[old_len..new_len];
                    valgrind.memcheck.makeMemUndefined(new_part_slice);
                    debugPrint("Valgrind resizeFn: Grew, marked {d} bytes undefined.\n", .{new_part_slice.len});
                } else if (new_len < old_len) {
                    const trailing_part_slice = buf.ptr[new_len..old_len];
                    valgrind.memcheck.makeMemNoAccess(trailing_part_slice);
                    debugPrint("Valgrind resizeFn: Shrank, marked {d} bytes noaccess.\n", .{trailing_part_slice.len});
                } else {
                    debugPrint("Valgrind resizeFn: Size unchanged.\n", .{});
                }
            }
            return true;
        } else {
            return false;
        }
    }

    fn freeFn(ctx: *anyopaque, buf: []u8, alignment: mem.Alignment, ret_addr: usize) void {
        const self: *ValgrindAllocator = @ptrCast(@alignCast(ctx));

        if (buf.len > 0 and valgrind.runningOnValgrind() > 0) {
            valgrind.memcheck.makeMemNoAccess(buf);
            debugPrint("Valgrind freeFn: Marked {d} bytes noaccess for pointer {any}.\n", .{ buf.len, buf.ptr });
        }
        self.childAllocator.rawFree(buf, alignment, ret_addr);
    }

    fn remapFn(
        ctx: *anyopaque,
        buf: []u8,
        alignment: mem.Alignment,
        new_len: usize,
        ret_addr: usize,
    ) ?[*]u8 {
        const maybe_new_mem = allocFn(ctx, new_len, alignment, ret_addr);

        if (maybe_new_mem) |new_slice| {
            const old_len = buf.len;
            const bytes_to_copy = @min(old_len, new_len);
            if (bytes_to_copy > 0) {
                @memcpy(new_slice[0..bytes_to_copy], buf.ptr[0..bytes_to_copy]);
            }

            freeFn(ctx, buf, alignment, ret_addr);

            return new_slice;
        } else {
            debugPrint("remapFn fallback failed: allocation failed\n", .{});
            return null;
        }
    }

    const vtable = Allocator.VTable{
        // do not format
        .alloc = allocFn,
        .resize = resizeFn,
        .free = freeFn,
        .remap = remapFn,
    };

    pub fn allocator(self: *ValgrindAllocator) Allocator {
        return .{
            .ptr = self,
            .vtable = &vtable,
        };
    }
};
