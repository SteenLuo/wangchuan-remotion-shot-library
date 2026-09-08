---
name: shot-library-replication
description: Faithfully reconstruct a user-selected reference shot in Remotion using source evidence, measurements, causal motion and actual video review. Use for first-time replication, not certified-template invocation.
---

# 首次保真复刻

## 必读顺序

1. [来源合同](../remotion-shot-library/references/input-contract.md)
2. [感知识别](../remotion-shot-library/references/perceptual-analysis.md)
3. [测量优先](../remotion-shot-library/references/measurement-first.md)
4. [动作分析](../remotion-shot-library/references/motion-analysis.md)
5. 有文字：读取 [文字动效](../remotion-shot-library/references/kinetic-text.md) 和 [表面、文字、文献](../remotion-shot-library/references/surface-text-document.md)
6. 有遮挡、固定件、连线、圈选、投影或空间运镜：读取 [空间动作](../remotion-shot-library/references/spatial-motion-mechanisms.md)
7. 有组合承接：读取 [组合镜头](../remotion-shot-library/references/combination-shots.md)
8. [审核](../remotion-shot-library/references/review-gates.md) 与 [计时](../remotion-shot-library/references/timing-and-network.md)

## 执行合同

1. 确认用户选定的文件和片段，先检查已有编号；新来源使用下一个未占用的 `seq-NNNN`，向用户报告后固定不变。
2. 运行 `node skills/shot-library-replication/scripts/import-source.mjs --file <文件路径>`，建立副本、哈希和探测信息。不得以原文件路径代替不可变副本，不自动写飞书。
3. 记录最小口播语境、主要画面功能、观看顺序与创作者策略假设。观察与推断分开；不默认拆解整条视频。
4. 从头到尾观察指定片段。保存对象图谱、载体与语义、父子层级、遮挡、作用域、出现与消失、证据帧及置信度。
5. 在写 TSX 前完成源片几何账本、稳定状态、动作事件合同和六类运动通道。快速或高风险动作加密采样；未知术语查专业来源并保留链接，不凭标签猜实现。
6. 在用户自己的 Remotion 工程实现参考配置，使用自己记录的坐标与时间。不得把源视频整段铺在背景中冒充复刻，也不得引用此发行不存在的私人成品组件。
7. 输出实际 MP4，校验画幅、fps、帧数、音轨及严格解码。抽取源片与成片相同帧号的画面，完整正常速度播放；PNG still、代码存在或 JSON 通过不能证明视频成立。
8. 按识别、测量、因果、层级、素材、文字、材质、光影、相机或播放色彩链归类偏差，修正后复查受影响区段和全片段播放。记录已知差异，不用“插件未知”掩盖可辨缺陷。
9. 交付可播放成片和关键同帧证据，报告当前编号、文件哈希、技术结果、视觉待审状态、耗时与已知差异，停止在 Gate 1 等待用户明确批准。
10. 如用户希望加入查看页，用 `viewer:register` 登记当前成片。登记是预览入口，不授予审核通过或认证资格。

## 停止与边界

来源缺失、不可解码、编号/哈希冲突、证据不足或动作歧义会改变结果时停下并明确缺口。缺少原字体或插件本身不构成永久阻塞：可采用有证据的感知等效，保留机制并披露差异。

不要改无关已完成镜头，不更新既有批准，不自动进入素材替换、模板认证或外部发布。源素材的使用与公开传播须符合相应权利条件。
