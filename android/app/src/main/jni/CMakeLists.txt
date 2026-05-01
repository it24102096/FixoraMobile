cmake_minimum_required(VERSION 3.13)

# Define the library name here.
project(appmodules)

# This file includes all the necessary to let you build your application with the New Architecture.
include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)

# NDK 27 requires c++_shared to be explicitly linked for all autolinked native modules.
target_link_libraries(common_flags INTERFACE c++_shared)
