const knex = require('knex');
const supertest = require('supertest');
const { expect } = require('chai');
const app = require('../src/app');
const { makeNotesArray, makeMaliciousNote } = require('./notes.fixtures');
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

  describe('GET /api/notes', () => {
    context('Given no notes', () => {
      it('responds with 200 and an empty list', () => supertest(app)
        .get('/api/notes')
        .expect(200, []));
    });

    context('Given there are notes in the database', () => {
      const testFolders = makeFoldersArray();
      const testNotes = makeNotesArray();

      beforeEach('insert notes', () => db
        .into('folders')
        .insert(testFolders)
        .then(() => db
          .into('notes')
          .insert(testNotes)));
      it('responds with 200 and all of the notes', () => supertest(app)
        .get('/api/notes')
        .expect(200, testNotes));
    });

    context('Given an xss attack note', () => {
      const testFolders = makeFoldersArray();
      const { maliciousNote, sanitizedNote } = makeMaliciousNote();
      beforeEach('insert malicious note', () => db
        .into('folders')
        .insert(testFolders)
        .then(() => db
          .into('notes')
          .insert([maliciousNote])));
      it('removes XSS attack content', () => supertest(app)
        .get('/api/notes')
        .expect(200)
        .expect((res) => {
          expect(res.body[0].name).to.eql(sanitizedNote.name);
          expect(res.body[0].content).to.eql(sanitizedNote.content);
        }));
    });
  });
  describe('GET /api/notes/:note_id', () => {
    context('Given no notes', () => {
      it('responds with 404', () => {
        const noteId = 42;
        return supertest(app)
          .get(`/api/notes/${noteId}`)
          .expect(404, { error: { message: "Note doesn't exist" } });
      });
    });
    context('Given there are notes in the database', () => {
      const testFolders = makeFoldersArray();
      const testNotes = makeNotesArray();

      beforeEach('insert notes', () => db
        .into('folders')
        .insert(testFolders)
        .then(() => db
          .into('notes')
          .insert(testNotes)));

      it('responds with 200 and the specified note', () => {
        const noteId = 2;
        const expectedNote = testNotes[noteId - 1];
        return supertest(app)
          .get(`/api/notes/${noteId}`)
          .expect(200, expectedNote);
      });
    });
    context('Given an XSS attack note', () => {
      const testFolders = makeFoldersArray();
      const { maliciousNote, sanitizedNote } = makeMaliciousNote();

      beforeEach('insert malicious note', () => db
        .into('folders')
        .insert(testFolders)
        .then(() => db
          .into('notes')
          .insert([maliciousNote])));
      it('removes XSS attack content', () => supertest(app)
        .get(`/api/notes/${maliciousNote.id}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.name).to.eql(sanitizedNote.name);
          expect(res.body.content).to.eql(sanitizedNote.content);
        }));
    });
  });
  describe('POST /api/notes/', () => {
    const testFolders = makeFoldersArray();
    beforeEach('insert folders data', () => db
      .into('folders')
      .insert(testFolders));

    it('creates a note, responding with 201 and the new note', () => {
      const newNote = {
        name: 'New note',
        folderid: '1',
        content: 'Some test content',
      };
      return supertest(app)
        .post('/api/notes')
        .send(newNote)
        .expect(201)
        .expect((res) => {
          expect(res.body.name).to.eql(newNote.name);
          expect(res.body.folderid).to.eql(newNote.folderid);
          expect(res.body.content).to.eql(newNote.content);
          expect(res.body).to.have.property('id');
          expect(res.headers.location).to.eql(`/api/notes/${res.body.id}`);
          const expectedModified = new Intl.DateTimeFormat('en-US').format(new Date());
          const actualModified = new Intl.DateTimeFormat('en-US').format(new Date(res.body.date_published));
          expect(actualModified).to.eql(expectedModified);
        })
        .then((res) => {
          supertest(app)
            .get(`/api/notes/${res.body.id}`)
            .expect(res.body);
        });
    });

    const requiredFields = ['name', 'content', 'folderid'];

    requiredFields.forEach((field) => {
      const newNote = {
        name: 'Test note',
        content: 'Test content',
        folderid: 1,
      };

      it(`responds with 400 and an error message when the '${field}' is missing`, () => {
        delete newNote[field];

        return supertest(app)
          .post('/api/notes')
          .send(newNote)
          .expect(400, { error: { message: `Missing '${field}' in request body` } });
      });
    });

    it('removes XSS attack content from response', () => {
      const { maliciousNote, sanitizedNote } = makeMaliciousNote;
      return supertest(app)
        .post('/api/notes')
        .send(maliciousNote)
        .expect(201)
        .expect((res) => {
          expect(res.body.name).to.eql(sanitizedNote.name);
          expect(res.body.content).to.eql(sanitizedNote.content);
        });
    });
  });
  describe('DELETE /api/notes/:note_id', () => {
    context('Given no notes', () => {
      it('responds with 404', () => {
        const noteId = 42;
        return supertest(app)
          .delete(`/api/notes/${noteId}`)
          .expect(404, { error: { message: `Note with ${noteId} doesn't exist` } });
      });
    });

    context('Given there are notes in the database', () => {
      const testFolders = makeFoldersArray();
      const testNotes = makeNotesArray();

      beforeEach('insert notes', () => db
        .into('folders')
        .insert(testFolders)
        .then(() => db
          .into('notes')
          .insert(testNotes)));

      it('responds with 204 and removes the note', () => {
        const idToRemove = 2;
        const expectedNotes = testNotes.filter((notes) => notes.id !== idToRemove);
        return supertest(app)
          .delete(`/api/notes/${idToRemove}`)
          .expect(204)
          .then((res) => {
            supertest(app)
              .get('/api/notes')
              .expect(expectedNotes);
          });
      });
    });
  });
  describe('PATCH /api/notes/:note_id', () => {
    context('Given no notes', () => {
      it('responds with 404', () => {
        const noteId = 42;
        return supertest(app)
          .patch(`/api/notes/${noteId}`)
          .expect(404, { error: { message: "Note doesn't exist" } });
      });
    });
    context('Given there are notes in the database', () => {
      const testFolders = makeFoldersArray();
      const testNotes = makeNotesArray();

      beforeEach('insert notes', () => db
        .into('folders')
        .insert(testFolders)
        .then(() => db
          .into('notes')
          .insert(testNotes)));
      it('responds with 204 and updates the note', () => {
        const idToUpdate = 2;
        const updateNote = {
          name: 'updated name',
          content: 'updated content',
          folderid: 2,
        };
        const expectedNote = {
          ...testNotes[idToUpdate - 1],
          ...updateNote,
        };
        return supertest(app)
          .patch(`/api/notes/${idToUpdate}`)
          .send(updateNote)
          .expect(204)
          .then((res) => {
            supertest(app)
              .get(`/api/notes/${idToUpdate}`)
              .expect(expectedNote);
          });
      });
      it('responds with 400 when no required fileds supplied', () => {
        const idToUpdate = 2;
        return supertest(app)
          .patch(`/api/notes/${idToUpdate}`)
          .send({ irrelevantField: 'foo' })
          .expect(400, {
            error: {
              message: "Request body must contain either 'name', 'content', or 'folderid'",
            },
          });
      });
      it('responds with 204 when updating only a subset of fields', () => {
        const idToUpdate = 2;
        const updateNote = {
          name: 'updated note name',
        };
        const expectedNote = {
          ...testNotes[idToUpdate - 1],
          ...updateNote,
        };

        return supertest(app)
          .patch(`/api/notes/${idToUpdate}`)
          .send({
            ...updateNote,
            fieldToIgnore: 'should not be in GET response',
          })
          .expect(204)
          .then((res) => {
            supertest(app)
              .get(`/api/notes/${idToUpdate}`)
              .expect(expectedNote);
          });
      });
    });
  });
});
