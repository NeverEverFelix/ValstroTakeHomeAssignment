"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const socket_io_client_1 = require("socket.io-client");
const readline = __importStar(require("readline"));
// Socket.IO server
const SERVER_URL = "http://localhost:3000";
//  CLI input 
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});
rl.setPrompt("> ");
function prompt() {
    rl.prompt();
}
function log(...args) {
    console.log(...args);
}
//  app state 
let activeQuery = null;
let isSearching = false;
let isConnected = false;
function resetSearch() {
    activeQuery = null;
    isSearching = false;
    log("\nReady for next search. Type a name (or 'exit').");
    prompt();
}
function emitSearch(query) {
    activeQuery = query;
    isSearching = true;
    log(`\n[emit] search query="${query}"\n`);
    socket.emit("search", { query });
}
//  socket client 
const socket = (0, socket_io_client_1.io)(SERVER_URL, {
    transports: ["websocket"],
    reconnection: true,
});
//  socket lifecycle handlers
socket.on("connect", () => {
    isConnected = true;
    log(`[connect] connected (id=${socket.id})`);
    log("Type a search query (case-insensitive partial match). Example: dar");
    prompt();
});
socket.on("disconnect", (reason) => {
    isConnected = false;
    isSearching = false; // stop blocking input if we got disconnected mid-search
    log(`\n[disconnect] reason=${reason}`);
    prompt();
});
socket.on("connect_error", (err) => {
    isConnected = false;
    log(`[connect_error] ${err.message}`);
});
socket.on("error", (err) => {
    log("[error]", err);
});
//  streamed search results 
socket.on("search", (payload) => {
    // Error case (invalid input / no matches / server error)
    if (payload?.error) {
        console.error("[search error]", payload.error);
        resetSearch();
        return;
    }
    // Success case
    if (payload?.name && Array.isArray(payload?.films)) {
        log(`• ${payload.name}`);
        log(`  Films: ${payload.films.join(", ")}`);
        log(`  (${payload.page}/${payload.resultCount})\n`);
        // Completion
        if (payload.page === payload.resultCount) {
            log(`[done] completed search for "${activeQuery ?? ""}"`);
            resetSearch();
        }
        return;
    }
    // Unexpected payload shape 
    log("[search] unrecognized payload:", payload);
});
// CLI input 
rl.on("line", (line) => {
    const query = line.trim();
    if (!query) {
        prompt();
        return;
    }
    if (query.toLowerCase() === "exit" || query.toLowerCase() === "quit") {
        rl.close();
        return;
    }
    if (!isConnected) {
        log("Not connected yet. Please wait for reconnect...");
        prompt();
        return;
    }
    // Prevent overlapping searches (keeps output clean)
    if (isSearching) {
        log("Search already in progress. Please wait for it to complete.");
        prompt();
        return;
    }
    emitSearch(query);
});
// Handle Ctrl+C / EOF cleanly
rl.on("close", () => {
    log("\nExiting...");
    socket.disconnect();
    process.exit(0);
});
