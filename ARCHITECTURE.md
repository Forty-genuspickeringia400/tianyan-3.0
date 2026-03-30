# 天衍3.0 Architecture

## 定位

天衍3.0 不是“给 2.0 加个新页面”，而是按《人体智能体协作模式 v6.0》把系统拆成**七层可运行 runtime + 正式灵性/三魂七魄模块 + 受控自我进化治理链**，并且让这些层在运行期真正可见：

- 首页可汇报
- API 可读
- 任务工作台可审计
- package / skill-pack / install / verify 可交付
- 七魄工程防御矩阵 + 网络安全配置层可见
- evolution capsule / records / rollback 可追踪

---

## 七层架构

### L0 Meta Core
目录：`src/meta/`

职责：
- Mission
- Policy
- Persona
- Preferences
- Project status / release candidate status

当前实现：
- `src/meta/meta-core.js`
- `src/meta/project-status.js`

---

### L0.5 灵性 / 觉醒子系统（新增正式模块）
目录：`src/soul/`

职责：
- 使命一致性检查
- runtime self-awareness / self-model
- 进化冲动来源约束表达
- 成长阶段判断

当前实现：
- `src/soul/soul-service.js`

映射关系：
- 上接 `Meta Core`
- 中接 `Planner / Decider / Router`
- 下接 `EvolutionService`

可见位置：
- `/api/dashboard`
- `/api/soul`
- `/api/tasks/:taskId/workbench`
- 首页“灵性 / 觉醒状态”

---

### L1 Cognition Loop
目录：`src/agents/`

职责：
- Sensor
- Interpreter
- Planner
- Decider
- Reflector
- Reflex Matcher
- Responder
- Verifier

---

### L2 Coordination Hub
目录：`src/core/` + `src/services/`

职责：
- Router
- Event Bus
- Workflow
- Scheduler
- Task Graph / Timeline / Queue

---

### L3 Capability Services
目录：`src/services/`

职责：
- Memory
- Guardrail
- Processor
- IO
- Insight
- Cleaner

---

### L4 Execution Layer
目录：`src/runtime/` + `src/services/`

职责：
- Executor
- Deployer
- Adapter Runtime
- Responder

---

### L5 Evolution Layer
目录：`src/evolution/`

职责：
- Consolidator
- Learner
- Simulator
- Optimizer
- Governance Review
- Lifecycle Manager

当前实现：
- `src/evolution/evolution-service.js`
- `src/stores/evolution-capsule-store.js`
- `src/stores/evolution-record-store.js`
- `src/core/background-worker.js`

新增正式能力：
- candidate capability / strategy capsule
- evolution records / audit trail
- review -> apply / shelve / rollback
- growth / candidate / mature / frozen stage

---

### L6 Federation Layer
目录：`src/federation/`

职责：
- Agent Registry
- Delegation Manager
- Federated Memory Boundary

---

## 三魂工程化映射

### 主魂 / 核心意识
真实映射：
- `metaCore.mission`
- `metaCore.policy`
- `metaCore.persona`

职责：
- 锁定使命与边界
- 定义完成标准
- 决定哪些事不能自动做

### 觉魂 / 推理规划
真实映射：
- `PlannerAgent`
- `DeciderAgent`
- `RouterService`

职责：
- 形成计划
- 选择路线
- 决定进入 deliberate / reflex / background / federated 哪条链

### 精魂 / 偏好记忆
真实映射：
- `metaCore.preferences`
- `MemoryService`
- `MemoryStore`

职责：
- 维持偏好与复用经验
- 把任务反思沉淀成后续可搜索记忆

---

## 七魄防御矩阵
目录：`src/defense/`

实现：`src/defense/defense-matrix-service.js`

### 1. 尸狗
- 工程角色：Risk Gate / Guardrail
- 连接：`GuardrailService` + `metaCore.policy`

### 2. 伏矢
- 工程角色：Verification Seal
- 连接：`VerifierAgent`

### 3. 雀阴
- 工程角色：Cleaner / Purge Lane
- 连接：`CleanerService`

### 4. 吞贼
- 工程角色：Archive Memory
- 连接：`MemoryService` / `MemoryStore`

### 5. 非毒
- 工程角色：Observability Sentinel
- 连接：`EventStore` / `ArchitectureService`

### 6. 除秽
- 工程角色：Boundary Isolation
- 连接：`FederatedMemoryBoundary`

### 7. 臭肺
- 工程角色：Recovery / Fault Tolerance
- 连接：retry / approval / rollback lifecycle

可见位置：
- `/api/defense`
- 首页“七魄工程防御矩阵”
- 任务工作台 observability 视图

---

## 网络安全配置层
目录：`src/security/`

实现：`src/security/network-security-service.js`

职责：
- 入口绑定层（默认 `127.0.0.1`）
- 联邦边界层（`local-runtime`）
- 出口审批层（deploy / publish / webhook / remote 等高风险网络动作）
- 密钥封装层（secrets 不进入交付物）
- 审计回滚层（events / installs / evolution records）

可见位置：
- `/api/network-security`
- `/api/dashboard`
- `/api/architecture`
- `/api/tasks/:taskId/workbench`
- 首页“网络安全配置层”

---

## 自我进化正式链路

### 1. Capsule 孵化
来源：
- 已关闭任务
- 已验证结果
- dream cycle 回放

输出：
- capability capsule
- strategy capsule
- workflow capsule

### 2. 审核链
状态：
- `candidate`
- `reviewed`
- `applied`
- `shelved`
- `rolled-back`

接口：
- `GET /api/evolution`
- `POST /api/evolution/capsules/:capsuleId/review`

### 3. 阶段判断
系统阶段：
- `seed`
- `growth`
- `candidate`
- `mature`
- `frozen`

### 4. 受控边界
明确不会自动做：
- 自动修改系统提示
- 自动修改工具策略
- 自动修改权限边界
- 自动扩大网络自治面

高风险 apply / rollback：
- 需要 `approved=true`
- 需要 verification
- 写入 audit trail

---

## 首页 / 工作台 / API 的关系

### 首页
通过 `DashboardService` 聚合：
- 七层 / 四模式
- 灵性 / 觉醒
- 三魂状态
- 七魄矩阵
- 自我进化阶段
- 最新 capsule / suggestion

### 工作台
`/api/tasks/:taskId/workbench` 现在返回：
- `observability`
- `evolution`
- `soul`
- `defense`
- `evolution_control`
- `package / skill_pack / explorer / files`

### API
新增正式接口：
- `GET /api/soul`
- `GET /api/defense`
- `GET /api/evolution`
- `POST /api/evolution/capsules/:capsuleId/review`

---

## 当前真实边界

- L6 仍是**本地 federation runtime**，不是跨机器分布式平面
- 自我进化仍是**受控治理链**，不是长期失控自治系统
- 灵性/觉醒是 **runtime self-model**，不是玄学人格膨胀模块
- UI 仍是**零依赖单页控制台**

