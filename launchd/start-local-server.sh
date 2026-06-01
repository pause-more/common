#!/bin/zsh
cd /tmp || exit 1
exec /usr/bin/python3 -m http.server 8000 --bind 127.0.0.1 --directory "/Users/jinzero/Desktop/소스 백업/0506"
