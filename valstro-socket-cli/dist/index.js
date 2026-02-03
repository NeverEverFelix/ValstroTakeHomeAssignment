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
// CLI input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});
rl.setPrompt("> ");
function log(...args) {
    console.log(...args);
}
// App state
let activeQuery = null;
let isSearching = false;
let isConnected = false;
let isShuttingDown = false;
function prompt() {
    // Never prompt after readline is closed / during shutdown
    if (isShuttingDown)
        return;
    rl.prompt();
}
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
// Socket client
const socket = (0, socket_io_client_1.io)(SERVER_URL, {
    transports: ["websocket"],
    reconnection: true,
});
// Socket lifecycle handlers
socket.on("connect", () => {
    isConnected = true;
    log(`[connect] connected (id=${socket.id})`);
    log("Type a search query (case-insensitive partial match). Example: dar");
    prompt();
});
socket.on("disconnect", (reason) => {
    isConnected = false;
    const wasSearching = isSearching;
    isSearching = false;
    log(`\n[disconnect] reason=${reason}`);
    // If we disconnected mid-search, consider that search aborted
    if (wasSearching) {
        activeQuery = null;
    }
    if (!isShuttingDown) {
        prompt();
    }
});
socket.on("connect_error", (err) => {
    isConnected = false;
    log(`[connect_error] ${err.message}`);
});
socket.on("error", (err) => {
    log("[error]", err);
});
// Streamed search results
socket.on("search", (payload) => {
    // Normalize: server may send either an object OR a single-element array.
    const message = Array.isArray(payload) && payload.length === 1 ? payload[0] : payload;
    // If we truly cannot interpret the message, log it but do NOT reset.
    // Resetting here causes noisy prompts while the server is still streaming.
    if (!message || typeof message !== "object") {
        log("[search] unrecognized payload:", payload);
        return;
    }
    // Error case (documented): page/resultCount are -1
    if (message.page === -1 && message.resultCount === -1) {
        console.error("[search error]", message.error ?? "Unknown error");
        resetSearch();
        return;
    }
    // Some implementations may send { error: "..." } without page/resultCount.
    if (typeof message.error === "string") {
        console.error("[search error]", message.error);
        resetSearch();
        return;
    }
    // Success case
    if (typeof message.name === "string" &&
        Array.isArray(message.films)) {
        log(`• ${message.name}`);
        log(`  Films: ${message.films.join(", ")}`);
        log(`  (${message.page}/${message.resultCount})\n`);
        // Completion: last message in the stream
        if (message.page === message.resultCount) {
            log(`[done] completed search for "${activeQuery ?? ""}"`);
            resetSearch();
        }
        return;
    }
    // Unexpected message shape: log only (no reset).
    log("[search] unrecognized message shape:", message);
});
// CLI input
rl.on("line", (line) => {
    const query = line.trim();
    if (!query) {
        prompt();
        return;
    }
    const lower = query.toLowerCase();
    if (lower === "exit" || lower === "quit") {
        rl.close();
        return;
    }
    if (!isConnected) {
        log("Not connected yet. Please wait for reconnect...");
        prompt();
        return;
    }
    // Ignore input while a search is streaming (keeps output clean)
    if (isSearching) {
        return;
    }
    emitSearch(query);
});
// Handle Ctrl+C / EOF cleanly
rl.on("close", () => {
    isShuttingDown = true;
    log("\nExiting...");
    socket.disconnect();
    process.exit(0);
});
