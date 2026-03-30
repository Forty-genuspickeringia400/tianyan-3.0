# 天衍3.0 / 项目资料总目录

**版本：0.1.0**

这是天衍3.0当前资料与入口的总导航。

---

## 1. 推荐阅读顺序

### 第一次看天衍3.0
1. `README.md`
2. `ARCHITECTURE.md`
3. `docs/soul-evolution-architecture.md`
4. `RELEASE-NOTE-0.1.0.md`

### 要看正式候选判断
1. `README.md`
2. `ARCHITECTURE.md`
3. `RELEASE-NOTE-0.1.0.md`

### 要看灵性 / 三魂七魄 / 自我进化
1. `docs/soul-evolution-architecture.md`
2. `docs/defense-matrix.md`
3. `ARCHITECTURE.md`

---

## 2. 核心资料文件

### 项目说明
- `README.md`
  - 项目总说明
  - 七层 / 四模式
  - 灵性 / 三魂七魄
  - 自我进化治理链
  - 启动方式
  - API

### 架构说明
- `ARCHITECTURE.md`
  - 七层架构拆解
  - L0.5 灵性/觉醒子系统
  - 三魂工程映射
  - 七魄防御矩阵
  - 自我进化链路

### 灵性 / 自我进化补充
- `docs/soul-evolution-architecture.md`
  - 灵性/觉醒职责
  - 三魂映射
  - capsule / review / apply / rollback 设计

### 七魄防御矩阵补充
- `docs/defense-matrix.md`
  - 七魄与工程能力映射
  - defense matrix 输出解释
  - 受控边界

### 正式封板候选说明
- `RELEASE-NOTE-0.1.0.md`
  - 当前候选结论
  - 完成度判断
  - 为什么达到候选标准
  - 剩余边界

### 对外发布版说明
- `PUBLIC-RELEASE-0.1.0.md`
  - 更短版介绍
  - 更适合发给别人看

---

## 3. 核心目录

### 前端
- `public/index.html`
  - 首页汇报页 + 统一工作台
  - 已包含灵性/三魂七魄/自我进化视图

### 后端入口
- `src/server.js`
- `src/bootstrap/create-app.js`
- `src/http/create-server.js`

### 首页汇报层
- `src/dashboard/`
- `src/meta/project-status.js`

### 新增正式模块
- `src/soul/` —— 灵性/觉醒 + 三魂
- `src/defense/` —— 七魄防御矩阵
- `src/evolution/` —— 自我进化治理
- `src/stores/evolution-capsule-store.js`
- `src/stores/evolution-record-store.js`

### 七层相关
- `src/meta/` —— L0
- `src/agents/` —— L1
- `src/core/` + `src/services/` —— L2/L3/L4 主体
- `src/evolution/` —— L5
- `src/federation/` —— L6

### 测试
- `tests/orchestrator.test.js`
- `tests/smoke.mjs`

---

## 4. 快速启动

```bash
cd C:\Users\Administrator\.openclaw\workspace\agentx-3.0
npm start
```

默认地址：
- `http://localhost:4330`

测试：

```bash
npm test
npm run smoke
```

---

## 5. 最常用 API

### 汇报 / 结构 / 正式模块
- `GET /api/health`
- `GET /api/dashboard`
- `GET /api/catalog`
- `GET /api/architecture`
- `GET /api/soul`
- `GET /api/defense`
- `GET /api/evolution`
- `GET /api/federation`

### 任务 / 生命周期 / 工作台
- `POST /api/tasks`
- `GET /api/tasks/:taskId`
- `GET /api/tasks/:taskId/events`
- `GET /api/tasks/:taskId/observability`
- `GET /api/tasks/:taskId/lifecycle`
- `GET /api/tasks/:taskId/workbench`

### 自我进化治理
- `POST /api/evolution/capsules/:capsuleId/review`

### 交付 / 安装
- `GET /api/tasks/:taskId/package`
- `GET /api/tasks/:taskId/explorer`
- `GET /api/tasks/:taskId/skill-pack`
- `GET /api/tasks/:taskId/skill-installation`
- `POST /api/tasks/:taskId/install-skill-pack`

---

## 6. 当前版本状态

- 当前版本：`0.1.0`
- 当前建议完成度：`97%`
- 当前阶段判断：`终极版封板候选`

---

## 7. 一句话总览

**天衍3.0 现在已经把《人体智能体协作模式 v6.0》推进成七层可运行、灵性/三魂七魄正式模块化、带受控自我进化治理链的系统版候选实现。**

