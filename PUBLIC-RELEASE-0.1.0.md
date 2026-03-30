# 人体智能体协作模式-多智能体架构系统 / 对外发布版说明

**版本：0.1.0**

人体智能体协作模式-多智能体架构系统（原天衍3.0）是一个基于《人体智能体协作模式 v6.0》构建的七层多智能体系统原型。

它的目标不是只回答问题，而是把任务放进一个真正可运行、可观测、可协作、可交付的本地 runtime：

- 七层协作结构
- 四种运行模式
- 可审计的 task lifecycle
- package / bundle / skill-pack 交付链
- auto install / verify 主链
- 首页可直接汇报整体状态

---

## 它现在能做什么

### 1. 用七层架构组织系统运行
当前已落地：
- Meta Core
- Cognition Loop
- Coordination Hub
- Capability Services
- Execution Layer
- Evolution Layer
- Federation Layer

### 2. 支持四种运行模式
- 深思模式（deliberate）
- 反射模式（reflex）
- 后台梦境模式（background）
- 群体协作模式（federated）

### 3. 首页就是汇报页
当前首页已经可以直接展示：
- 当前项目状态
- 是否达到封板候选
- 七层状态
- 四模式状态
- 质量闸门
- 最近任务 / dream runs
- 推荐下一步

### 4. 交付主链持续可用
当前版本仍保留并重组了成熟的交付链：
- bundle
- package
- skill-pack
- auto install
- verify

---

## 当前版本亮点
- 按《人体智能体协作模式 v6.0》真实落地
- 更像系统，不只是项目说明书
- 已具备 HTTP server、控制台、工作台和验证链
- 已适合作为公开原型、架构展示和后续迭代基线

---

## 当前状态
**已达到“终极版封板候选”。**

当前建议完成度：**约 97%**

---

## 启动方式
```bash
npm install
npm start
```

默认地址：
```txt
http://localhost:4330
```

测试：
```bash
npm test
npm run smoke
```

---

## 一句话总结
**人体智能体协作模式-多智能体架构系统，已经把《人体智能体协作模式 v6.0》推进成一个七层可运行、可汇报、可交付的系统版候选实现。**
