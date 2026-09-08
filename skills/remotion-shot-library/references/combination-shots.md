# 组合镜头

1. 用来源文件名、连续时间区间、共享对象和明确的叙事承接识别候选镜头族，但始终用本地稳定序号与用户沟通。
2. 组合来源可以来自一个直接视频中的多个区间，也可以来自多个飞书记录或迁移文件；外部记录不是 family 的身份。
3. 将每个原子镜头定位到来源视频时间区间。定位不可靠且会改变实现时停止并请求证据。
4. 在索引中为每个原子镜头记录 `groupId`、`groupOrder`、`previousSequenceId`、`nextSequenceId` 和 `handoff`。分组关系属于索引，不改变普通镜头的识别、蓝图、动作或 Remotion 规则。
5. 按 `groupOrder` 逐个制作，不并行处理存在依赖的原子镜头。`handoff.mode=carry` 时，先批准前一镜头的结尾状态，再把该状态作为后一镜头的起始约束；`handoff.mode=independent` 时不强造衔接。
6. 每个原子状态生成独立 manifest、组件、预览和复用档案；Eagle 元数据只在用户要求发布时生成。
7. 额外生成 family manifest、镜头族复用档案和组合 Composition，按顺序保存状态继承、持续对象和转场关系。
8. 原子组件不得依赖组合 Composition 才能运行；组合 Composition 通过 props 和序列调用原子组件。组合调用不得破坏原子镜头的单独调用能力。
