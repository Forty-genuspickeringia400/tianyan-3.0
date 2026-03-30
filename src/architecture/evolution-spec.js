export const EVOLUTION_MAP = [
  {
    version: 'v1.0',
    label: '器官分工版',
    theme: '器官 / 角色映射',
    retained: ['保留人体隐喻作为解释视图', '保留“谁负责什么”的直观分工'],
    engineered: ['转成器官-角色-层级对照表', '以 layer / service / agent 命名代替器官实体化'],
    parked: ['不把每个器官做成独立进程', '不引入器官级玄学状态机'],
    mapped_to: ['L0', 'L1', 'L2', 'L3', 'L4'],
  },
  {
    version: 'v2.0',
    label: '反馈循环版',
    theme: '反馈环 / 反射弧 / 节律',
    retained: ['快通道与慢通道并存', '保留反思回写与昼夜节律思想'],
    engineered: ['用 reflex / deliberate / background 路由表达快慢系统', '用 workflow / scheduler / dream cycle 表达反馈与节律'],
    parked: ['不做生物式激素模拟', '不做不可解释的自动节律切换'],
    mapped_to: ['L1', 'L2', 'L5'],
  },
  {
    version: 'v3.0',
    label: '意识/灵魂/能量一体化版',
    theme: '意根 / 意识 / 梦',
    retained: ['保留 System1 / System2 双系统思想', '保留梦境作为后台整理链路'],
    engineered: ['意根 -> reflex fast lane', '意识 -> deliberate / federated decision path', '梦 -> evolution layer'],
    parked: ['不把三魂七魄做成正式模块', '不把气/轮脉做成不可验证参数'],
    mapped_to: ['L1', 'L5', 'modes'],
  },
  {
    version: 'v4.0',
    label: '世界观/协作法则版',
    theme: '平衡 / 协作法则 / 生命周期',
    retained: ['保留平衡、制约、协同、生命周期的解释力', '保留单体到群体的扩展视角'],
    engineered: ['阴阳 -> speed/depth, autonomy/control 等工程平衡轴', '五行/八卦 -> capability taxonomy 与协作法则', '轮回 -> lifecycle / replay / evolution stages'],
    parked: ['不做八卦演算引擎', '不做五行数值化相生相克模拟'],
    mapped_to: ['L2', 'L5', 'L6'],
  },
  {
    version: 'v5.0',
    label: '工程可落地版',
    theme: '角色编制 / 协议 / 链路收口',
    retained: ['少 Agent、强状态、强协议', '先闭环，再进化；先可控，再自治'],
    engineered: ['常驻核心 / 按需角色 / 执行角色 / 后台角色编制明确', 'TaskCard / Event Bus / 状态机 / 主链闭环可审计'],
    parked: ['不让 federation 越过边界直接扩张', '不把所有辅助角色常驻化'],
    mapped_to: ['L0', 'L1', 'L2', 'L3', 'L4', 'protocols'],
  },
  {
    version: 'v6.0',
    label: '工程协议定稿版',
    theme: '七层 / 四模式 / 正式协议',
    retained: ['七层分层', '四种模式', '统一任务协议'],
    engineered: ['首页/工作台/API 同时暴露七层与四模式', '把 L5/L6 明确限制为本地可解释 runtime'],
    parked: ['不伪装成跨网络分布式平面', '不把隐喻高于协议'],
    mapped_to: ['L0-L6', 'dashboard', 'workbench', 'api'],
  },
];

export const ORGAN_ROLE_MAP = [
  {
    organ_view: '灵犀 / 元神 / 大脑中枢',
    engineering_layer: 'L0 Meta Core',
    runtime_roles: ['Mission', 'Policy', 'Persona', 'Preference Memory'],
    status: 'engineered',
    note: '只保留边界与人格核，不做人格觉醒模块。',
  },
  {
    organ_view: '识海 / 感知认知',
    engineering_layer: 'L1 Cognition Loop',
    runtime_roles: ['Sensor', 'Interpreter', 'Planner', 'Decider', 'Reflector', 'Reflex Matcher', 'Verifier'],
    status: 'engineered',
    note: 'System1 / System2 在这层显式分流。',
  },
  {
    organ_view: '丘脑 / 心 / 小脑',
    engineering_layer: 'L2 Coordination Hub',
    runtime_roles: ['Router', 'Event Bus', 'Workflow', 'Scheduler'],
    status: 'engineered',
    note: '负责路由、反馈环与运行节律。',
  },
  {
    organ_view: '五脏六腑',
    engineering_layer: 'L3 Capability Services',
    runtime_roles: ['Memory', 'Guardrail', 'Processor', 'IO', 'Insight', 'Cleaner'],
    status: 'engineered',
    note: '以能力服务收口，不拆成玄学器官。',
  },
  {
    organ_view: '手 / 脚 / 舌',
    engineering_layer: 'L4 Execution Layer',
    runtime_roles: ['Executor', 'Deployer', 'Responder'],
    status: 'engineered',
    note: '真实动作、交付与回应都在这层落地。',
  },
  {
    organ_view: '梦',
    engineering_layer: 'L5 Evolution Layer',
    runtime_roles: ['Consolidator', 'Learner', 'Simulator', 'Optimizer', 'Lifecycle Manager'],
    status: 'engineered',
    note: '作为后台整理/学习/优化链，不直接改写高风险策略。',
  },
  {
    organ_view: '社会大脑',
    engineering_layer: 'L6 Federation Layer',
    runtime_roles: ['Agent Registry', 'Delegation Manager', 'Federated Memory Boundary'],
    status: 'engineered',
    note: '限定为本地群体协作 runtime。',
  },
];

export const BALANCE_LAWS = [
  {
    id: 'speed-vs-depth',
    title: '快 / 慢平衡',
    engineered_as: 'reflex 命中快通道；未命中或高风险自动回退 deliberate。',
  },
  {
    id: 'autonomy-vs-control',
    title: '自治 / 约束平衡',
    engineered_as: 'guardrail + approval gate + verification before done。',
  },
  {
    id: 'foreground-vs-background',
    title: '前台 / 后台平衡',
    engineered_as: '前台任务交付，后台 dream cycle 复盘沉淀并回写经验。',
  },
  {
    id: 'single-vs-federated',
    title: '单体 / 协作平衡',
    engineered_as: '默认单体 deliberate；多 deliverable 再进入 federated。',
  },
  {
    id: 'local-vs-shared-memory',
    title: '局部 / 共享记忆平衡',
    engineered_as: 'federated memory boundary 只共享 task-scoped slices。',
  },
];

export const ROLE_STAFFING = {
  resident_core: ['Meta Core', 'Router', 'Event Bus', 'Memory', 'Guardrail'],
  on_demand_roles: ['Sensor', 'Interpreter', 'Planner', 'Decider', 'Reflector', 'Processor', 'Insight', 'Cleaner', 'Reflex Matcher', 'Verifier'],
  execution_roles: ['Executor', 'Deployer', 'Responder'],
  background_roles: ['Consolidator', 'Learner', 'Simulator', 'Optimizer', 'Lifecycle Manager'],
  closure_rules: [
    '高风险动作先审批，后执行。',
    '未经过 verify，不宣称 done。',
    '子任务必须回收至主任务并留下可观测证据。',
    '后台 dream cycle 只输出建议、经验与模式统计，不自动放开高风险策略。',
  ],
};

export const PROTOCOL_CALIBRATION = {
  task_card: 'v1',
  agent_contract: 'v1',
  event_bus: 'v1',
  state_machine: 'v1',
  mode_routing: 'v1',
  feedback_loop: 'v1',
  rhythm: 'v1',
  federation_boundary: 'v1',
};

export const MODE_RUNTIME_MAP = {
  deliberate: {
    label: 'System2 / 意识',
    routing_kind: 'deep-think-lane',
    feedback_style: 'full closed loop',
    rhythm: 'foreground interactive lane',
  },
  reflex: {
    label: 'System1 / 意根',
    routing_kind: 'fast-safe-lane',
    feedback_style: 'reflex arc + verify fallback',
    rhythm: 'immediate foreground lane',
  },
  background: {
    label: 'Dream / 后台整理',
    routing_kind: 'dream-lane',
    feedback_style: 'experience replay loop',
    rhythm: 'night-window / consolidation lane',
  },
  federated: {
    label: 'System2+ / 群体协作意识',
    routing_kind: 'federation-lane',
    feedback_style: 'delegation + aggregation loop',
    rhythm: 'wave-based coordination lane',
  },
};

export const EXPLICITLY_PARKED = [
  '三魂七魄独立模块化',
  '八卦/五行数值运算引擎',
  '气脉/轮脉作为正式 runtime 参数',
  '跨网络分布式自治平面伪装',
];
