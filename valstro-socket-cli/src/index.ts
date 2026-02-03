import { io, Socket } from "socket.io-client";
import * as readline from "readline";

// Socket.IO server
const SERVER_URL = "http://localhost:3000";

// CLI input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.setPrompt("> ");

function log(...args: unknown[]) {
  console.log(...args);
}

// App state
let activeQuery: string | null = null;
let isSearching = false;
let isConnected = false;
let isShuttingDown = false;

function prompt() {
  // Never prompt after readline is closed / during shutdown
  if (isShuttingDown) return;
  rl.prompt();
}

function resetSearch() {
  activeQuery = null;
  isSearching = false;
  log("\nReady for next search. Type a name (or 'exit').");
  prompt();
}

function emitSearch(query: string) {
  activeQuery = query;
  isSearching = true;
  log(`\n[emit] search query="${query}"\n`);
  socket.emit("search", { query });
}

// Socket client
const socket: Socket = io(SERVER_URL, {
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

socket.on("connect_error", (err: Error) => {
  isConnected = false;
  log(`[connect_error] ${err.message}`);
});

socket.on("error", (err: unknown) => {
  log("[error]", err);
});

// Streamed search results
socket.on("search", (payload: any) => {
  // Normalize: server may send either an object OR a single-element array.
  const message =
    Array.isArray(payload) && payload.length === 1 ? payload[0] : payload;

  // If we truly cannot interpret the message, log it but do NOT reset.
  // Resetting here causes noisy prompts while the server is still streaming.
  if (!message || typeof message !== "object") {
    log("[search] unrecognized payload:", payload);
    return;
  }

  // Error case (documented): page/resultCount are -1
  if ((message as any).page === -1 && (message as any).resultCount === -1) {
    console.error(
      "[search error]",
      (message as any).error ?? "Unknown error"
    );
    resetSearch();
    return;
  }

  // Some implementations may send { error: "..." } without page/resultCount.
  if (typeof (message as any).error === "string") {
    console.error("[search error]", (message as any).error);
    resetSearch();
    return;
  }

  // Success case
  if (
    typeof (message as any).name === "string" &&
    Array.isArray((message as any).films)
  ) {
    log(`• ${(message as any).name}`);
    log(`  Films: ${(message as any).films.join(", ")}`);
    log(`  (${(message as any).page}/${(message as any).resultCount})\n`);

    // Completion: last message in the stream
    if ((message as any).page === (message as any).resultCount) {
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
