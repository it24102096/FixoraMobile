cmake_minimum_required(VERSION 3.13)

# Define the library name here.
project(appmodules)

# This file includes all the necessary to let you build your application with the New Architecture.
include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)

# Fix: NDK 27 does not automatically propagate libc++_shared linkage to autolinked
# native modules (react-native-safe-area-context, react-native-screens, etc.).
# Adding c++_shared to common_flags (which is already linked to every autolinked
# library) ensures the linker can resolve __cxa_begin_catch and other libc++ symbols.
target_link_libraries(common_flags INTERFACE c++_shared)
