---
name: remotion-shot-library
description: WangChuan public shot-library controller. Route user-selected reference videos to faithful Remotion replication, or open and browse the user's local completed-shot collection. Does not include private shots, certification, production invocation, or external publishing.
---

# WangChuan 镜头库 · 公开入口

先确认任务是复刻新参考，还是查看本地成片，再完整读取分项 Skill。

| 请求 | 必须读取 | 结果 |
|---|---|---|
| 用户提供参考视频，希望复刻 | [首次复刻](../shot-library-replication/SKILL.md) | 参考保真 MP4、同帧证据，等待用户批准 |
| 查看、搜索自己已完成的镜头 | [镜头查看](../shot-library-viewer/SKILL.md) | 本地只读查看页面 |

本发行的通用规范为 [复刻流程](../../docs/replication-workflow.md)。不含作者私人案例、成果、镜头组件、素材或历史日志。没有私人数据不是安装故障；不要寻找作者的私人目录来补足示例。

用户直接提供视频是正式输入，不需要飞书。来源保存不可变副本和 SHA-256。选片权属于用户；未经用户选择，不启动复刻。原作者素材仅限获授权的分析用途，最终发布需另行解决素材权利。

技术通过不是视觉批准。保真批准必须由用户明确给出并绑定当前 MP4 哈希；文件变化后不能沿用旧批准。公开发行不提供模板认证和生产调用入口，不将保真复刻宣传为可直接生产调用的认证模板。

默认不写飞书、不发布 Eagle、不提交 Git，不改现有镜头及批准记录。当前用户明确要求上传代码时，只上传公开文件清单中的内容。
