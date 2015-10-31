#!/usr/bin/env python3

# *API*
# {"function" : "record_tally", "args": {"domain": "www.hello.com", "choice": "allow" } }

import asyncio
import websockets
import database
import json
import sqlite3
import pprint
import logging
from database import stopleak_db

DB_NAME = 'test.db'

def create_logger():
    logger =logging.getLogger('server_logger')
    # create file handler which logs even debug messages
    fh = logging.FileHandler('server.log')
    # log everything to file
    fh.setLevel(logging.NOTSET)
    # create formatter and add it to the handlers
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    fh.setFormatter(formatter)
    # add the handlers to logger
    logger.addHandler(fh)

    return logger

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
        try:
            backend.record_tally(**args)
        except Exception as e:
            module_logger.warning("Record_tally threw an exception", exc_info = True)
            
    elif function == "record_add_domain":
        print("Request: " + function)
        try:
            backend.record_add_domain(**args)
        except Exception as e:
            module_logger.warning("Record_add_domain threw an exception", exc_info = True)
    elif function == "record_get_best_option":
        try:
            option_counts = backend.record_get_best_option(**args)
        except Exception as e:
            module_logger.warning("Record_get_best_option threw an exception", exc_info = True)

        result = {
            'type': 'record_get_best_option',
            'value': option_counts
        }
        print('SENDING: {}'.format(result))
        yield from websocket.send(json.dumps(result))
    elif function == "record_get_scrub_percent":
    try:
        percent = backend.record_get_scrub_percent()
    except Exception as e:
        module_logger.warning("Record_get_scrub_percent threw an exception", exc_info = True)

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

        module_logger = create_logger()
        # Start the backend
        asyncio.get_event_loop().run_until_complete(server)
        asyncio.get_event_loop().run_forever()
    except KeyboardInterrupt:
        # Close the db correctly
        if backend:
            backend.close()
