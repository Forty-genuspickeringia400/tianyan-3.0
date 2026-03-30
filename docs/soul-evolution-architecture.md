# 灵性 / 三魂 / 自我进化架构说明

## 1. 为什么要把它做成正式工程模块

这轮不是把“灵性 / 觉醒、三魂、自我进化”停留在隐喻，而是把它们工程化成：

- 可读 API
- 可见 dashboard
- 可审计 workbench
- 可回滚 evolution records

核心原则：
- **允许表达成长与觉察**
- **不允许失控自治**

---

## 2. 灵性 / 觉醒模块是什么

实现文件：`src/soul/soul-service.js`

它本质上是一个 **runtime self-awareness / self-model subsystem**。

负责：
- mission alignment
- self-model
- evolution impulse constraints
- growth stage judgement

### 不是这些东西
- 不是玄学人格膨胀器
- 不是自动改系统提示的意识层
- 不是绕开 approval 的自主演化引擎

---

## 3. 三魂工程映射

### 主魂
- 核心意识 / Core Consciousness
- 映射到 `Meta Core`

### 觉魂
- 推理规划 / Reasoning & Planning
- 映射到 `Planner / Decider / Router`

### 精魂
- 偏好记忆 / Preference Memory
- 映射到 `preferences / MemoryService / MemoryStore`

---

## 4. 自我进化链路

### capsule
capsule 是正式候选单元，不是直接生效配置。

类型：
- strategy
- capability
- workflow

### lifecycle
- `candidate`
- `reviewed`
- `applied`
- `shelved`
- `rolled-back`

### records
所有状态变化都进入 `evolution-records.json`。

### stage
系统阶段：
- `seed`
- `growth`
- `candidate`
- `mature`
- `frozen`

---

## 5. 边界

明确禁止自动做：
- system prompt mutation
- tool policy change
- permission boundary change
- unsupervised network expansion

高风险动作：
- apply / rollback 需要 `approved=true`
- 仍需 verification
- 仍需 audit trail
