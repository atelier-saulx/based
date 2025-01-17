const std = @import("std");
const download = @import("build_dw_node_headers.zig");

pub fn build(b: *std.Build) !void {
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const allocator = arena.allocator();

    const node_versions = [_][]const u8{ "v20.11.1", "v20.18.1", "v22.13.0" };

    const target = b.standardTargetOptions(.{});

    const base_dir = "../dist/lib/";
    const install_dir = switch (target.result.cpu.arch) {
        .x86_64 => switch (target.result.os.tag) {
            .linux => base_dir ++ "linux_x86_64",
            .macos => base_dir ++ "darwin_x86_64",
            else => "unknown_os",
        },
        .aarch64 => switch (target.result.os.tag) {
            .linux => base_dir ++ "linux_aarch64",
            .macos => base_dir ++ "darwin_arm64",
            else => "unknown_os",
        },
        else => "unknown_os",
    };
    const output_dir = install_dir[3..];

    if (std.mem.eql(u8, output_dir, "unknown_os")) {
        std.debug.print("Unknown, unsupported OS\n", .{});
        return;
    }

    const lib = b.addSharedLibrary(.{
        .name = "based-db-zig",
        .root_source_file = b.path("native/lib.zig"),
        .target = target,
        .optimize = .ReleaseSmall,
        .link_libc = true,
    });

    lib.linker_allow_shlib_undefined = true;

    lib.addLibraryPath(b.path(output_dir));

    // Add include path for build
    lib.addIncludePath(b.path(try std.fmt.allocPrint(allocator, "{s}/include/", .{output_dir})));
    lib.addLibraryPath(b.path(output_dir));

    // TODO Linux rpath
    lib.root_module.addRPathSpecial("@loader_path");
    lib.linkSystemLibrary("selva");

    lib.linkLibC();

    for (node_versions) |version| {
        download.download_node_headers(version) catch |err| {
            std.debug.print("Failed downloading node headers for version {s}: {}\n", .{ version, err });
            return;
        };

        lib.addSystemIncludePath(b.path(try std.fmt.allocPrint(allocator, "deps/node-{s}/include/node/", .{version})));

        // Yes! that is uggly as hell but apparently zig expects that .dest_sub_path to be a pre-generated static string.
        // Since there is no better solution for that, we will just hardcode the values here.
        // TODO this code will be ported to TS to avoid this kind of problem.
        const dest_sub_path = if (std.mem.eql(u8, version, "v20.11.1")) "lib.node-v20.11.1" else if (std.mem.eql(u8, version, "v20.18.1")) "lib.node-v20.18.1" else if (std.mem.eql(u8, version, "v22.13.0")) "lib.node-v22.13.0" else return error.InvalidNodeVersion;

        std.debug.print("Building {s}...\n", .{dest_sub_path});

        var install_lib = b.addInstallArtifact(lib, .{
            .dest_dir = .{
                .override = .{ .custom = install_dir },
            },
            .dest_sub_path = dest_sub_path,
        });

        b.getInstallStep().dependOn(&install_lib.step);
    }

    // another ugly stuff here, but we need to do that because the dynamic lib is created in zig-out anyway.
    var lib_suffix: []const u8 = undefined;
    var lib_prefix: []const u8 = undefined;
    var arch: []const u8 = undefined;
    if (target.result.os.tag == .linux) {
        lib_suffix = ".so";
        lib_prefix = "linux_";
    } else if (target.result.os.tag == .macos) {
        lib_suffix = ".dylib";
        lib_prefix = "darwin_";
    } else {
        return error.UnsupportedOs;
    }
    // we are not following the system notation so .aarch64 will be arm64 why K.I.S.S.?
    if (target.result.cpu.arch == .aarch64) {
        arch = "arm64";
    } else {
        arch = @tagName(target.result.cpu.arch);
    }
    const resolved_source_path = try std.fmt.allocPrint(allocator, "zig-out/lib/libbased-db-zig{s}", .{lib_suffix});
    const resolved_install_dir = try std.fmt.allocPrint(allocator, "dist/lib/{s}{s}/", .{ lib_prefix, arch });

    const install_step = b.addSystemCommand(&[_][]const u8{
        "mv",
        resolved_source_path,
        resolved_install_dir,
    });
    b.getInstallStep().dependOn(&install_step.step);

    defer allocator.free(resolved_source_path);
    defer allocator.free(resolved_install_dir);

    b.installArtifact(lib);
    std.debug.print("Done.\n", .{});
}
