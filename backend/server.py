#!/usr/bin/env python3
import asyncio
import websockets
import database
import json
import sqlite3
<<<<<<< HEAD
import json
import pprint

=======
from database import stopleak_db
>>>>>>> 5194cfc67e2a3c0a22b07b40e793ca299c48a0fa

DB_NAME = 'test.db'


def handle_request(websocket, path):
    request = yield from websocket.recv()
<<<<<<< HEAD
    request_json = json.loads(request)
    pp = pprint.PrettyPrinter()
    
    
    print("Incoming request:" + " " + request)
    print("Deserialized request:")
    pp.pprint(request_json)

    if request == "record_tally":
        backend.record_tally()
    if request == "record_add_domain":
=======

    if request == "record_tally":
        backend.record_tally()
    elif request == "record_add_domain":
>>>>>>> 5194cfc67e2a3c0a22b07b40e793ca299c48a0fa
        backend.record_add_domain()
    elif request == "record_get_best_option":
        backend.record_get_best_option()
    elif request == "record_get_scrub_percent":
        percent = backend.record_get_scrub_percent()
        result = {
            'type': 'record_get_scrub_percent',
            'value': percent
        }
        yield from websocket.send(json.dumps(result))
    else:
        print("Unsupported request: {}".format(request))


server = websockets.serve(handle_request, 'localhost', 8765)
# server = websockets.serve(handle_request, '0.0.0.0', 8765)
backend = stopleak_db(DB_NAME)

asyncio.get_event_loop().run_until_complete(server)
asyncio.get_event_loop().run_forever()
