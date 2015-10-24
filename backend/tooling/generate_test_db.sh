#!/usr/bin/env bash

if command -v sqlite3 &> /dev/null; then
    # If a db with the same name already exists, delete it
    rm -f ${1:-test.db}
    # Create DB
    sqlite3 ${1:-test.db} < create.sql
    echo -e "\x1B[1;32mSuccessfully created ${1:-test.db}!\x1B[0m"
    # Echo contents to stdout
    echo -e "\x1B[1;34mDumping ${1:-test.db} contents\x1B[0m"
    echo "SELECT * FROM domain_data;" | sqlite3 ${1:-test.db}
else
    echo -e "\x1B[1;31mPlease install \x1B[1;32msqlite3\x1B[1;31m before running this script.\x1B[0m"
fi
