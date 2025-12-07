#!/bin/bash
# Setup script to configure Java 17 for Nokariya backend

export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"

echo "Java 17 configured for this session"
echo "Java version:"
java -version

echo ""
echo "To make this permanent, add to your ~/.zshrc:"
echo "export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
echo "export PATH=\"/opt/homebrew/opt/openjdk@17/bin:\$PATH\""

