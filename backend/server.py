#!/usr/bin/env python3
import asyncio
import websockets
import database
import sqlite3
from database import stopleak_db

DB_NAME = 'test.db'


def handle_request(websocket, path):
    request = yield from websocket.recv()

    if request == "record_tally":
        backend.record_tally()
    elif request == "record_add_domain":
        backend.record_add_domain()
    elif request == "record_get_best_option":
        backend.record_get_best_option()
    elif request == "record_get_scrub_percent":
        backend.record_get_scrub_percent()
    else:
        print("Unsupported request: {}".format(request))


server = websockets.serve(handle_request, 'localhost', 8765)
# server = websockets.serve(handle_request, '0.0.0.0', 8765)
backend = stopleak_db(DB_NAME)

asyncio.get_event_loop().run_until_complete(server)
asyncio.get_event_loop().run_forever()
