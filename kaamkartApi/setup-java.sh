#!/bin/bash
# Setup script to configure Java 17 for KaamKart API

# Try multiple possible Java 17 locations
if [ -d "/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home" ]; then
    export JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home
elif [ -d "/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home" ]; then
    export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
    export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"
else
    # Use java_home utility to find Java 17
    export JAVA_HOME=$(/usr/libexec/java_home -v 17)
fi
export PATH="$JAVA_HOME/bin:$PATH"

echo "Java 17 configured for this session"
echo "Java version:"
java -version

echo ""
echo "To make this permanent, add to your ~/.zshrc:"
echo "export JAVA_HOME=$JAVA_HOME"
echo "export PATH=\"\$JAVA_HOME/bin:\$PATH\""

