import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { URL } from 'node:url';
import { buildSubtaskExecutionPlan } from '../core/subtask-queue.js';
import { buildTaskGraph, buildTaskTimeline } from '../core/task-graph.js';
import { config } from '../config.js';

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data, null, 2));
}

function requireCapability(res, app, capability) {
  const verdict = app.licenseService?.assertCapability?.(capability) || { allowed: true };
  if (verdict.allowed) return true;
  sendJson(res, 403, {
    error: 'license-capability-denied',
    capability,
    reason: verdict.reason,
    license: app.licenseService?.getHomeReport?.() || null,
  });
  return false;
}

function sendHtml(res, filePath) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(fs.readFileSync(filePath, 'utf8'));
}

function sendDownload(res, filePath, downloadName) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = ext === '.json'
    ? 'application/json; charset=utf-8'
    : ext === '.md' || ext === '.txt'
      ? 'text/plain; charset=utf-8'
      : ext === '.zip' || ext === '.skill'
        ? 'application/zip'
        : 'application/octet-stream';

  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${downloadName}"`,
  });
  res.end(fs.readFileSync(filePath));
}

function listFilesRecursive(dir, baseDir = dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(fullPath, baseDir));
    } else {
      const stat = fs.statSync(fullPath);
      files.push({
        name: entry.name,
        path: fullPath,
        relative_path: path.relative(baseDir, fullPath).replaceAll('\\', '/'),
        size: stat.size,
        updated_at: stat.mtime.toISOString(),
      });
    }
  }

  return files.sort((a, b) => a.relative_path.localeCompare(b.relative_path));
}

function safeResolveTaskFile(taskId, relativePath) {
  const root = path.resolve(config.generatedDir, taskId);
  const resolved = path.resolve(root, relativePath || '');
  if (!resolved.startsWith(root)) return null;
  return resolved;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

function notFound(res) {
  sendJson(res, 404, { error: 'Not found' });
}

function getTaskFiles(task) {
  const dir = path.join(config.generatedDir, task.task_id);
  return listFilesRecursive(dir);
}

function getTaskEvents(app, taskId) {
  return app.eventStore.list(taskId);
}

function getSubtasks(app, taskId) {
  return app.taskStore.list().filter((item) => item.parent_task_id === taskId);
}

function buildTaskLifecycle(app, task) {
  const events = getTaskEvents(app, task.task_id);
  const allTasks = app.taskStore.list();
  return {
    status: task.status,
    timeline: buildTaskTimeline(task, events),
    graph: buildTaskGraph(task, allTasks, app.eventStore.list()),
    phases: app.architectureService.buildTaskObservability(task, { events, allTasks }).lifecycle,
    events_count: events.length,
    subtasks_count: getSubtasks(app, task.task_id).length,
  };
}

function buildTaskWorkbench(app, task) {
  const files = getTaskFiles(task);
  const events = getTaskEvents(app, task.task_id);
  const allTasks = app.taskStore.list();
  const backgroundRuns = app.backgroundRunStore.list();
  const installRecords = app.skillInstallService.getRecords();
  const pkg = app.packageService.summarizeTaskPackage(task, files);
  const explorer = app.packageService.summarizeExplorer(task, files);
  const lifecycle = buildTaskLifecycle(app, task);
  const observability = app.architectureService.buildTaskObservability(task, { events, allTasks });

  return {
    task,
    subtasks: getSubtasks(app, task.task_id),
    lifecycle,
    observability,
    evolution: observability.evolution,
    soul: app.soulService.getTaskReport(task, { allTasks, backgroundRuns }),
    defense: app.defenseMatrixService.getTaskReport(task, { allTasks, installRecords }),
    network_security: app.networkSecurityService.getTaskReport(task, { allTasks, installRecords }),
    evolution_control: app.evolutionService.getTaskReport(task, {
      tasks: allTasks,
      backgroundRuns,
      installRecords,
    }),
    package: pkg,
    skill_pack: pkg.skill_pack,
    explorer,
    files,
    events,
  };
}

export function createServer(app) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const pathname = url.pathname;

      if (req.method === 'GET' && pathname === '/') {
        return sendHtml(res, path.join(config.publicDir, 'index.html'));
      }

      if (req.method === 'GET' && pathname === '/api/health') {
        return sendJson(res, 200, {
          ok: true,
          project: config.projectSlug,
          display_name: config.projectDisplayName,
          product_name: config.productName,
          bind_host: config.host,
          authorization: app.licenseService?.getHomeReport?.() || null,
          time: new Date().toISOString(),
        });
      }

      if (req.method === 'GET' && pathname === '/api/license/status') {
        return sendJson(res, 200, {
          license: app.licenseService?.getHomeReport?.() || null,
        });
      }

      if (req.method === 'GET' && pathname === '/api/license/fingerprint') {
        return sendJson(res, 200, {
          fingerprint: app.licenseService?.getFingerprintReport?.() || null,
        });
      }

      if (req.method === 'GET' && pathname === '/api/license/heartbeat') {
        return sendJson(res, 200, {
          heartbeat: app.licenseService?.getHeartbeatState?.({ refresh: true }) || null,
        });
      }

      if (req.method === 'POST' && pathname === '/api/license/heartbeat') {
        const body = await readBody(req);
        return sendJson(res, 200, {
          heartbeat: app.licenseService?.recordHeartbeat?.({
            source: body.source || 'http-api',
            remote: body.remote || null,
            metadata: body.metadata || null,
          }) || null,
          license: app.licenseService?.getHomeReport?.() || null,
        });
      }

      if (req.method === 'GET' && pathname === '/api/license/revoke-check') {
        return sendJson(res, 200, app.licenseService?.checkRevocation?.({ source: 'http-api-read' }) || {});
      }

      if (req.method === 'POST' && pathname === '/api/license/revoke-check') {
        const body = await readBody(req);
        return sendJson(res, 200, app.licenseService?.checkRevocation?.({
          source: body.source || 'http-api',
          update: body.revocation || body.update || body,
        }) || {});
      }

      if (req.method === 'POST' && pathname === '/api/license/activate') {
        const body = await readBody(req);
        const payload = body.license
          ?? body.licenseContent
          ?? body.license_content
          ?? ((body.signature || body.licenseId || body.license_id)
            ? Object.fromEntries(Object.entries(body).filter(([key]) => !['source'].includes(key)))
            : body);

        try {
          const result = app.licenseService?.activateLicense?.(payload, {
            source: body.source || 'http-api',
          });
          return sendJson(res, 201, result || { ok: false, error: 'license-service-unavailable' });
        } catch (error) {
          return sendJson(res, 400, {
            error: 'license-activation-failed',
            message: error.message,
            license: app.licenseService?.getHomeReport?.() || null,
          });
        }
      }

      if (req.method === 'GET' && pathname === '/api/dashboard') {
        return sendJson(res, 200, { dashboard: app.dashboardService.getHomeReport() });
      }

      if (req.method === 'GET' && pathname === '/api/catalog') {
        return sendJson(res, 200, {
          catalog: app.productCatalog.getCatalog(),
          runtime_profile: app.runtimeProfile.getProfile(),
          skill_profile: app.skillProfile.getProfile(),
        });
      }

      if (req.method === 'GET' && pathname === '/api/architecture') {
        const tasks = app.taskStore.list();
        const runs = app.backgroundRunStore.list();
        const installs = app.skillInstallService.getRecords();
        return sendJson(res, 200, {
          layers: app.architectureService.getLayers(),
          modes: app.architectureService.getModes(),
          runtime_layers: app.architectureService.getRuntimeLayers({ tasks, backgroundRuns: runs, installRecords: installs }),
          runtime_modes: app.architectureService.getRuntimeModes({ tasks, backgroundRuns: runs }),
          evolution: app.architectureService.getEvolutionReport({ tasks, backgroundRuns: runs, installRecords: installs }),
          network_security: app.networkSecurityService.getHomeReport({ tasks, backgroundRuns: runs, installRecords: installs }),
          meta_core: app.metaCore,
        });
      }

      if (req.method === 'GET' && pathname === '/api/soul') {
        const tasks = app.taskStore.list();
        const runs = app.backgroundRunStore.list();
        return sendJson(res, 200, {
          soul: app.soulService.getHomeReport({ tasks, backgroundRuns: runs }),
        });
      }

      if (req.method === 'GET' && pathname === '/api/defense') {
        const tasks = app.taskStore.list();
        const runs = app.backgroundRunStore.list();
        const installs = app.skillInstallService.getRecords();
        return sendJson(res, 200, {
          defense: app.defenseMatrixService.getHomeReport({ tasks, backgroundRuns: runs, installRecords: installs }),
        });
      }

      if (req.method === 'GET' && pathname === '/api/network-security') {
        const tasks = app.taskStore.list();
        const runs = app.backgroundRunStore.list();
        const installs = app.skillInstallService.getRecords();
        return sendJson(res, 200, {
          network_security: app.networkSecurityService.getHomeReport({ tasks, backgroundRuns: runs, installRecords: installs }),
        });
      }

      if (req.method === 'GET' && pathname === '/api/evolution') {
        const tasks = app.taskStore.list();
        const runs = app.backgroundRunStore.list();
        const installs = app.skillInstallService.getRecords();
        return sendJson(res, 200, {
          lineage: app.architectureService.getEvolutionReport({ tasks, backgroundRuns: runs, installRecords: installs }),
          evolution_system: app.evolutionService.getGovernanceReport({ tasks, backgroundRuns: runs, installRecords: installs }),
        });
      }

      if (req.method === 'GET' && pathname === '/api/federation') {
        const agents = app.agentRegistry.list();
        return sendJson(res, 200, {
          agents,
          summary: {
            total_agents: agents.length,
            local_runtime: true,
            federation_mode: 'local-runtime',
          },
        });
      }

      if (req.method === 'GET' && pathname === '/api/profiles/runtime') {
        return sendJson(res, 200, { profile: app.runtimeProfile.getProfile() });
      }

      if (req.method === 'GET' && pathname === '/api/profiles/skill') {
        return sendJson(res, 200, { profile: app.skillProfile.getProfile() });
      }

      if (req.method === 'GET' && pathname === '/api/tasks') {
        return sendJson(res, 200, { tasks: app.taskStore.list() });
      }

      if (req.method === 'POST' && pathname === '/api/tasks') {
        if (!requireCapability(res, app, 'basicWorkflows')) return;
        const body = await readBody(req);
        const task = await app.orchestrator.createAndRun(body.input, body.context || {});
        return sendJson(res, 201, { task });
      }

      const taskMatch = pathname.match(/^\/api\/tasks\/([^/]+)$/);
      if (req.method === 'GET' && taskMatch) {
        const task = app.taskStore.get(taskMatch[1]);
        if (!task) return notFound(res);
        const subtasks = getSubtasks(app, task.task_id);
        return sendJson(res, 200, { task, subtasks });
      }

      const eventsMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/events$/);
      if (req.method === 'GET' && eventsMatch) {
        return sendJson(res, 200, { events: getTaskEvents(app, eventsMatch[1]) });
      }

      const observabilityMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/observability$/);
      if (req.method === 'GET' && observabilityMatch) {
        const task = app.taskStore.get(observabilityMatch[1]);
        if (!task) return notFound(res);
        const events = getTaskEvents(app, task.task_id);
        const allTasks = app.taskStore.list();
        return sendJson(res, 200, {
          observability: app.architectureService.buildTaskObservability(task, { events, allTasks }),
        });
      }

      const lifecycleMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/lifecycle$/);
      if (req.method === 'GET' && lifecycleMatch) {
        const task = app.taskStore.get(lifecycleMatch[1]);
        if (!task) return notFound(res);
        return sendJson(res, 200, { lifecycle: buildTaskLifecycle(app, task) });
      }

      const timelineMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/timeline$/);
      if (req.method === 'GET' && timelineMatch) {
        const task = app.taskStore.get(timelineMatch[1]);
        if (!task) return notFound(res);
        return sendJson(res, 200, { timeline: buildTaskLifecycle(app, task).timeline });
      }

      const graphMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/graph$/);
      if (req.method === 'GET' && graphMatch) {
        const task = app.taskStore.get(graphMatch[1]);
        if (!task) return notFound(res);
        return sendJson(res, 200, { graph: buildTaskLifecycle(app, task).graph });
      }

      const queueMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/queue$/);
      if (req.method === 'GET' && queueMatch) {
        const task = app.taskStore.get(queueMatch[1]);
        if (!task) return notFound(res);
        return sendJson(res, 200, {
          queue: buildSubtaskExecutionPlan(task, app.taskStore.list()),
        });
      }

      const workbenchMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/workbench$/);
      if (req.method === 'GET' && workbenchMatch) {
        const task = app.taskStore.get(workbenchMatch[1]);
        if (!task) return notFound(res);
        return sendJson(res, 200, { workbench: buildTaskWorkbench(app, task) });
      }

      const filesMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/files$/);
      if (req.method === 'GET' && filesMatch) {
        const task = app.taskStore.get(filesMatch[1]);
        if (!task) return notFound(res);
        return sendJson(res, 200, { files: getTaskFiles(task) });
      }

      const packageMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/package$/);
      if (req.method === 'GET' && packageMatch) {
        const task = app.taskStore.get(packageMatch[1]);
        if (!task) return notFound(res);
        const files = getTaskFiles(task);
        return sendJson(res, 200, { package: app.packageService.summarizeTaskPackage(task, files) });
      }

      const skillPackMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/skill-pack$/);
      if (req.method === 'GET' && skillPackMatch) {
        const task = app.taskStore.get(skillPackMatch[1]);
        if (!task) return notFound(res);
        const files = getTaskFiles(task);
        return sendJson(res, 200, { skill_pack: app.packageService.summarizeSkillPack(task, files) });
      }

      const skillReadinessMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/skill-pack-readiness$/);
      if (req.method === 'GET' && skillReadinessMatch) {
        const task = app.taskStore.get(skillReadinessMatch[1]);
        if (!task) return notFound(res);
        const files = getTaskFiles(task);
        const skillPack = app.packageService.summarizeSkillPack(task, files);
        return sendJson(res, 200, { readiness: skillPack.readiness, skill_pack: skillPack });
      }

      const skillInstallationMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/skill-installation$/);
      if (req.method === 'GET' && skillInstallationMatch) {
        const task = app.taskStore.get(skillInstallationMatch[1]);
        if (!task) return notFound(res);
        const files = getTaskFiles(task);
        const skillPack = app.packageService.summarizeSkillPack(task, files);
        return sendJson(res, 200, {
          installation: skillPack.installation,
          skill_pack: {
            name: skillPack.name,
            display_name: skillPack.display_name,
            installed: skillPack.installed,
            verified: skillPack.verified,
            install_strategy: skillPack.install_strategy,
            entrypoints: skillPack.entrypoints,
          },
        });
      }

      const installSkillPackMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/install-skill-pack$/);
      if (req.method === 'POST' && installSkillPackMatch) {
        if (!requireCapability(res, app, 'skillInstall')) return;
        const task = app.taskStore.get(installSkillPackMatch[1]);
        if (!task) return notFound(res);
        const files = getTaskFiles(task);
        const skillPack = app.packageService.summarizeSkillPack(task, files);
        if (!skillPack?.entrypoints?.directory) {
          return sendJson(res, 400, { error: 'Task does not have an exported skill-pack to install.' });
        }
        const installation = await app.skillInstallService.installGeneratedSkillPack({
          task,
          skillPack,
          installMode: 'manual',
        });
        const receiptPath = path.join(config.generatedDir, task.task_id, 'skill-pack', 'installation.json');
        fs.writeFileSync(receiptPath, JSON.stringify(installation, null, 2), 'utf8');
        const refreshedFiles = getTaskFiles(task);
        return sendJson(res, 200, {
          installation,
          skill_pack: app.packageService.summarizeSkillPack(task, refreshedFiles),
        });
      }

      const explorerMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/explorer$/);
      if (req.method === 'GET' && explorerMatch) {
        const task = app.taskStore.get(explorerMatch[1]);
        if (!task) return notFound(res);
        const files = getTaskFiles(task);
        return sendJson(res, 200, { explorer: app.packageService.summarizeExplorer(task, files) });
      }

      const fileMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/file$/);
      if (req.method === 'GET' && fileMatch) {
        const task = app.taskStore.get(fileMatch[1]);
        if (!task) return notFound(res);
        const relativePath = url.searchParams.get('path') || '';
        const resolved = safeResolveTaskFile(task.task_id, relativePath);
        if (!resolved || !fs.existsSync(resolved)) return notFound(res);
        const stat = fs.statSync(resolved);
        const content = fs.readFileSync(resolved, 'utf8');
        return sendJson(res, 200, {
          file: {
            relative_path: relativePath,
            size: stat.size,
            updated_at: stat.mtime.toISOString(),
            content,
          },
        });
      }

      const downloadFileMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/download-file$/);
      if (req.method === 'GET' && downloadFileMatch) {
        const task = app.taskStore.get(downloadFileMatch[1]);
        if (!task) return notFound(res);
        const relativePath = url.searchParams.get('path') || '';
        const resolved = safeResolveTaskFile(task.task_id, relativePath);
        if (!resolved || !fs.existsSync(resolved)) return notFound(res);
        return sendDownload(res, resolved, path.basename(resolved));
      }

      const downloadBundleMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/download-bundle$/);
      if (req.method === 'GET' && downloadBundleMatch) {
        const task = app.taskStore.get(downloadBundleMatch[1]);
        if (!task) return notFound(res);
        const resolved = safeResolveTaskFile(task.task_id, 'bundle/bundle.md');
        if (!resolved || !fs.existsSync(resolved)) return notFound(res);
        return sendDownload(res, resolved, `${task.task_id}-bundle.md`);
      }

      const downloadBundleZipMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/download-bundle-zip$/);
      if (req.method === 'GET' && downloadBundleZipMatch) {
        const task = app.taskStore.get(downloadBundleZipMatch[1]);
        if (!task) return notFound(res);
        const resolved = safeResolveTaskFile(task.task_id, 'bundle/bundle.zip');
        if (!resolved || !fs.existsSync(resolved)) return notFound(res);
        return sendDownload(res, resolved, `${task.task_id}-bundle.zip`);
      }

      const downloadSkillPackMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/download-skill-pack$/);
      if (req.method === 'GET' && downloadSkillPackMatch) {
        const task = app.taskStore.get(downloadSkillPackMatch[1]);
        if (!task) return notFound(res);
        const files = getTaskFiles(task);
        const skillPack = app.packageService.summarizeSkillPack(task, files);
        const relativePath = skillPack.entrypoints?.archive;
        const resolved = relativePath ? safeResolveTaskFile(task.task_id, relativePath) : null;
        if (!resolved || !fs.existsSync(resolved)) return notFound(res);
        return sendDownload(res, resolved, path.basename(relativePath));
      }

      const approveMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/approve$/);
      if (req.method === 'POST' && approveMatch) {
        if (!requireCapability(res, app, 'taskControl')) return;
        const task = await app.orchestrator.approve(approveMatch[1]);
        return sendJson(res, 200, { task });
      }

      const retryMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/retry$/);
      if (req.method === 'POST' && retryMatch) {
        if (!requireCapability(res, app, 'taskControl')) return;
        const task = await app.orchestrator.retry(retryMatch[1]);
        return sendJson(res, 200, { task });
      }

      const runSubtasksMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/run-subtasks$/);
      if (req.method === 'POST' && runSubtasksMatch) {
        if (!requireCapability(res, app, 'taskControl')) return;
        const results = await app.orchestrator.runSubtasks(runSubtasksMatch[1]);
        const task = app.taskStore.get(runSubtasksMatch[1]);
        return sendJson(res, 200, { task, results });
      }

      if (req.method === 'GET' && pathname === '/api/memory') {
        const query = url.searchParams.get('q') || '';
        const result = app.orchestrator.memoryService?.search?.(query) || { records: [] };
        return sendJson(res, 200, result);
      }

      if (req.method === 'GET' && pathname === '/api/background/runs') {
        return sendJson(res, 200, { runs: app.backgroundRunStore.list() });
      }

      if (req.method === 'POST' && pathname === '/api/background/run') {
        if (!requireCapability(res, app, 'backgroundRun')) return;
        const run = app.backgroundWorker.runConsolidation();
        return sendJson(res, 201, { run });
      }

      const reviewCapsuleMatch = pathname.match(/^\/api\/evolution\/capsules\/([^/]+)\/review$/);
      if (req.method === 'POST' && reviewCapsuleMatch) {
        if (!requireCapability(res, app, 'evolutionAdmin')) return;
        const body = await readBody(req);
        const reviewed = app.evolutionService.reviewCapsule(reviewCapsuleMatch[1], body || {});
        return sendJson(res, 200, reviewed);
      }

      return notFound(res);
    } catch (error) {
      return sendJson(res, 500, { error: error.message, stack: error.stack });
    }
  });
}
