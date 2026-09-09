# 本地查看器

## 启动

```sh
node viewer/server.mjs
node viewer/server.mjs --library-root "/path/to/my-library" --port 8848
```

服务只监听 `127.0.0.1`，通过网页搜索和观看本地成片。启动无需额外 npm 包。FFmpeg 仅用于按需生成缩略图，缓存写入所选镜头目录的 `.cache/shot-viewer/`。视频与原始记录保持不变。

点击镜头图片后，详情中的视频立即播放，切换观看版本也会直接播放。鼠标悬浮卡片时静音循环预览，移开后停止并恢复图片；同一时间只预览一个镜头。滚动使卡片离开画面、切换页面或打开详情时会停止悬浮预览。触屏设备使用点击播放。

## 自有成片登记

`npm run viewer:register -- --id seq-0001 --title "镜头名称" --file library/my-shot.mp4` 将位于项目内的视频加入 `catalog/viewer-index.json`。重复编号拒绝覆盖；更新版本需明确编辑本地索引。路径必须在选定镜头目录内，拒绝绝对路径和逃逸目录的链接。

本地索引结构如下（仅为数据合同示例，不包含成片）：

```json
{
  "schemaVersion": 1,
  "entries": [{
    "sequenceId": "seq-0001",
    "title": "我的镜头",
    "sceneType": "B-roll",
    "tags": ["人物介绍"],
    "description": "镜头的表达用途",
    "versions": [{"label": "本地预览", "relativePath": "library/my-shot.mp4"}]
  }]
}
```

已有明确用户批准时，版本记录可包含 `gate: "gate1"` 或 `"gate2"`、`approvalStatus: "approved"`、`approvedSha256`。这些字段只应由负责保管批准证据的工作流写入；登记命令不写它们。查看器每次重新读取时核对实际文件哈希，文件不符显示“文件已变化”。

## 已有项目适配

查看器只读 `library/{a-roll,b-roll,pip}/seq-NNNN/shot-manifest.json`、当前说明卡、现有执行状态和 `out/*/batch-state.json` 中的首次复刻记录。当前批次的明确候选路径优先，按批次更新时间处理重复条目，不扫描并猜选历史 MP4。`catalog/viewer-index.json` 可提供显式版本与名称补充。

不存在当前登记成片的镜头不显示。未经核对的旧预览只显示“本地预览”。现有数据记录不会被重建；普通查看不能代表认证或生产检索。目录刷新最多缓存 15 秒，文件新增后稍等再点刷新。

## 隐私与访问

只提供固定网页资源及登记过的视频 ID，不提供任意文件浏览。拒绝外站来源、未知 Host 和写请求；无第三方字体、统计脚本或媒体服务。不要将该服务改为公开托管：公开的是查看器代码，私人镜头由每个人在自己的电脑中加载。

## 播放故障

缩略图空白：确认 FFmpeg 位于 PATH，或直接点击播放。无法播放：确认视频存在且编码受浏览器支持；H.264 MP4 通常兼容性较好。需要转码时另存副本，不覆盖批准版；新文件不能沿用旧哈希批准。
