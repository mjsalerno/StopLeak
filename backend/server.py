#!/usr/bin/env python3

# *API*
# {"function" : "tally", "args": {"domain": "www.hello.com", "choice": "allow" } }

import asyncio
import websockets
import json
import logging
import argparse
import sys
import database

DEFAULT_DB_NAME = 'test.db'
DEFAULT_LOG_NAME = 'stopLeakServer.log'
DEFAULT_LOG_LVL = 'info'
DEFAULT_HOST = 'localhost'
DEFAULT_PORT = 8765


class StopLeak(object):

    def __init__(self, db_name, host, port, context):
        self.db = database.StopleakDB(db_name)
        self.server = websockets.serve(handle_request, host, port, ssl=context)
        self.host = host
        self.port = port


def main():
    global stopLeak

    args = parse_args()

    level = log_level_to_int(args.log_level)
    init_logging(args.log_file, level)

    context = None
    if not args.no_ssl:
        context = createSSLContext()
        import ssl
        context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
        cert = '../../certs/cert.pem'
        key = '../../certs/key.pem'
        context.load_cert_chain(certfile=cert, keyfile=key)

    stopLeak = StopLeak(args.db_name, args.host, args.port, context)
    logging.info('Listening at: %s:%s', args.host, args.port)
    try:
        # Start the asyncio event loop which runs the websockets request handler
        asyncio.get_event_loop().run_until_complete(stopLeak.server)
        asyncio.get_event_loop().run_forever()
    except KeyboardInterrupt:
        # Close the db correctly
        if stopLeak.db:
            stopLeak.db.close()
        # Close the websockets server too
        if stopLeak.server:
            stopLeak.server.close()
        # Cancel all tasks
        for task in asyncio.Task.all_tasks():
            task.cancel()


def parse_args():
    argparser = argparse.ArgumentParser(description='StopLeak Server.')
    argparser.add_argument('-d', '--db', action='store', dest='db_name',
                           default=DEFAULT_DB_NAME,
                           help='path to the sqlite3 database '
                                '(default: {})'.format(DEFAULT_DB_NAME))
    argparser.add_argument('-f', '--log-file', action='store', dest='log_file',
                           default=DEFAULT_LOG_NAME,
                           help='path to the log file (truncates current content)'
                                '(default: {})'.format(DEFAULT_LOG_NAME))
    argparser.add_argument('-l', '--log-lvl', action='store',  dest='log_level',
                           default=DEFAULT_LOG_LVL,
                           help='logging level, in decreasing verbosity: '
                                'debug, info, warning, error, critical '
                                '(default: {})'.format(DEFAULT_LOG_LVL))
    argparser.add_argument('-s', '--host', action='store', dest='host',
                           default=DEFAULT_HOST,
                           help='server hostname '
                                '(default: {})'.format(DEFAULT_HOST))
    argparser.add_argument('-p', '--port', action='store', dest='port',
                           default=DEFAULT_PORT,
                           help='server port '
                                '(default: {})'.format(DEFAULT_PORT))
    argparser.add_argument('-n', '--no-ssl', action='store_true', dest='no_ssl',
                           default=False,
                           help='Turn off SSL/TLS (default: False)')
    argparser.add_argument('-v', '--version', action='version', version='StopLeak Server v0.1')

    return argparser.parse_args()


def log_level_to_int(str_log_level):
    """
    Maps strings to the log-level constants of the logging module.
    'info' -> logging.INFO
    'debug' -> logging.DEBUG
    ...
    """
    numeric_level = getattr(logging, str_log_level.upper(), None)
    if not isinstance(numeric_level, int):
        print('Invalid log level: {}'.format(str_log_level), file=sys.stderr)
        exit(1)
    else:
        return numeric_level


def createSSLContext():
    import ssl
    context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
    cert = '../../certs/cert.pem'
    key = '../../certs/key.pem'
    try:
        context.load_cert_chain(certfile=cert, keyfile=key)
    except FileNotFoundError:
        print('ssl error, no cert/key: {}'.format([cert, key]), file=sys.stderr)
        exit(1)
    return context


def init_logging(log_file, log_level):
    """
    Initialize the logging module.
    """
    fmt = '%(asctime)s - %(name)s - %(levelname)s: %(message)s'
    logging.basicConfig(filename=log_file, filemode='w+', format=fmt, level=log_level)
    init_ws_logging()


def init_ws_logging():
    """
    The websockets module logs errors to 'websockets.server' so let's print those.
    """
    logger = logging.getLogger('websockets.server')
    logger.setLevel(logging.ERROR)
    logger.addHandler(logging.StreamHandler())


@asyncio.coroutine
def handle_request(websocket, path):
    global stopLeak

    request = yield from websocket.recv()
    if not request:
        logging.debug('Closing socket.')
        websocket.close()
        return

    try:
        request_json = json.loads(request)
    except Exception:
        logging.warning("Malformed JSON", exc_info=True)
        return
        

    logging.debug("Incoming request: %s", request_json)

    # Extract the function name and arguments from the request
    # If the request is malformed then we need to catch the exception and return to handle the next request
    try:
        function = request_json['function']
        args = request_json['args']
    except Exception:
        logging.warning("Missing argument", exc_info=True)
        return
    
    if function == "tally":
        try:
            stopLeak.db.tally(**args)
        except Exception as e:
            logging.warning("tally threw an exception", exc_info=True)
            
    elif function == "add_domain":
        try:
            stopLeak.db.add_domain(**args)
        except Exception as e:
            logging.warning("add_domain threw an exception", exc_info=True)
    elif function == "get_counts":
        try:
            option_counts = stopLeak.db.get_counts(**args)
            result = {
                'type': 'get_counts',
                'value': option_counts
            }
            logging.debug('SENDING: %s', result)
            yield from websocket.send(json.dumps(result))
        except Exception as e:
            logging.warning("get_counts threw an exception", exc_info=True)
    else:
        logging.error("Unsupported request: {}".format(function))


if __name__ == "__main__":
    main()

