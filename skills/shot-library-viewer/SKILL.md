---
name: shot-library-viewer
description: Open and browse the user's own local shot collection with search, filters, version playback and hash-bound approval display. Use for viewing completed shots without modifying components or approvals.
---

# 本地镜头查看

先读 [查看器文档](../../docs/viewer.md)。在仓库根目录运行 `npm run viewer`，检查 `/health` 返回本查看器标识后打开输出的本机地址。需要其他目录时使用 `--library-root`，仅访问用户指定目录。

按名称、编号、关键词、类型和阶段查询。需要查看某个镜头时打开卡片，再选观看版本；不要仅凭缩略图宣称完成播放。公开初始仓库为空，用户自己的成片需按文档登记。

页面只读。批准记录存在且 MP4 哈希匹配时才显示对应阶段通过；失配显示文件已变化。Gate 1 不等于 Gate 2，Gate 2 也不等于模板认证。页面不授予任何调用资格。

不得把视频、缩略图、目录索引、私人成片组件或批准记录复制到 GitHub。服务只能监听回环地址；不为方便访问而改成公网或局域网监听。

文件无法播放时核对路径、文件存在性和浏览器编码支持；缩略图失败时核对 FFmpeg。不要通过重新渲染已批准成片解决页面问题。
