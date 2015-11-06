#!/usr/bin/env python3

# *API*
# {"function" : "tally", "args": {"domain": "www.hello.com", "choice": "allow" } }

import asyncio
import websockets
import json
import logging
import database

DB_NAME = 'test.db'


class StopLeak(object):

    def __init__(self, db_name, host, port):
        self.db = database.StopleakDB(db_name)
        self.server = websockets.serve(handle_request, host, port)
        self.host = host
        self.port = port


def main():
    global stopLeak

    init_logging()

    stopLeak = StopLeak(DB_NAME, 'localhost', 8765)
    try:
        # Start the backend
        asyncio.get_event_loop().run_until_complete(stopLeak.server)
        asyncio.get_event_loop().run_forever()
    except KeyboardInterrupt:
        # Close the db correctly
        if stopLeak.db:
            stopLeak.db.close()


def init_logging():
    fmt = '%(asctime)s - %(name)s - %(levelname)s: %(message)s'
    logging.basicConfig(filename='server.log', format=fmt, level=logging.DEBUG)
    init_ws_logging()


def init_ws_logging():
    """
    The websockets module logs errors to 'websockets.server' so let's print those.
    """""
    logger = logging.getLogger('websockets.server')
    logger.setLevel(logging.ERROR)
    logger.addHandler(logging.StreamHandler())


@asyncio.coroutine
def handle_request(websocket, path):
    global stopLeak

    request = yield from websocket.recv()
    request_json = json.loads(request)

    stopLeak.logger.debug("Incoming request: %s", request_json)

    # Extract the function name and arguments from the request
    function = request_json['function']
    args = request_json['args']

    if function == "tally":
        try:
            stopLeak.db.tally(**args)
        except Exception as e:
            stopLeak.logger.warning("tally threw an exception", exc_info=True)
            
    elif function == "add_domain":
        try:
            stopLeak.db.add_domain(**args)
        except Exception as e:
            stopLeak.logger.warning("add_domain threw an exception", exc_info=True)
    elif function == "get_counts":
        try:
            option_counts = stopLeak.db.get_counts(**args)
            result = {
                'type': 'get_counts',
                'value': option_counts
            }
            stopLeak.logger.debug('SENDING: %s', result)
            yield from websocket.send(json.dumps(result))
        except Exception as e:
            stopLeak.logger.warning("get_counts threw an exception", exc_info=True)
    else:
        stopLeak.logger.error("Unsupported request: {}".format(function))


if __name__ == "__main__":
    main()

