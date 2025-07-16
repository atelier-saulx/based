"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERSISTENT_STORAGE = void 0;
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
exports.PERSISTENT_STORAGE = (0, node_path_1.resolve)((0, node_path_1.join)((0, node_os_1.homedir)(), '.based/cli'));
