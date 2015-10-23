"""
The database schema for our backend:

  Name   | Option Tally | Option Tally |....etc|
-----------------------------------------------
         |              |              |       |
-----------------------------------------------

"""

class stopleak_db:
    def __init__(self, db_name):
        conn = sqlite3.connect(db_name)
        c = conn.cursor()

    def record_tally(self, domain, choice):
        #avoid sql injection with param substitution
        self.c.execute('UPDATE domain_data SET ? = ? + 1 where domain = "?"', (choice, choice, domain))
        self.conn.commit()

    def record_add_domain(self, domain):
        self.c.execute('INSERT INTO domain_data (domain) VALUES + (?)', (domain,))
        self.conn.commit()

    def record_get_row(self, domain):
        self.c.execute('SELECT * FROM domain_data WHERE domain = ?', (domain,))
        row = self.c.fetchone()

    def record_get_best_option(self):
        pass
