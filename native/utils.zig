const std = @import("std");
const builtin = @import("builtin");
const config = @import("config");
const selva = @import("selva/selva.zig").c;
const t = @import("types.zig");

extern "c" fn memcpy(*anyopaque, *const anyopaque, usize) *anyopaque;
extern "c" fn memmove(*anyopaque, *const anyopaque, usize) *anyopaque;

pub inline fn increment(comptime T: type, buffer: []u8, value: T, offset: usize) void {
    switch (@typeInfo(T)) {
        .int, .comptime_int => {},
        else => @compileError("increment expects an integer type, found " ++ @typeName(T)),
    }
    const size = @bitSizeOf(T) / 8;
    const target = buffer[offset..][0..size];
    const ptr = @as(*align(1) T, @ptrCast(target.ptr));
    // We use wrapping addition (+%=) to allow standard overflow behavior
    // without crashing in Debug/ReleaseSafe modes.
    ptr.* +%= value;
}

pub inline fn writeAs(T: type, buffer: []u8, value: anytype, offset: usize) void {
    const X = @TypeOf(value);

    switch (@typeInfo(X)) {
        .int, .comptime_int => {
            if (sizeOf(X) > sizeOf(T)) {
                const target = buffer[offset..][0 .. @bitSizeOf(T) / 8];
                target.* = @bitCast(@as(T, @truncate(value)));
            } else {
                const target = buffer[offset..][0 .. @bitSizeOf(T) / 8];
                target.* = @bitCast(value);
            }
        },
        // .error_set => {
        //     std.debug.print("ERROR TIME: Type X is an error set\n", .{});
        // },
        // .error_union => |info| {
        //     std.debug.print("Type X is an Error Union. Payload: {}\n", .{info.payload});
        // },
        // .@"union" => {
        //     std.debug.print("Union. Payload: {}\n", .{});
        // },
        .@"enum" => {
            return writeAs(T, buffer, @intFromEnum(value), offset);
        },
        else => {
            const target = buffer[offset..][0 .. @bitSizeOf(T) / 8];
            target.* = @bitCast(value);
        },
    }
}

pub inline fn write(buffer: []u8, value: anytype, offset: usize) void {
    const T = @TypeOf(value);
    switch (@typeInfo(T)) {
        .pointer => |info| {
            const ChildType = info.child;
            copy(ChildType, buffer, value, offset);
        },
        .@"enum" => |info| {
            const TagType = info.tag_type;
            const target = buffer[offset..][0 .. @bitSizeOf(TagType) / 8];
            const intVal: TagType = @intFromEnum(value);
            target.* = @bitCast(intVal);
        },
        else => {
            const target = buffer[offset..][0 .. @bitSizeOf(T) / 8];
            target.* = @bitCast(value);
        },
    }
}

pub inline fn writeNext(comptime T: type, buffer: []u8, value: T, offset: *usize) void {
    write(T, buffer, value, offset.*);
    offset.* = offset.* + @bitSizeOf(T) / 8;
}

pub inline fn toSlice(comptime T: type, value: []u8) []T {
    const size = @sizeOf(T);
    const x: []T = @as([*]T, @ptrCast(@alignCast(value.ptr)))[0..@divFloor(value.len, size)];
    return x;
}

pub inline fn read(comptime T: type, buffer: []u8, offset: usize) T {
    switch (@typeInfo(T)) {
        .pointer => |info| {
            if (info.size == .slice) {
                const ChildType = info.child;
                const size = @bitSizeOf(T) / 8;
                // [offset..] ??
                const value: T = @as([*]ChildType, @ptrCast(@alignCast(buffer[offset..].ptr)))[0..@divFloor(buffer.len, size)];
                return value;
            } else {
                @compileError("Read: Only slice pointers supported for now... " ++ @typeName(T));
            }
        },
        // .enum is a keyword so thats why you need this beauty
        .@"enum" => |info| {
            const TagType = info.tag_type;
            const intVal = read(TagType, buffer, offset);
            return @enumFromInt(intVal);
        },
        else => {
            const size = @bitSizeOf(T) / 8;
            const value: T = @bitCast(buffer[offset..][0..size].*);
            return value;
        },
    }
}

pub fn ReadIterator(comptime T: type) type {
    return struct {
        offset: *usize,
        buffer: []u8,
        len: usize,
        pub fn next(self: *ReadIterator(T)) ?T {
            if (self.offset.* < self.len) {
                const prop = readNext(T, self.buffer, self.offset);
                return prop;
            } else {
                return null;
            }
        }
    };
}

pub inline fn readIterator(T: type, buffer: []u8, amount: usize, offset: *usize) ReadIterator(T) {
    return ReadIterator(T){
        .buffer = buffer,
        .len = amount * sizeOf(T) + offset.*,
        .offset = offset,
    };
}

pub inline fn readNext(T: type, buffer: []u8, offset: *usize) T {
    const header = read(T, buffer, offset.*);
    offset.* = offset.* + @bitSizeOf(T) / 8;
    return header;
}

// pub const TextIterator = struct {
//     value: []const [selva.c.SELVA_STRING_STRUCT_SIZE]u8,
//     index: usize = 0,
//     fn _next(self: *TextIterator) ?[]u8 {
//         if (self.index == self.value.len) {
//             return null;
//         }
//         var len: usize = undefined;
//         const str: [*]const u8 = selva.c.selva_string_to_buf(@ptrCast(&self.value[self.index]), &len);
//         const s = @as([*]u8, @constCast(str));
//         self.index += 1;
//         return s[0..len];
//     }
//     pub fn next(self: *TextIterator) ?[]u8 {
//         return self._next();
//     }
// };

// pub inline fn textIterator(
//     value: []u8,
// ) TextIterator {
//     if (value.len == 0) {
//         return TextIterator{ .value = emptyArray };
//     }
//     const textTmp: *[*]const [selva.c.SELVA_STRING_STRUCT_SIZE]u8 = @ptrCast(@alignCast(@constCast(value)));
//     return TextIterator{ .value = textTmp.*[0..value[8]] };
// }

pub inline fn sliceNext(size: usize, q: []u8, offset: *usize) []u8 {
    const value = q[offset.* .. offset.* + size];
    offset.* += size;
    return value;
}

pub inline fn sliceNextAs(T: type, size: usize, buffer: []u8, offset: *usize) []T {
    const s = @bitSizeOf(T) / 8 * size;
    const value: []T = @as([*]T, @ptrCast(@alignCast(buffer.ptr)))[offset.* .. s + offset.*];
    offset.* += s;
    return value;
}

pub fn debugPrint(comptime format: []const u8, args: anytype) void {
    if (config.enable_debug) {
        std.debug.print(format, args);
    }
}

pub inline fn copy(T: type, dest: []T, source: []const T, offset: usize) void {
    if (offset == 0) {
        _ = memcpy(dest.ptr, source.ptr, source.len);
    } else {
        _ = memcpy(dest[offset..][0..source.len].ptr, source.ptr, source.len);
    }
}

pub inline fn copyNext(T: type, dest: []T, source: []const T, offset: *usize) void {
    copy(T, dest, source, offset.*);
    offset.* += @bitSizeOf(T) * 8 * source.len;
}

pub inline fn byteCopy(dest: anytype, source: anytype, offset: usize) void {
    const len = @bitSizeOf(@typeInfo(@TypeOf(source)).pointer.child) / 8;
    var d: [*]u8 = undefined;
    switch (@typeInfo(@TypeOf(dest))) {
        .pointer => |info| {
            if (info.size == .slice) {
                d = @ptrCast(dest.ptr);
            } else if (info.size == .c or info.size == .many) {
                d = @ptrCast(dest);
            }
        },
        else => @compileError("Invalid type"),
    }

    _ = memcpy(d + offset, source, len);
}

pub inline fn move(dest: []u8, source: []const u8) void {
    _ = memmove(dest.ptr, source.ptr, source.len);
}

pub inline fn realign(comptime T: type, data: []u8) []T {
    const address = @intFromPtr(data.ptr);
    var offset = (@alignOf(T) - (address & (@alignOf(T) - 1))) & @alignOf(T);
    if (offset == 4) offset = 0;
    const aligned: []u8 align(@alignOf(T)) = @alignCast(data[offset .. data.len - (@alignOf(T) - 1) + offset]);
    if (offset != 0) move(aligned, data[0 .. data.len - (@alignOf(T) - 1)]);
    const p: *anyopaque = aligned.ptr;
    return @as([*]T, @ptrCast(@alignCast(p)))[0 .. aligned.len / @sizeOf(T)];
}

pub inline fn microbufferToF64(propType: t.PropType, buffer: []u8, offset: usize) f64 {
    return switch (propType) {
        t.PropType.int8 => @as(f64, @floatFromInt(buffer[offset])),
        t.PropType.int16 => @as(f64, @floatFromInt(read(u16, buffer, offset))),
        t.PropType.int32 => @as(f64, @floatFromInt(read(i32, buffer, offset))),
        t.PropType.uint8 => @as(f64, @floatFromInt(buffer[offset])),
        t.PropType.uint16 => @as(f64, @floatFromInt(read(i16, buffer, offset))),
        t.PropType.uint32 => @as(f64, @floatFromInt(read(u32, buffer, offset))),
        t.PropType.number => read(f64, buffer, offset),
        else => undefined,
    };
}

pub inline fn datePart(timestamp: []u8, part: t.Interval, tz: i16) []const u8 {
    // tz in minutes to save 2 bytes (max tz is 14h = 840 min = 50400 sec)
    const ts = read(i64, timestamp, 0);
    return switch (part) {
        .hour => std.mem.asBytes(&selva.selva_gmtime_hour(ts, tz | 0)),
        .day => std.mem.asBytes(&selva.selva_gmtime_mday(ts, tz | 0)),
        .month => std.mem.asBytes(&selva.selva_gmtime_mon(ts, tz | 0)),
        .year => std.mem.asBytes(&selva.selva_gmtime_year(ts, tz | 0)),
        .dow => std.mem.asBytes(&selva.selva_gmtime_wday(ts, tz | 0)),
        .doy => std.mem.asBytes(&selva.selva_gmtime_yday(ts, tz | 0)),
        .isoDOW => std.mem.asBytes(&selva.selva_gmtime_wday2iso_wday(selva.selva_gmtime_wday(ts, tz | 0))),
        // .week => std.mem.asBytes(&(selva.selva_gmtime_iso_wyear(ts, tz).iso_week)),
        // .quarter
        .epoch => timestamp,
        else => timestamp, // do nothing = epoch
    };
}

pub inline fn sizeOf(typeToCheck: type) comptime_int {
    return @bitSizeOf(typeToCheck) / 8;
}

pub inline fn perf(ctx: anytype, callback: anytype) !void {
    var timer = try std.time.Timer.start();
    if (@typeInfo(@TypeOf(callback)).Fn.params.len == 0) {
        _ = callback();
    } else {
        _ = callback(ctx);
    }
    std.debug.print("{}ns\n", .{timer.read()});
}
