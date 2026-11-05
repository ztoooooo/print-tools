# 投稿到 DBX 官方商店（dbx-store）操作指南

本项目同时是一个 DBX 纯前端插件（universal 包）。官方商店采用
「作者发未签名候选包 → 商店审核 → 官方统一 Ed25519 签名 → 合并」的流程，
**作者不持有、也不需要商店签名私钥**，不要跑 `dbx-plugin keygen`。

- 插件 ID：`io.github.ztoooooo.print-tools`
- Publisher：`ztoooooo`
- 源码仓库：https://github.com/ztoooooo/print-tools
- 商店仓库（PR 目标）：https://github.com/t8y2/dbx-store ，分支 `main`
- 规范来源：https://github.com/t8y2/dbx-store/blob/main/CONTRIBUTING.md

---

## 阶段 0：前置条件

1. 源码仓库 **public**（审核要能看到源码）。
2. 根目录有 `LICENSE`（本项目为 MIT），与 `.dbx-store.json` 的 `license` 一致。
3. `manifest.json` 的 `id` / `version` / `publisher` 定稿，发布后 **id 不可改**。
4. `.dbxp` 二进制**不要**提交进 Git（已在 `.gitignore` 忽略 `*.dbxp`）。

## 阶段 1：合并代码并发布 GitHub Release（自动产候选包）

仓库已带 `.github/workflows/plugin-release.yml`，监听 Release 的 `published` 事件，
复用官方 reusable workflow：先 `npm run build:dbx` 生成 `ui/`，再
`dbx-plugin package` 输出未签名候选包到 `dist/`，最后自动汇总
`release-candidates.json` 挂到该 Release。

```bash
# 1. 确认本地改动已提交并推送
git add -A
git commit -m "feat: DBX 插件化 v1.5.0"
git push origin main

# 2. 打版本 tag（与 manifest.json 的 version 完全一致）
git tag v1.5.0
git push origin v1.5.0

# 3. 在 GitHub 上基于该 tag 发布 Release（发布动作触发 workflow）
gh release create v1.5.0 --title "v1.5.0" --notes "首个 DBX 插件版本"
```

发布后到 Actions 页确认 `Release DBX plugin` 变绿，Release 资产里会出现：

- `io.github.ztoooooo.print-tools-1.5.0-universal.dbxp`
- `io.github.ztoooooo.print-tools-1.5.0-universal.artifact.json`
- `release-candidates.json`

## 阶段 2：准备商店 PR 的两个文件

Fork `t8y2/dbx-store`，在 fork 上新建分支，新增两个文件。

### 2.1 首次投稿才需要：`publishers/ztoooooo.json`

```json
{
  "id": "ztoooooo",
  "name": "ztoooooo",
  "status": "unverified"
}
```

### 2.2 每次都需要：`candidates/io.github.ztoooooo.print-tools.json`

```json
{
  "schemaVersion": 1,
  "id": "io.github.ztoooooo.print-tools",
  "publisher": "ztoooooo",
  "version": "1.5.0",
  "name": "Local Print Tools",
  "description": "Local-only WYSIWYG workbench for laying out invoices, tickets and ID cards on A4, with perspective correction, watermark and PDF export. Nothing leaves the machine.",
  "icon": "https://raw.githubusercontent.com/ztoooooo/print-tools/v1.5.0/assets/plugin.svg",
  "tags": ["print", "pdf", "productivity", "image"],
  "permissions": ["host.storage"],
  "source": "https://github.com/ztoooooo/print-tools/tree/v1.5.0",
  "homepage": "https://ztoooooo.github.io/print-tools/",
  "license": "MIT",
  "releaseNotes": "首个 DBX 插件版本：发票/车票/证件三工作区排版、OpenCV 透视矫正、自定义水印、PDF 导出，全程本地处理、零上传。",
  "localizations": {
    "zh-CN": {
      "name": "票据打印",
      "description": "纯前端本地票据打印工作台：发票 / 车票 / 证件排版、透视矫正、水印与 PDF 导出，文件不出本机。"
    }
  },
  "targets": [
    {
      "target": "universal",
      "url": "https://github.com/ztoooooo/print-tools/releases/download/v1.5.0/io.github.ztoooooo.print-tools-1.5.0-universal.dbxp",
      "sha256": "<以 Release 中 .artifact.json 的 sha256 为准>",
      "size": 0
    }
  ]
}
```

> ⚠️ `sha256` 和 `size` **必须**填阶段 1 Release 里
> `io.github...-universal.artifact.json` 的实际值（签名时会逐字节校验，不一致直接拒绝）。
> 本地 1.5.0 包参考值：sha256 `c43021aa24c97a0ff2f6ac52c0ba343625839c85d597cbcc749458463ba20bd9`、
> size `5084359`；CI 产物请以线上 artifact.json 为准。
> `id` / `version` / `publisher` 必须与包内 `manifest.json` 完全一致。

## 阶段 3：发 PR 并填写 PR 模板

向 `t8y2/dbx-store` 的 `main` 发**一个** PR（无需先开 Issue），按模板如实填写：

- **Capabilities**：仅一个 workbench，无连接、无文件系统 provider、无 sidecar
- **Permissions**：`host.storage`（持久化排版/水印等配置）
- **Data access**：不读取任何数据库/连接数据
- **Network access**：无（manifest 未声明任何 `host.network`，完全离线）
- **Native sidecar**：无，纯前端 universal 包

提交后 CI 会**故意保持红色**，提示
`open candidate(s) awaiting DBX Store signing`——这是正常的，用来阻止未签名内容被合并。

## 阶段 4：等待审核与签名

- 维护者审查源码、Manifest、权限、SHA-256、体积与原生行为。
- 通过后维护者触发受保护的签名 workflow（`/sign`），用商店私钥加 Ed25519 签名，
  把签名包发到 `dbx-store` Release，并回写 `plugins/<id>.json` 与 `catalog/index.json`、
  删除 `candidates/<id>.json` 到你的 PR 分支。
- CI 变绿后维护者合并，插件进入官方目录。商店无明确审核 SLA。

## 后续版本

1. 改代码，**递增** `manifest.json` 的 `version`（不可覆盖已发布版本，字节一变就要新版本）。
2. 发新 tag + Release，CI 自动产新候选包。
3. 只提交**新版本**的 `candidates/<id>.json`（省略的商店字段沿用现值）；
   不要手改 `plugins/` 或 `catalog/`。
4. 若已在 `automation/plugin-sources.json` 登记 `autoUpdate: true`，
   后续版本连候选 PR 都由同步机器人自动开，只需等审核签名。

## 常见拒因（提前规避）

权限过大、License 不清、源码与包无法对应（provenance）、候选哈希/大小对不上、
manifest 身份与候选元数据不一致、URL 非 HTTPS 或指向了 dbx-store 自己的签名产物。
