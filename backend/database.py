import random
import sqlite3
"""
The database schema for our backend:

  Name   | Option Tally | Option Tally |....etc|
-----------------------------------------------
         |              |              |       |
-----------------------------------------------

"""


def create_stopleak_db(file_name):
    conn = sqlite3.connect(file_name)
    c = conn.cursor()

    
    c.execute("CREATE TABLE domain_data (domain TEXT PRIMARY KEY, scrub INT DEFAULT 0, \
               block INT DEFAULT 0, nothing INT DEFAULT 0)")

    conn.commit()

    conn.close()


class stopleak_db(object):
    def __init__(self, db_name):
        self.conn = sqlite3.connect(db_name)
        self.c = self.conn.cursor()

    def record_tally(self, domain, choice):
        # avoid sql injection with param substitution

        # you cannot substitute table or column names
        options = {

            "scrub": "scrub",

            "block": "block",

            "nothing": "nothing"
        }
        
        self.c.execute('UPDATE domain_data SET' + ' ' + options[choice] + ' = ? + 1 where domain = ? ', (choice, domain))

        self.conn.commit()

    def record_add_domain(self, domain):
        domain = domain.lower()
        self.c.execute('INSERT INTO domain_data (domain) VALUES (?)', (domain,))
        self.conn.commit()

    def record_get_row(self, domain):
        self.c.execute('SELECT * FROM domain_data WHERE domain = ?', (domain,))
        row = self.c.fetchone()

    def record_get_best_option(self):
        self.c.execute('SELECT scrub, block, nothing  FROM domain_data WHERE domain = ?', (domain,))
        result = self.c.fetchone()
        # result column order is  order of query
        result = {"scrub" : result[0], "block" : result[1], "nothing": result[2] }

        return result
        
    def close(self):
        self.conn.close()

    def record_get_scrub_percent(self):
        percentage = int(random.uniform(0.1, 1.0) * 100)
        print("Unimplemented function: 'record_get_scrub_percent'")
        print("Returning a random percent: {}".format(percentage))
        return percentage
