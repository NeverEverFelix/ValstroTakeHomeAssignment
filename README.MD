# Valstro Socket.IO CLI – Star Wars Character Search

A simple Node.js command-line application written in TypeScript that connects to a Socket.IO v4 backend and allows users to search for Star Wars characters by name. Results are streamed asynchronously and printed to the console as they arrive.

This project demonstrates interacting with an event-driven WebSocket API, including handling streamed responses, errors, disconnects, and clean shutdown.

---

## Features

- Connects to a Socket.IO v4 server
- Emits `search` events with a user-provided query
- Receives streamed search results asynchronously
- Prints each character's name and filmography
- Handles completion and error cases cleanly
- Prevents overlapping searches
- Gracefully handles disconnects and clean shutdown (`exit` / `quit`)
- Written in TypeScript with a minimal, readable structure

---

## Prerequisites

- Node.js (v18+ recommended)
- Docker

---

## Server Setup

The backend is provided as a Docker image. Run the following command to start the Socket.IO server:
```bash
docker run -p 3000:3000 aaronbate/socketio-backend
```

---

## Installation

Clone the repository and install dependencies:
```bash
git clone https://github.com/NeverEverFelix/ValstroTakeHomeAssignment
cd valstro-socket-cli
npm install
```

---

## Usage

Build and start the application:
```bash
npm run build
npm start
```

Once the application starts, you will see a prompt:
```
Type a search query (case-insensitive partial match). Example: dar
>
```

Enter any partial or full character name.

**Examples:**
```
> dar
> luke
> anakin
```

To exit the application cleanly:
```
> exit
```

or
```
> quit (ctrl + c)
```

---

## Search Behavior

- **Searches are case-insensitive** – Partial matches are supported
  - Example: `dar` matches Darth Vader, Darth Maul, etc.
- **Results are streamed asynchronously** – Each match is delivered as a separate search event
- **Messages may arrive with random delays** (250–1000ms)
- The CLI prints results as they arrive
- **Overlapping searches are prevented** – A new search cannot be started until the current one completes

---

## Output Format

For each matched character, the CLI prints:
```
- Darth Vader
  Films: A New Hope, The Empire Strikes Back, Return of the Jedi, Revenge of the Sith
  (1/3)
```

Where:

- The bullet (`•`) represents one streamed result
- `Films:` lists the character's filmography
- `(n/total)` indicates progress within the current search

When the search completes:
```
[done] completed search for "dar"
Ready for next search. Type a name (or 'exit').
```

---

## Error Handling

- If no matches are found, the server returns an error payload
- Errors are logged clearly to the console
- The CLI automatically resets after an error so the user can search again
- Disconnects are detected and logged
- The process shuts down cleanly on exit

---

## Project Structure
```
.
├── src/
│   └── index.ts        # Main CLI entry point
├── dist/               # Compiled JavaScript output
├── package.json
├── tsconfig.json
└── README.md
```