# Android Build Setup & Troubleshooting

This document covers the required developer environment setup for Android builds and
documents the build issues resolved in this project, including root causes and applied
solutions. **Read this before running your first Android build.**

---

## 1. Developer Prerequisites

Every developer must have the following installed and configured before building:

| Requirement        | Version      | Notes                                         |
|--------------------|-------------|-----------------------------------------------|
| JDK                | 17 (LTS)    | Required by Gradle and Android Gradle Plugin  |
| Android SDK        | API 36       | `compileSdkVersion` / `targetSdkVersion`      |
| Android NDK        | 27.1.12297006 | Specified in `android/build.gradle`          |
| CMake              | **3.31.6**   | See Issue #2 below — 3.22 is incompatible    |
| Node.js            | 18+          |                                               |

### 1.1 Set JAVA_HOME (required)

Gradle resolves the JDK via `JAVA_HOME`. Set it as a **system environment variable**.

**Windows (Command Prompt / System Properties):**
```
JAVA_HOME = C:\Program Files\Java\jdk-17
```

**macOS / Linux (`~/.zshrc` or `~/.bashrc`):**
```sh
export JAVA_HOME=$(/usr/libexec/java_home -v 17)   # macOS
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64  # Linux (Debian/Ubuntu)
```

> **Do not** add `org.gradle.java.home` to `android/gradle.properties` — that file is
> committed to git and hardcoding a machine-specific path will break every other developer.
> Use `JAVA_HOME` or your personal `~/.gradle/gradle.properties` instead.

### 1.2 Install NDK 27.1.12297006

In Android Studio: **SDK Manager → SDK Tools → NDK (Side by side)** → select `27.1.12297006`.

Or via command line:
```sh
sdkmanager "ndk;27.1.12297006"
```

### 1.3 Install CMake 3.31.6 (required — do not skip)

CMake 3.22 (the Android Studio default) is **incompatible with NDK 27**. See Issue #2 below
for the full explanation.

In Android Studio: **SDK Manager → SDK Tools → CMake** → select `3.31.6`.

Or via command line:
```sh
sdkmanager "cmake;3.31.6"
```

Verify installation:
```
C:\Users\<you>\AppData\Local\Android\Sdk\cmake\3.31.6\bin\cmake.exe --version
```

### 1.4 Create android/local.properties

`android/local.properties` is **gitignored** (machine-specific). Create it with:

```properties
sdk.dir=/Users/<you>/Library/Android/sdk          # macOS
sdk.dir=C\:\\Users\\<you>\\AppData\\Local\\Android\\Sdk  # Windows
```

---

## 2. Issue #1 — Invalid `org.gradle.java.home` Gradle Property

### Symptom
```
Value 'C:\Program Files\Java\jdk-17.0.18' given for org.gradle.java.home Gradle property is invalid
```

### Root Cause
`org.gradle.java.home` was hardcoded in the **version-controlled** file
`android/gradle.properties` with a path that did not exist on the machine. This type of
property is machine-specific and must never be committed to source control.

### Resolution Applied
- Removed `org.gradle.java.home` from `android/gradle.properties`.
- `JAVA_HOME` system environment variable is now the authoritative source for the JDK path
  (standard Gradle behaviour).

### Best Practice
| Location | What it's for |
|---|---|
| `android/gradle.properties` (committed) | Project-wide, non-sensitive, same on all machines |
| `~/.gradle/gradle.properties` (personal) | Per-developer overrides (e.g. `org.gradle.java.home`) |
| `android/local.properties` (gitignored) | Machine paths: `sdk.dir`, `ndk.dir` |
| System environment variables | `JAVA_HOME`, `ANDROID_HOME` |

---

## 3. Issue #2 — C++ ABI Linker Errors with NDK 27 + CMake 3.22

### Symptom
```
Execution failed for task ':app:buildCMakeDebug[arm64-v8a]'
ninja: error: ...
FAILED: librnscreens.so
ld.lld: error: undefined symbol: __cxa_begin_catch
ld.lld: error: undefined symbol: std::__ndk1::...
```

Errors appeared in native modules: `react-native-safe-area-context`, `react-native-screens`.

### Root Cause

NDK 27 **restructured its C++ STL directory layout**. The shared C++ runtime library
(`libc++_shared.so`) moved from:

```
# NDK ≤ 26 (old path — no longer exists in NDK 27)
ndk/XX/sources/cxx-stl/llvm-libc++/libs/{ABI}/libc++_shared.so
```
to:
```
# NDK 27 (new canonical path)
ndk/27.x/toolchains/llvm/prebuilt/{host}/sysroot/usr/lib/{ABI}/libc++_shared.so
```

CMake 3.22's Android NDK platform file (`ndk-stl-c++_shared.cmake`) still looked for the
**old path**. When the file was absent, CMake silently skipped adding `libc++_shared.so` to
`CMAKE_CXX_STANDARD_LIBRARIES`. The resulting link flags were only `-latomic -lm` — with no
C++ runtime — causing every C++ symbol (`__cxa_begin_catch`, `std::__ndk1::*`, etc.) to be
undefined at link time.

**Affected build graphs:**
1. The app's own CMake build — producing `libappmodules.so` (autolinked modules like
   `react-native-safe-area-context`)
2. `react-native-screens`' standalone CMake build — producing `librnscreens.so`

### Solutions Applied

#### Fix A — Upgrade to CMake 3.31.6 (NDK 27-aware)

CMake 3.31 knows the new NDK sysroot layout and correctly links `libc++_shared.so`.

**`android/app/build.gradle`** — specifies the minimum CMake version AGP must use for the
app's own native build:
```groovy
android {
    externalNativeBuild {
        cmake {
            path "src/main/jni/CMakeLists.txt"
            version "3.31.6"           // ← requires CMake 3.31.6 to be installed
        }
    }
}
```

#### Fix B — Custom app CMakeLists.txt (explicit libc++ linkage)

React Native's default `ReactNative-application.cmake` links all autolinked native modules
through a shared `common_flags` interface target. Explicitly adding `c++_shared` to that
interface ensures all autolinked libraries (`safeareacontext`, etc.) inherit the correct
C++ runtime linkage.

**`android/app/src/main/jni/CMakeLists.txt`** (new file, committed to git):
```cmake
cmake_minimum_required(VERSION 3.13)
project(appmodules)

# Standard React Native New Architecture app cmake entry point.
include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)

# Fix: NDK 27 does not propagate libc++_shared to autolinked modules via CMake 3.22.
# This target is the common link interface for all autolinked native libraries.
target_link_libraries(common_flags INTERFACE c++_shared)
```

#### Fix C — Patch react-native-screens (patch-package)

`react-native-screens` has its **own independent CMake build** (not part of the app's
CMake project). AGP invokes CMake separately for this library. The library's
`android/build.gradle` does not pin a CMake version, so it defaults to `3.22.1`.

The fix is applied via `patch-package` so it persists across `npm install`:

**`patches/react-native-screens+4.24.0.patch`** (committed to git):
```diff
--- a/android/CMakeLists.txt
+++ b/android/CMakeLists.txt
@@ -49,6 +49,17 @@ else()
     target_link_libraries(rnscreens
         ReactAndroid::jsi
         android
     )
 endif()
+
+# Fix: NDK 27 + CMake 3.22 does not automatically add libc++_shared to link flags.
+find_library(LIBCXX_SHARED c++_shared)
+if(LIBCXX_SHARED)
+    target_link_libraries(rnscreens ${LIBCXX_SHARED})
+else()
+    target_link_libraries(rnscreens -lc++_shared)
+endif()
```

`package.json` runs `patch-package` automatically after every `npm install`:
```json
"scripts": {
  "postinstall": "patch-package"
}
```

### Why These Are the Standard Approaches

| Approach | Why it's correct |
|---|---|
| CMake 3.31.6 | Official NDK 27 support; resolves the STL path lookup at the CMake level |
| Custom `CMakeLists.txt` | React Native's documented extension point for app-level native builds |
| `patch-package` | Industry-standard React Native pattern for patching `node_modules`; patch file is committed to git and auto-applied via `postinstall` |

---

## 4. Files Changed (What to Commit)

| File | Action | Commit? |
|---|---|---|
| `android/gradle.properties` | Removed machine-specific `org.gradle.java.home` | ✅ Yes |
| `android/app/build.gradle` | Added `externalNativeBuild` cmake block with version `3.31.6` | ✅ Yes |
| `android/app/src/main/jni/CMakeLists.txt` | New file — app-level C++ build entry | ✅ Yes |
| `patches/react-native-screens+4.24.0.patch` | New file — libc++ fix for rnscreens | ✅ Yes |
| `package.json` | Added `postinstall: patch-package` + `patch-package` devDependency | ✅ Yes |
| `android/local.properties` | Machine-specific SDK path | ❌ No (gitignored) |

---

## 5. New Developer Setup Checklist

When setting up this project for the first time:

- [ ] Install **JDK 17** and set `JAVA_HOME` as a system environment variable
- [ ] Install **Android Studio** with Android SDK (API 36)
- [ ] In SDK Manager, install **NDK `27.1.12297006`** (Side by Side)
- [ ] In SDK Manager, install **CMake `3.31.6`**
- [ ] Create `android/local.properties` with your local `sdk.dir` path
- [ ] Run `npm install` — `patch-package` applies the `react-native-screens` fix automatically
- [ ] Run `npx react-native run-android`

> If Gradle cannot find the JDK, add `org.gradle.java.home` to your **personal**
> `~/.gradle/gradle.properties` (not to the project's `android/gradle.properties`).

---

## 6. Architecture Configuration

`android/gradle.properties` currently targets:
```properties
reactNativeArchitectures=arm64-v8a,x86_64
```

- `arm64-v8a` — all modern physical Android devices (2016+)
- `x86_64` — Android emulators (x86_64 AVD images)

This covers 99%+ of development and production use cases. If you need to support 32-bit
devices (`armeabi-v7a`) for a specific client requirement, override per-build:
```sh
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a,x86_64
```
