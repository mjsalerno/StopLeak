import random
import sqlite3
from logging import log
"""
The database schema for our backend:
----------------------------------------------------
| domain | scrub count | block count | allow count |
----------------------------------------------------
"""


def create_stopleak_db(file_name):
    conn = sqlite3.connect(file_name)
    c = conn.cursor()
    c.execute("CREATE TABLE domain_data (domain TEXT PRIMARY KEY, scrub INT \
        DEFAULT 0, block INT DEFAULT 0, allow INT DEFAULT 0)")
    conn.commit()
    conn.close()


class stopleak_db(object):
    def __init__(self, db_name):
        self.conn = sqlite3.connect(db_name)
        self.c = self.conn.cursor()

    def record_tally(self, domain, choice):
        # XX
        # CHECK IF EXISTS

        # avoid sql injection with param substitution

        # you cannot substitute table or column names

        options = ['scrub', 'block', 'allow']
        if choice not in options:
            log('Invalid column name: ', choice)
            self.conn.rollback()
            return
        log(choice, ' : ', domain)
        self.c.execute('UPDATE domain_data SET {0}= {0} + 1 WHERE domain = ?'
                       .format(choice),
                       (domain,))
        self.conn.commit()
        
    def record_add_domain(self, domain):
        domain = domain.lower()
        self.c.execute('INSERT INTO domain_data (domain) VALUES (?)', (domain,))
        self.conn.commit()

    def record_get_row(self, domain):
        self.c.execute('SELECT * FROM domain_data WHERE domain = ?', (domain,))
        row = self.c.fetchone()

    def record_get_best_option(self, domain):
        self.c.execute('SELECT scrub, block, allow  FROM domain_data WHERE domain = ?', (domain,))
        result = self.c.fetchone()
        # result column order is  order of query
        if result:
            result = {"scrub": result[0], "block": result[1], "allow": result[2]}
        else:
            result = {"scrub": 0, "block": 0, "allow": 0}
        return result

    def close(self):
        # commit just in case
        self.conn.commit()
        self.conn.close()

    def record_get_scrub_percent(self):
        percentage = int(random.uniform(0.1, 1.0) * 100)
        print("Unimplemented function: 'record_get_scrub_percent'")
        print("Returning a random percent: {}".format(percentage))
        return percentage
