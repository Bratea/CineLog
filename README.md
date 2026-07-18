# 观影记录 App

Vue 3 + Vite 页面通过 Capacitor 封装为 Android App。业务数据只保存在手机应用沙盒，不需要自建服务器或 Nginx。

Nginx 仅在国内网络无法访问 TMDB 时作为 HTTPS 443 转发使用，不保存片库数据。

## 本地数据方案

- Android：电影、评分、观后感和 TMDB 详情保存到原生 SQLite 数据库 `cinelog`。
- Android：海报、背景图和演职员头像只保存 TMDB 路径引用，显示时按需加载。
- Web 开发预览：使用 IndexedDB，数据结构与 App 保持一致。
- 首次升级为原生版时，会自动把旧 IndexedDB 或 `movie-records-v1` 数据迁移到 SQLite。
- TMDB 搜索和图片显示仍需网络；已经加入片库的文字资料、评分和观后感可从本地读取。
- 卸载 App 或在系统设置中“清除应用数据”会删除本地数据库。

## 环境要求

- Node.js 22 或更高版本
- JDK 21
- Android SDK Platform 36
- Android SDK Build Tools 36

## 网页开发

```powershell
npm.cmd install
npm.cmd run dev
```

## 国内访问 TMDB

系统 hosts 不能保证国内网络可用，APK 也不会继承电脑的 hosts。建议准备一台能访问 TMDB 的境外 VPS，用项目内的 `deploy/nginx/tmdb-proxy.conf.example` 配置 HTTPS 443 反代，然后在“设置 → TMDB”填写：

```text
API 地址：https://你的域名/tmdb-api
图片地址：https://你的域名/tmdb-image
```

HTTPS 默认使用 443，无需在地址中额外写 `:443`。网页跨域访问所需的 CORS 响应头已经包含在示例配置中。

## 同步 Android 工程

```powershell
npm.cmd run app:sync
```

该命令会构建网页并把 `dist` 同步到 `android` 工程。

## 生成调试 APK

```powershell
npm.cmd run app:build
```

脚本会自动使用当前 JDK 21，并通过项目级 Maven 镜像处理国内网络。构建成功后的 APK 位于：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## 使用 Android Studio

```powershell
npm.cmd run app:open
```

首次打开时，在 SDK Manager 安装 Android SDK Platform 36 和 Build Tools 36，然后即可连接手机运行。

## 主要文件

- `capacitor.config.json`：App ID、名称、网页目录和 SQLite 配置。
- `src/services/localDatabase.ts`：SQLite/IndexedDB 统一数据访问层。
- `android/`：Capacitor 生成的 Android 原生工程。
- `scripts/build-android.ps1`：Windows APK 构建脚本。
