const knex = require('knex');
const app = require('../src/app');
const { makeNotesArray } = require('./notes.fixtures');
const { makeFoldersArray } = require('./folders.fixtures');

describe('Notes endpoints', () => {
  let db;
  before('make knex instance', () => {
    db = knex({
      client: 'pg',
      connection: process.env.TEST_DB_URL,
    });
    app.set('db', db);
  });

  after('disconnect from db', () => db.destroy());

  before('clean the table', () => db.raw('TRUNCATE notes, folders RESTART IDENTITY CASCADE'));

  afterEach('cleanup', () => db.raw('TRUNCATE notes, folders RESTART IDENTITY CASCADE'));
});
