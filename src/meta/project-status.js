export const projectStatus = {
  stage: 'ultimate-release-candidate',
  stage_label: '终极版封板候选',
  candidate_ready: true,
  scope: 'single-runtime / local-federation / controlled-evolution / productized workbench',
  summary: '天衍3.0 当前目标不是假装分布式，而是把 v6.0 七层架构、灵性/觉醒、三魂七魄、自我进化治理链、任务生命周期、证据链、package/skill-pack/install/verify 主链，收成一个更真实可用、可观测、可汇报的本地 runtime。',
  release_focus: [
    '灵性/觉醒已成为正式工程子系统：负责使命一致性、self-model、进化冲动约束与成长阶段判断。',
    '三魂已工程化映射到 Meta Core / Planner-Decider / Preference Memory，不再只是注释隐喻。',
    '七魄已升级为工程防御矩阵，真实连接 Guardrail / Verifier / Cleaner / Boundary / Observability / Archive / Recovery / Network Security。',
    '网络安全配置层已形成入口绑定 / 联邦边界 / 出口审批 / 密钥封装 / 审计回滚五层结构，并在首页/API/工作台可见。',
    '自我进化已形成 capsule -> review -> apply/shelve/rollback -> audit trail 的正式链路，并在首页/API/工作台可见。',
  ],
  quality_gates: [
    {
      id: 'home-report',
      title: '首页可汇报',
      passed: true,
      detail: '首页直接展示候选结论、质量闸门、七层、四种模式、灵性/三魂七魄、自我进化与下一步。',
    },
    {
      id: 'seven-layers',
      title: '七层架构可见',
      passed: true,
      detail: 'L0-L6 在 API / UI / observability 中都有状态与说明。',
    },
    {
      id: 'soul-system',
      title: '灵性 / 三魂正式模块化',
      passed: true,
      detail: '灵性/觉醒与三魂状态可在 dashboard / workbench / API 中查看。',
    },
    {
      id: 'defense-matrix',
      title: '七魄工程防御矩阵正式可见',
      passed: true,
      detail: '七魄矩阵返回结构化 defense status，并连接 guardrail / verify / boundary / cleanup / archive / recovery / network security。',
    },
    {
      id: 'network-security-layer',
      title: '网络安全配置层正式可见',
      passed: true,
      detail: '入口绑定 / 联邦边界 / 出口审批 / 密钥封装 / 审计回滚五层结构已在首页、API、工作台贯通。',
    },
    {
      id: 'evolution-governance',
      title: '自我进化链可审计',
      passed: true,
      detail: 'capsule / records / review / apply / shelve / rollback / stage 都有结构化输出与 audit trail。',
    },
    {
      id: 'task-lifecycle',
      title: '任务生命周期与证据链可审计',
      passed: true,
      detail: '支持 lifecycle / events / evidence / graph / timeline / workbench 聚合视图。',
    },
    {
      id: 'package-main-chain',
      title: 'package / skill-pack / install / verify 主链可交付',
      passed: true,
      detail: 'bundle.zip、.skill、自动安装与验收回执保持可用。',
    },
  ],
  boundaries: [
    'L6 仍是本地 federation runtime，不是跨机器/跨网络的真实分布式执行平面。',
    '自我进化只允许经验沉淀、候选策略、受控启用/回滚，不会自动修改系统提示、工具策略或权限边界。',
    '高风险 evolution apply / rollback 仍要求 approval，且所有状态变化写入 audit trail。',
    '默认 bind host 为 127.0.0.1；若要扩大到局域网/自定义入口，必须显式改配置并配额外边界。',
    'UI 仍是零依赖单页控制台，不是拆分式前端工程。',
  ],
  validation: {
    commands: ['npm test', 'npm run smoke'],
    status: 'passed',
    last_verified_at: '2026-03-15T18:23:00.000+08:00',
    notes: '已完成本地 npm test 与 npm run smoke 验收，并覆盖 soul / defense / evolution 结构化输出。',
  },
};

