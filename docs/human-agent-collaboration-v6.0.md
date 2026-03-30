# 人体智能体协作模式 v6.0 - 产品/架构文档

## 1. 文档定位

本文档定义一套基于“人体隐喻”的多智能体协作模式，用于指导 AI Agent 系统的产品设计、架构设计与后续工程实现。

这套模式的目标不是做一个“更会说话的 AI”，而是构建一个：

- 能理解目标
- 能拆解任务
- 能调用能力
- 能执行动作
- 能复盘学习
- 能逐步演进为多智能体协作网络的人体式智能协作系统

## 2. 为什么用“人体隐喻”

传统多智能体系统常见两个问题：
1. 结构太工程化，不利于团队快速理解
2. 角色很多，但职责边界不清

人体隐喻的价值：
- 更容易理解复杂协作关系
- 天然适合表达“感知—认知—协调—执行—反馈”的闭环
- 适合描述中心控制、局部自治、后台学习、故障容错等机制

人体隐喻只负责帮助理解，不直接决定工程实现。最终工程系统仍以模块边界、状态协议、任务协议、事件协议为准。

## 3. 设计目标

### 3.1 让 AI 不只是“回答”，而是“做事”
系统不仅生成文本，还能：
- 检索记忆
- 规划任务
- 调用工具
- 执行外部动作
- 返回结果与证据

### 3.2 让复杂任务可拆、可协作、可追踪
复杂任务不应被一次性塞给单一模型，而应：
- 拆成任务卡
- 按角色流转
- 在关键节点校验
- 能看到状态变化

### 3.3 让系统既能快，也能深
- 简单任务走快速通路
- 复杂任务走深度决策通路
- 空闲时进入整理与学习通路

### 3.4 让系统可进化，但不失控
- 可审计
- 可关闭
- 可回滚
- 不突破边界

## 4. 核心设计原则

- 人体隐喻保留，工程命名清晰
- 不是一个器官一个进程
- 先闭环，再进化
- 先可控，再自治
- 任务协议优先于模型能力

## 5. 总体架构概览

系统最终分为 7 层：
1. L0 元意识核（Meta Core）
2. L1 认知环（Cognition Loop）
3. L2 协调中枢（Coordination Hub）
4. L3 能力服务层（Capability Services）
5. L4 执行层（Execution Layer）
6. L5 后台演化层（Evolution Layer）
7. L6 群体协作层（Federation Layer，可后置）

## 6. 分层说明

### 6.1 L0 元意识核 Meta Core（灵犀）
包含 4 个模块：
- Mission
- Policy
- Persona
- Preference Memory

### 6.2 L1 认知环 Cognition Loop（识海）
包含 6 个核心角色：
- Sensor
- Interpreter
- Planner
- Decider
- Reflector
- Reflex Matcher

### 6.3 L2 协调中枢 Coordination Hub（丘脑/心/小脑）
包含 4 个固定模块：
- Router
- Message Bus
- Workflow
- Scheduler

### 6.4 L3 能力服务层 Capability Services（五脏六腑）
包含 6 个服务模块：
- Memory
- Guardrail
- Processor
- IO
- Insight
- Cleaner

### 6.5 L4 执行层 Execution Layer（手/脚/舌）
执行器：
- Executor（手）
- Deployer（脚）
- Responder（舌）

### 6.6 L5 后台演化层 Evolution Layer（梦）
模块：
- Consolidator
- Learner
- Simulator
- Optimizer
- Lifecycle Manager

### 6.7 L6 群体协作层 Federation Layer（社会大脑）
后期扩展层：
- Agent Registry
- Delegation Manager
- Federated Memory Boundary

## 7. 四种核心运行模式

### 7.1 深思模式
输入 → 感知 → 理解 → 记忆检索 → 规划 → 决策 → 路由 → 能力加工 → 执行 → 校验 → 输出 → 复盘 → 写回经验

### 7.2 反射模式
输入 → Reflex Matcher → Workflow → Executor → Responder

必须满足：
- 命中模板
- 风险低
- 历史成功率高
- 无高危写操作

### 7.3 后台梦境模式
日志/事件 → Consolidator → Learner → Simulator → Optimizer

### 7.4 群体协作模式
Meta Core 设总目标 → Delegation Manager 拆单 → 多 Agent 并行处理 → Router/Bus 汇总 → Decider 合并判断 → Responder 输出

## 8. 工程协议要求

### 8.1 TaskCard：统一任务卡
最少字段：
- task_id
- parent_task_id
- goal
- input
- context
- constraints
- risk_level
- priority
- mode
- owner
- status
- plan
- result
- evidence
- next_action
- created_at
- updated_at

### 8.2 Agent Contract：统一角色契约
输入：
- task_card
- context_slice
- memory_slice
- policy_slice

输出：
- task_patch
- events[]
- evidence[]
- decision
- next_action

### 8.3 Event Bus：统一事件总线
至少需要这些事件：
- input.received
- intent.resolved
- memory.hit
- plan.generated
- decision.made
- task.routed
- tool.called
- tool.finished
- risk.flagged
- verification.passed
- verification.failed
- response.ready
- task.closed
- learning.extracted
- agent.spawned
- agent.completed

### 8.4 状态机：统一任务生命周期
主状态：
new → understood → planned → approved → executing → verifying → responding → closed

异常分支：
- blocked
- retrying
- escalated
- failed

关键规则：
- 未进入 approved，不能执行高风险动作
- 未进入 verifying，不能直接宣称完成
- 进入 failed 后必须有 next_action

## 9. 角色编制建议

### 9.1 常驻核心
- Meta Core
- Router
- Message Bus
- Memory
- Guardrail

### 9.2 按需拉起角色
- Sensor
- Interpreter
- Planner
- Decider
- Reflector
- Processor
- Insight
- Cleaner

### 9.3 执行角色
- Executor
- Deployer
- Responder

### 9.4 后台角色
- Consolidator
- Learner
- Simulator
- Optimizer
- Lifecycle Manager

## 10. 产品价值
- 更像助理
- 更适合复杂工作流
- 更可观测
- 更容易演进
- 更适合团队协作开发

## 11. 非目标
- 不追求完全人格化觉醒
- 不把八卦、阴阳、三魂七魄做成正式工程模块
- 不一开始就做全独立多进程 Agent 网络
- 不把所有器官都做成实体服务
- 不让后台学习自动改写高风险行为策略

## 12. 推荐演进路线

### 阶段 1：单体编排版
- 一个 Orchestrator
- 一套 TaskCard
- 一条 Event Bus
- 核心状态机
- 少量核心角色

### 阶段 2：半解耦版
- 拆出 Memory、Guardrail、Executor、后台演化模块

### 阶段 3：多角色独立调度版
- 拆出 Planner、Reflector、Insight、Workflow

### 阶段 4：群体协作版
- 增加 Agent Registry、Delegation Manager、Federated Memory Boundary
- 多节点并发执行

## 13. 一句话定义

人体智能体协作模式 v6.0，是一套以 Meta Core 为人格与边界、以 Cognition Loop 为理解与决策、以 Coordination Hub 为协同调度、以 Capability Services 为能力加工、以 Execution Layer 为真实动作、以 Evolution Layer 为后台学习，并最终可扩展到 Federation Layer 的多智能体产品与架构模式。

## 14. 对外介绍短版

我们设计的不是一个单点回答型 AI，而是一套人体式多智能体协作系统。
它像人体一样分为感知、认知、协调、能力、执行和后台学习几个层次：前台负责理解和执行任务，后台负责复盘和优化，后期还能扩展成多个智能体协同工作的群体系统。
人体隐喻帮助理解系统协作方式，真正驱动系统运行的则是统一的任务卡、事件总线和状态机协议。
