#!/usr/bin/env bash

if command -v sqlite3 &> /dev/null; then
    sqlite3 ${1:-test.db} < create.sql
else
    echo -e "\x1B[1;31mPlease install \x1B[1;32msqlite3\x1B[1;31m before running this script.\x1B[0m"
fi
