# 发布指南

1. 更新 package.json 版本与 CHANGELOG.md，运行类型检查、核心测试、构建及必要的 Windows 桌面回归。
2. 运行 `pnpm run package:dir`，然后 `node scripts/notices.mjs`。
3. 运行 `python scripts/export-release.py`。它从 `release/win-unpacked` 读取成品，导出到 `release/github`；源码只从明确的文件和目录清单收集。重复导出不会覆盖已有文件。
4. 检查 ZIP、`SHA256SUMS.txt` 和脱敏情况。不要添加用户应用数据、原照片或个人 API 密钥。
5. 在 GitHub 手动创建版本标签和 Release，上传 Windows ZIP、源码 ZIP、校验文件。Actions 仅做检查，不负责发布。

首次 GitHub 发行使用 v1.1.1。开源整理仅更新说明、授权和开发配置，沿用已经检查的 v1.1.1 程序；如程序代码发生变化，应重新构建与验证。

Releases 为面向用户的版本下载，Git 标签将该版本指向一个具体提交。GitHub 自动附带的 Source code 是标签对应源码快照；额外源码 ZIP 也应来自相同待发布文件。

真实 DeepSeek 账户联调、其他电脑和多显示器环境的未验证项须在发行说明中如实注明。禁止用模拟响应成功代表真实服务已验证。
