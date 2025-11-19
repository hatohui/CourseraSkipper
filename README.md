# Coursera Skipper

A browser extension that helps you automatically complete Coursera course items including videos, readings, quizzes, and programming assignments.

## Currently Working Features

| Feature                     | Status             | Description                                                                   |
| --------------------------- | ------------------ | ----------------------------------------------------------------------------- | --- |
| **Video Watching**          | ✅ Working         | Automatically completes video lectures by simulating play/progress/end events |
| **Reading Completion**      | ✅ Working         | Marks reading materials and supplements as complete                           |
| **Programming Assignments** | ✅ Working         | Completes graded LTI programming assignments with passing grade               |     |
| **Quiz Solving**            | ⚠️ In Progress     | GraphQL-based quiz solver (solver logic exists, LLM integration pending)      |
| **Peer Review**             | ❌ Not Implemented | Peer-graded assignments not yet supported                                     |

## Performance

- **Single Video**: ~3 seconds
- **Single Reading**: ~1 second
- **Single Programming Assignment**: ~3 seconds
- **Module with 10 videos + 5 readings + 3 programming**: ~4 seconds (concurrent processing)

## Installation

1. Clone this repository
2. Run `npm install`
3. Run `npm run build`
4. Load the `dist` folder as an unpacked extension in Chrome

## Usage

### Individual Items

Navigate to any course item (video, reading, programming assignment) and click the floating button:

- 📹 Videos: "Watch Video" button
- 📖 Readings: "Complete Reading" button
- 💻 Programming: "Complete Assignment" button
- ✓ Quizzes: "Solve Quiz" button (in progress)

### Module Skip

1. Navigate to a module overview page (`/home/module/{number}`)
2. Click "Skip All Items" in the module skipper widget
3. Watch as all items complete concurrently

## Tech Stack

- TypeScript
- Chrome Extension APIs
- Coursera REST & GraphQL APIs
- Webpack for bundling

## Project Structure

```
CourseraSkipper/
├── extension/           # Browser extension files
│   ├── background/      # Service worker
│   ├── content/         # Content scripts
│   ├── popup/           # Extension popup
│   └── utils/           # Shared utilities
├── feats/              # Feature modules
│   ├── assetments/     # Quiz solver
│   ├── watcher/        # Video watcher
│   ├── gradedlti/      # Programming assignments
│   └── llm/            # LLM connector
└── types/              # TypeScript type definitions
```

## Contributing

This is an open-source project. Feel free to submit issues and pull requests.

## License

MIT
