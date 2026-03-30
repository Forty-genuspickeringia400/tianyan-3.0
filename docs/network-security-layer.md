# 网络安全配置层说明

实现文件：`src/security/network-security-service.js`

## 目标

把“网络安全”从一句边界提示，升级成首页 / API / 工作台都能直接看到的正式配置层。

## 五层结构

1. **入口绑定层**
   - 默认 `127.0.0.1`
   - 先收住控制台暴露面
   - 如需局域网 / 自定义绑定，必须显式开启

2. **联邦边界层**
   - L6 仍限定为 `local-runtime`
   - 只共享 task-scoped slices
   - 不直接暴露 workspace 根与外部 secrets

3. **出口审批层**
   - `deploy / publish / webhook / remote / ssh / public` 等动作先过 approval gate
   - 不把跨网动作默认视为低风险

4. **密钥封装层**
   - secrets 默认留在 env / runtime / config 边界内
   - 不进入 bundle / skill-pack / 安装回执 / 审计导出

5. **审计回滚层**
   - events / installs / evolution records 形成统一追踪面
   - 网络相关动作也必须可追踪、可解释、可回滚

## API

- `GET /api/network-security`
- `GET /api/dashboard`
- `GET /api/architecture`
- `GET /api/tasks/:taskId/workbench`

## 与七魄工程防御矩阵的关系

网络安全配置层不是替代七魄，而是为七魄提供更明确的入口面 / 出口面 / 审计面：

- **尸狗** 联动出口审批
- **非毒** 联动网络姿态留痕
- **除秽** 联动入口收敛与边界隔离
- **臭肺** 联动审计回滚

## 当前边界

- 仍是本地 runtime 的安全配置层，不是完整的分布式零信任平台
- 不自动开放公网入口
- 不自动绕过审批
- 不自动下放 secrets 到交付物
