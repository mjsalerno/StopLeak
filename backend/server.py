#!/usr/bin/env python3
import asyncio
import websockets
import database
import json
import sqlite3
import pprint
from database import stopleak_db

#DB_NAME = 'test.db'
DB_NAME = 'new_db'

def handle_request(websocket, path):
    request = yield from websocket.recv()
    print(request)
    request_json = json.loads(request)
    pp = pprint.PrettyPrinter()

    print("Incoming request:" + " " + request)
    print("Deserialized request:")
    pp.pprint(request_json)

    # Extract the function name and arguments from the request
    function = request_json['function']
    args = request_json['args']
    
    if function == "record_tally":
        print("Request: " + function)
        print("Args: ")
        pp.pprint( args)
        backend.record_tally(**args)
    elif function == "record_add_domain":
        print("Request: " + function)
        backend.record_add_domain()
    elif function == "record_get_best_option":
        option_counts = backend.record_get_best_option()
        result = {
            'type' : 'record_get_best_option',
            'value': option_counts
        }
        yield from websocket.send(json.dumps(result))

    elif function == "record_get_scrub_percent":

        percent = backend.record_get_scrub_percent()
        result = {
            'type': 'record_get_scrub_percent',
            'value': percent
        }
        yield from websocket.send(json.dumps(result))
    else:
        print("Unsupported request: {}".format(function))


if __name__ == "__main__":
    backend = None
    try:
        server = websockets.serve(handle_request, 'localhost', 8765)
        # server = websockets.serve(handle_request, '0.0.0.0', 8765)
        backend = stopleak_db(DB_NAME)
        # Start the backend
        asyncio.get_event_loop().run_until_complete(server)
        asyncio.get_event_loop().run_forever()
    except KeyboardInterrupt:
        # Close the db correctly
        if backend:
            backend.close()
