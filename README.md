# Coursera Skipper

> A browser extension to skip unwanted sections (readings, videos, quizzes) in Coursera courses

## 🚧 Project Status: Migration in Progress

This project is being migrated from Python to TypeScript for use as a browser extension.

### Current Implementation

- ✅ Python implementation (reference in `feats/`)
- ⏳ TypeScript browser extension (in progress)

## 📁 Project Structure

```
CourseraSkipper/
├── .github/
│   └── instructions/          # Development instructions
├── requirements/              # Implementation tasks (START HERE)
├── feats/
│   ├── assetments/           # Quiz/assignment solver
│   ├── llm/                  # LLM integration
│   └── watcher/              # Video watcher
└── extension/                # Browser extension (to be created)
```

## 🎯 Features (Planned)

- ✅ Auto-solve quizzes and assignments using AI
- ✅ Auto-complete video lectures
- ✅ Skip reading materials
- 🔄 Browser extension interface
- 🔄 Configurable LLM backend (Perplexity, OpenAI, Claude)

## 🚀 Getting Started for Developers

### Quick Start (3 Steps)

1. **📖 Read the Quick Start Guide**

   ```bash
   requirements/QUICKSTART.md
   ```

2. **📋 Review Requirements**

   ```bash
   requirements/README.md
   requirements/00-overview.md
   ```

3. **✅ Start First Task**
   ```bash
   requirements/01-types-migration.md
   ```

### Full Documentation

| Document                                        | Purpose                       |
| ----------------------------------------------- | ----------------------------- |
| [QUICKSTART.md](requirements/QUICKSTART.md)     | 5-minute intro to get started |
| [README.md](requirements/README.md)             | Requirements overview         |
| [00-overview.md](requirements/00-overview.md)   | Project architecture & status |
| [PROGRESS.md](requirements/PROGRESS.md)         | Detailed progress tracking    |
| [UPDATE_GUIDE.md](requirements/UPDATE_GUIDE.md) | How to update progress        |
| [LOG_TEMPLATE.md](requirements/LOG_TEMPLATE.md) | Daily log template            |

### Implementation Order

Work through requirements sequentially:

1. **Type Definitions** (`01-types-migration.md`) - 36 tasks
2. **GraphQL Queries** (`02-queries-setup.md`) - 27 tasks
3. **Assessment Solver** (`03-assessment-solver.md`) - 57 tasks
4. **Video Watcher** (`04-video-watcher.md`) - 53 tasks
5. **LLM Connector** (`05-llm-connector.md`) - 60 tasks
6. **Extension Setup** (`06-extension-setup.md`) - 91 tasks
7. **Integration & Testing** (`07-integration-testing.md`) - 68 tasks

**Total: 392 tasks**

## 🔧 Python Reference Implementation

The Python version is located in `feats/` and serves as a reference for the TypeScript implementation.

### Key Components:

- **Assessment Solver** (`feats/assetments/solver.py`) - Auto-solves quizzes
- **Video Watcher** (`feats/watcher/watcher.py`) - Auto-completes videos
- **LLM Connector** (`feats/llm/connector.py`) - AI integration

## 📝 Migration Guidelines

### Python → TypeScript Mapping

```
requests.Session     → fetch API / axios
Pydantic models      → TypeScript interfaces
Optional[T]          → T | null | undefined
dict                 → Record<string, T>
List[T]              → T[]
```

### Browser Extension Adaptation

- Use Chrome Extension APIs
- Handle authentication via cookies
- Store settings in Chrome Storage
- Inject content scripts on Coursera pages

## 📚 Documentation

- [Project Instructions](.github/instructions/init.instructions.md) - Main guidelines
- [Requirements Overview](requirements/00-overview.md) - Migration status
- [Requirements README](requirements/README.md) - Task tracking guide

## 🤝 Contributing

1. Read the instructions in `.github/instructions/`
2. Pick a task from `/requirements/`
3. Implement following the Python reference
4. Check off completed tasks
5. Submit PR with updated checkboxes

## ⚠️ Disclaimer

This tool is for educational purposes. Use responsibly and in accordance with Coursera's terms of service.

## 📄 License

[Add your license here]

---

**Status**: 🔨 Active development - TypeScript migration in progress

For detailed implementation tasks, see [`requirements/README.md`](requirements/README.md)
