# 双槽 Dual Slot

通才者的执行位与缓存区。底部四个入口：**执行 / 缓存区 / 回流区 / 进度统计**。

## 运行

```bash
npm install
npm run dev
```

打开 http://localhost:5173/

## 怎么用

1. **缓存区**：添加标题、内容、标签；勾选完成后是否进入回流。把条目拖到最上面的主任务（默认每天 90 分钟）或副任务（默认 30 分钟）。
2. **执行**：大时钟。计时或倒计时。右上角切换中/英文。选当下任务、白噪音和背景风格。
3. **回流区**：看完成项的耗时，重新排队或删除。
4. **进度统计**：每日用时、主副是否达标、累计达标天数、近 30 天、月/年汇总。

数据只存在本机（浏览器 IndexedDB、桌面 exe 或手机 App 内的 WebView）。这几种环境互不同步。

## 电脑本地使用

两种方式，由易到「真正的 exe」：

**1. Edge / Chrome 安装成桌面应用（最方便，不用打包）**

```bash
npm run dev
```

用 Edge 或 Chrome 打开 http://localhost:5173/ ，地址栏右侧或菜单里选 **安装双槽** / **安装应用**。之后开始菜单和桌面会有图标，窗口里没有浏览器标签栏。第一次安装时开发服务器要开着；装好后若离线缓存生效，也可以单独打开。数据存在该浏览器的配置里。

**2. 打成便携 exe（双击即用，不依赖终端）**

```bash
npm run desktop
```

会打开一个桌面窗口，用来确认效果。要生成可拷贝的安装文件：

```bash
npm run desktop:exe
```

产物在 `release/` 目录，类似 `双槽-0.0.0-portable.exe`。拷到任意文件夹双击即可，不必再开 `npm`。数据存在系统用户目录下 Electron 对应的缓存里，和浏览器不是同一份。


## 做成手机应用（Android APK）

这是把现有网页用 Capacitor 包进系统 WebView，不是重写原生界面。你这台 Windows 电脑可以打 **Android 安装包**；**iOS 必须用 Mac + Xcode**，还需要 Apple 开发者账号才能装到非自己的 iPhone 上长期使用。

### Android

1. 安装 [Android Studio](https://developer.android.com/studio)（会带 JDK 和 Android SDK）。
2. 在项目目录：

```bash
npm run mobile:sync
npm run mobile:open
```

3. 在 Android Studio 里等 Gradle 同步结束。连上手机（打开开发者选项 / USB 调试），点 Run；或菜单 **Build → Build APK(s)** / **Generate Signed Bundle / APK**。
4. 把生成的 `.apk` 拷到手机安装。首次安装需允许「未知来源」或「通过 USB 安装」。

之后改了网页代码，再执行一次 `npm run mobile:sync`，然后在 Android Studio 里重新运行或出包。

### iOS

在 Mac 上安装 Xcode 后执行 `npx cap add ios`，再用 `npx cap sync ios` 和 `npx cap open ios`。个人测试可用免费 Apple ID 签到自己的手机（大约 7 天要重签）；上架 App Store 需要付费开发者账号。
