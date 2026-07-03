#!/bin/sh
# NutriMyWay API startup — bypasses npm entirely
cd "$(dirname "$0")"
node server.js
