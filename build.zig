const std = @import("std");
const builtin = @import("builtin");

fn runCommand(b: *std.Build, argv: []const []const u8) ![]u8 {
    const alloc = std.heap.page_allocator;
    const proc = try std.process.Child.run(.{
        .argv = argv,
        .allocator = alloc,
    });
    defer alloc.free(proc.stderr);
    defer alloc.free(proc.stdout);
    const result = std.mem.trimRight(u8, proc.stdout, " \n\r\t");
    return b.fmt("{s}", .{result});
}

fn currentNodeHeaderPath(b: *std.Build) ![]u8 {
    const argv = [_][]const u8{ "which", "node" };
    var result = try runCommand(b, &argv);
    const suffix = "/bin/node";
    if (std.mem.endsWith(u8, result, suffix)) {
        return b.fmt("{s}/include/node", .{result[0 .. result.len - suffix.len]});
    }
    return b.fmt("{s}/include/node", .{result});
}

fn currentNapiVersion(b: *std.Build) ![]u8 {
    const argv = [_][]const u8{ "node", "-p", "process.versions.napi" };
    const result = try runCommand(b, &argv);
    return b.fmt("{s}", .{result});
}

pub fn build(b: *std.Build) !void {
    comptime {
        const required_zig = "0.15.2";
        const current_zig = builtin.zig_version;
        const min_zig = std.SemanticVersion.parse(required_zig) catch unreachable;
        if (current_zig.order(min_zig) == .lt) {
            const msg = std.fmt.comptimePrint("Zig version {s} or newer is required to build this project.", .{required_zig});
            @compileError(msg);
        }
    }

    const target = b.standardTargetOptions(.{});
    const options = b.addOptions();
    const enable_debug = b.option(bool, "enable_debug", "Enable debugging prints") orelse false;
    const opt: std.builtin.OptimizeMode = if (enable_debug) .Debug else .ReleaseFast;

    const lib = b.addLibrary(.{
        .linkage = .dynamic,
        .name = "based_db_zig",
        .root_module = b.createModule(.{
            .root_source_file = b.path("native/lib.zig"),
            .target = target,
            .optimize = opt,
            .link_libc = true,
        }),
    });

    lib.linker_allow_shlib_undefined = true;

    options.addOption(bool, "enable_debug", enable_debug);
    lib.root_module.addOptions("config", options);

    const node_hpath = try currentNodeHeaderPath(b);
    const napiVersion = try currentNapiVersion(b);
    const osName: []const u8 = if (target.result.os.tag == .macos) "darwin" else @tagName(target.result.os.tag);
    const libPath = b.fmt("dist/lib/{s}_{s}", .{ osName, @tagName(target.result.cpu.arch) });
    const headerPath = b.fmt("{s}/include", .{
        libPath,
    });
    // needs to be relative from zig-out/lib
    const targetPath = b.fmt("../../{s}/libbased-{s}.node", .{
        libPath,
        napiVersion,
    });
    // std.debug.print("libPath: {s}, headerPath: {s}, targetPath {s}", .{ libPath, headerPath, targetPath });
    // const rpath = b.option([]const u8, "rpath", "run-time search path") orelse "$ORIGIN"; // "@loader_path";
    lib.root_module.addRPathSpecial(if (target.result.os.tag == .macos) "@loader_path" else "$ORIGIN");
    lib.root_module.addIncludePath(.{ .cwd_relative = node_hpath });
    lib.root_module.addIncludePath(.{ .cwd_relative = headerPath });
    lib.root_module.addLibraryPath(.{ .cwd_relative = libPath });
    lib.root_module.linkSystemLibrary("selva", .{});
    lib.root_module.link_libc = true;

    const install_lib = b.addInstallArtifact(lib, .{
        .dest_sub_path = targetPath,
    });
    const install_step = b.getInstallStep();
    install_step.dependOn(&install_lib.step);

    // This creates a "check" step that allows zls (Zig Language Server) to analyze the code.
    // It reuses the same module definition from the library being built.
    const check_step = b.step("check", "Check compilation for zls");
    check_step.dependOn(&lib.step);
}
