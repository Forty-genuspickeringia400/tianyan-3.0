# API Contract

## endpoints
- GET /api/health
- GET /api/catalog
- GET /api/profiles/runtime
- GET /api/profiles/skill
- GET /api/tasks
- POST /api/tasks
- GET /api/tasks/:taskId
- GET /api/tasks/:taskId/events
- GET /api/tasks/:taskId/timeline
- GET /api/tasks/:taskId/graph
- GET /api/tasks/:taskId/queue
- GET /api/tasks/:taskId/files
- GET /api/tasks/:taskId/file?path=...
- GET /api/tasks/:taskId/package
- GET /api/tasks/:taskId/skill-pack
- GET /api/tasks/:taskId/skill-pack-readiness
- GET /api/tasks/:taskId/explorer
- GET /api/tasks/:taskId/observability
- GET /api/architecture
- GET /api/federation
- GET /api/tasks/:taskId/download-bundle
- GET /api/tasks/:taskId/download-bundle-zip
- GET /api/tasks/:taskId/download-skill-pack
- POST /api/tasks/:taskId/run-subtasks

- **note**: Generated for: Produce an API contract for: Build a seven-layer runtime with docs, tests, api, implementation and installable skill pack