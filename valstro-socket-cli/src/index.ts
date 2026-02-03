import { io, Socket } from "socket.io-client";
import * as readline from "readline";

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

function log(...args: unknown[]) {
  console.log(...args);
}

//  app state 
let activeQuery: string | null = null;
let isSearching = false;
let isConnected = false;

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

//  socket client 
const socket: Socket = io(SERVER_URL, {
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

socket.on("connect_error", (err: Error) => {
  isConnected = false;
  log(`[connect_error] ${err.message}`);
});

socket.on("error", (err: unknown) => {
  log("[error]", err);
});

//  streamed search results 
socket.on("search", (payload: any) => {
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
