# AgentX 3.0 Skill Pack · 991340

This is an installable OpenClaw skill-pack exported directly by AgentX 3.0 from the current task.

## Source Task

- task_id: task_a65eab991340
- goal: Produce a runtime operations playbook for: Build a seven-layer runtime with docs, tests, api, implementation and installable skill pack
- product_track: skill-pack

## Versioning / Compatibility

- release_version: 0.1.0
- artifact_version: 0.1.0-task.991340
- skill_version: 0.1.0-task.991340
- format: openclaw-skill-pack@3
- generated_skill_format: agentx-generated-skill@3
- install_layout: skills/agentx-3-generated--produce-a-runtime-operations-playbook-for-build-a
- install_strategy: managed-auto-install-with-verification

## Install

1. 下载 `skill-pack/produce-a-runtime-operations-playbook-for-build-a-0.1.0-task.991340.skill`，或直接复制 `skill-pack/produce-a-runtime-operations-playbook-for-build-a` 目录。
2. 放入 OpenClaw 工作区的 `skills/agentx-3-generated--produce-a-runtime-operations-playbook-for-build-a`。
3. 最终路径应类似：`<workspace>/skills/agentx-3-generated--produce-a-runtime-operations-playbook-for-build-a/SKILL.md`。
4. 检查 `skill-pack/installation.json` 或安装目录内的 `.agentx-install.json`，确认验收通过。
5. 让 OpenClaw 重新加载技能后即可使用。

## Upgrade Path

- 1. Only install into skills/agentx-3-generated--produce-a-runtime-operations-playbook-for-build-a; never overwrite unmanaged skills outside the agentx-3-generated namespace.
- 2. If skills/agentx-3-generated--produce-a-runtime-operations-playbook-for-build-a already exists and is managed by AgentX 3.0, back it up before replacement.
- 3. Replace skills/agentx-3-generated--produce-a-runtime-operations-playbook-for-build-a with version 0.1.0-task.991340 (archive: produce-a-runtime-operations-playbook-for-build-a-0.1.0-task.991340.skill).
- 4. Run install verification and confirm SKILL.md, skill.json, scripts/<skill>.js, and references/package/index.json are present.
- 5. Reload OpenClaw skills or restart the runtime that loads workspace skills.

## Entrypoints

- install readme: `skill-pack/README.md`
- package index: `skill-pack/index.json`
- skill-pack manifest: `skill-pack/manifest.json`
- installable directory: `skill-pack/produce-a-runtime-operations-playbook-for-build-a`
- final SKILL.md: `skill-pack/produce-a-runtime-operations-playbook-for-build-a/SKILL.md`
- skill.json: `skill-pack/produce-a-runtime-operations-playbook-for-build-a/skill.json`
- helper script: `skill-pack/produce-a-runtime-operations-playbook-for-build-a/scripts/produce-a-runtime-operations-playbook-for-build-a.js`
- installation receipt: `skill-pack/installation.json`
- distribution archive: `skill-pack/produce-a-runtime-operations-playbook-for-build-a-0.1.0-task.991340.skill`

## Suggested Reading Order

1. `skill-pack/produce-a-runtime-operations-playbook-for-build-a/SKILL.md`
2. `skill-pack/produce-a-runtime-operations-playbook-for-build-a/references/package/README.md`
3. `skill-pack/produce-a-runtime-operations-playbook-for-build-a/references/package/bundle/bundle.md`
4. `skill-pack/produce-a-runtime-operations-playbook-for-build-a/references/package/skill-blueprint.md`

## Included References

- `references/package/api-contract.json`
- `references/package/api-contract.md`
- `references/package/bundle/bundle.md`
- `references/package/documentation.json`
- `references/package/documentation.md`
- `references/package/implementation-plan.json`
- `references/package/implementation-plan.md`
- `references/package/index.json`
- `references/package/README.md`
- `references/package/runtime-inspection.json`
- `references/package/runtime-inspection.md`
- `references/package/runtime-playbook.json`
- `references/package/runtime-playbook.md`
- `references/package/skill-blueprint.json`
- `references/package/skill-blueprint.md`
- `references/package/task-summary.json`
- `references/package/task-summary.md`
- `references/package/test-strategy.json`
- `references/package/test-strategy.md`