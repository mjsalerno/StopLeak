#!/usr/bin/env python3
import asyncio
import websockets
import database
import sqlite3

DB_NAME = 'test.db'


def handle_request(websocket, path):
    request = yield from websocket.recv()

    print(request)

    if request == "record_tally":
        backend.record_tally()

    if request == "record_add_domain":
        backend.record_add_domain()
    if request == "record_get_best_option":
        backend.record_get_best_option()


#server = websockets.serve(handle_request, 'localhost', 8765)
server = websockets.serve(handle_request, '0.0.0.0', 8765)
#backend = stopleak_db(DB_NAME)

asyncio.get_event_loop().run_until_complete(server)
asyncio.get_event_loop().run_forever()
