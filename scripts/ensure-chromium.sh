#!/usr/bin/env bash
# The sandbox may reset system packages, so (re)install Chromium when it's missing.
if [ ! -x /usr/bin/chromium ]; then
  sudo apt-get update -qq >/dev/null 2>&1
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq chromium >/dev/null 2>&1
fi
/usr/bin/chromium --version
