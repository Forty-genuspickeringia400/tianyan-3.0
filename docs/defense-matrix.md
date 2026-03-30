# 七魄防御矩阵说明

实现文件：`src/defense/defense-matrix-service.js`

## 七魄与工程能力映射

1. **尸狗**
   - Risk Gate / Guardrail
   - 对应 `GuardrailService`

2. **伏矢**
   - Verification Seal
   - 对应 `VerifierAgent`

3. **雀阴**
   - Cleaner / Purge Lane
   - 对应 `CleanerService`

4. **吞贼**
   - Archive Memory
   - 对应 `MemoryService / MemoryStore`

5. **非毒**
   - Observability Sentinel
   - 对应 `EventStore / ArchitectureService`

6. **除秽**
   - Boundary Isolation
   - 对应 `FederatedMemoryBoundary`

7. **臭肺**
   - Recovery / Fault Tolerance
   - 对应 retry / approval / rollback lifecycle

## 设计目标

- 把“七魄”工程化为结构化 defense matrix
- 对外输出可审计状态，而不是抽象口号
- 与 guardrail / verifier / cleaner / boundary / observability / recovery 建立真实连接
- 与网络安全配置层联动，把入口、出口、边界、审计接进同一个工程防御矩阵

## 与网络安全配置层的联动

- **尸狗**：联动出口审批层
- **非毒**：联动网络姿态留痕
- **除秽**：联动入口收敛与边界隔离
- **臭肺**：联动审计回滚层

## 当前边界

- defense matrix 是可观察层，不是自动武断决策层
- 不会跳过审批
- 不会替代 verification
- 不会绕过 task-scoped boundary
- 不会自动开放公网入口
