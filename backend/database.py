import sqlite3
import logging
"""
The database schema for our backend:
----------------------------------------------------
| domain | scrub count | block count | allow count |
----------------------------------------------------
"""


def create_stopleak_db(file_name):
    conn = sqlite3.connect(file_name)
    c = conn.cursor()
    create = ('CREATE TABLE domain_data ('
              'domain TEXT PRIMARY KEY,'
              'scrub INT DEFAULT 0,'
              'block INT DEFAULT 0,'
              'allow INT DEFAULT 0)')
    c.execute(create)
    conn.commit()
    conn.close()


class StopleakDB(object):
    def __init__(self, db_name):
        self.conn = sqlite3.connect(db_name)
        self.c = self.conn.cursor()

    def tally(self, domain, choice):
        options = ['scrub', 'block', 'allow']
        if choice not in options:
            logging.warning('Received invalid choice: %s', choice)
            self.conn.rollback()
            return

        logging.info('%s %s', choice, domain)
        # Since we'd mostly do updates this could be a bottleneck.
        insert = 'INSERT OR IGNORE INTO domain_data (domain) VALUES (?)'
        self.c.execute(insert, (domain,))
        update = ('UPDATE domain_data '
                  'SET {0}= {0} + 1 '
                  'WHERE domain = ?'.format(choice))
        self.c.execute(update, (domain,))
        self.conn.commit()
        
    def add_domain(self, domain):
        domain = domain.lower()
        self.c.execute('INSERT INTO domain_data (domain) VALUES (?)', (domain,))
        self.conn.commit()

    def get_row(self, domain):
        self.c.execute('SELECT * FROM domain_data WHERE domain = ?', (domain,))
        row = self.c.fetchone()

    def get_counts(self, domains):
        # Parameters to execute must be an iterable
        params = domains
        if isinstance(params, str):
            params = (domains,)

        # Add the right number of ?'s for sqlite3 to escape correctly
        marks = ', '.join(['?'] * len(params))
        select = ('SELECT domain, block, scrub, allow '
                  'FROM domain_data '
                  'WHERE domain IN ({})'.format(marks))

        self.c.execute(select, params)
        results = self.c.fetchall()
        # result column order is  order of query
        domain_counts = {}
        for domain, block, scrub, allow in results:
            domain_counts[domain] = {"block": block, "scrub": scrub, "allow": allow}
        return domain_counts

    def close(self):
        # commit just in case
        self.conn.commit()
        self.conn.close()
