const knex = require('knex');
const app = require('../src/app');
const { makeFoldersArray, makeMaliciousFolder } = require('./folders.fixtures');
const { makeNotesArray } = require('./notes.fixtures');

describe('Folders endpoints', () => {
  let db;

  const cleanup = () => db.raw(
    `TRUNCATE
    notes,
    folders
    RESTART IDENTITY CASCADE`,
  );

  before('make knex instance', () => {
    db = knex({
      client: 'pg',
      connection: process.env.TEST_DATABASE_URL,
    });
    app.set('db', db);
  });

  after('disconnect from db', () => db.destroy());

  before('cleanup', () => cleanup());

  afterEach('cleanup', () => cleanup());

  describe('GET /api/folders', () => {
    context('Given no folders', () => {
      it('responds with 200 and an empty list', () => supertest(app)
        .get('/api/folders')
        .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
        .expect(200, []));
    });

    context('Given there are folders in the database', () => {
      const testFolders = makeFoldersArray();

      beforeEach('insert folders', () => db
        .into('folders')
        .insert(testFolders));
      it('responds with 200 and all of the folders', () => supertest(app)
        .get('/api/folders')
        .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
        .expect(200, testFolders));
    });

    context('Given an xss attack folder', () => {
      const { maliciousFolder, sanitizedFolder } = makeMaliciousFolder();
      beforeEach('insert malicious folder', () => db
        .into('folders')
        .insert([maliciousFolder]));
      it('removes XSS attack content', () => supertest(app)
        .get('/api/folders')
        .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
        .expect(200)
        .expect((res) => {
          expect(res.body[0].name).to.eql(sanitizedFolder.name);
        }));
    });
  });
  describe('GET /api/folders/:folder_id', () => {
    context('Given no folders', () => {
      it('responds with 404', () => {
        const folderId = 42;
        return supertest(app)
          .get(`/api/folders/${folderId}`)
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(404, { error: { message: "Folder doesn't exist" } });
      });
    });
    context('Given there are folders in the database', () => {
      const testFolders = makeFoldersArray();

      beforeEach('insert folders', () => db
        .into('folders')
        .insert(testFolders));

      it('responds with 200 and the specified folder', () => {
        const folderId = 2;
        const expectedFolder = testFolders[folderId - 1];
        return supertest(app)
          .get(`/api/folders/${folderId}`)
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(200, expectedFolder);
      });
    });
    context('Given an XSS attack folder', () => {
      const { maliciousFolder, sanitizedFolder } = makeMaliciousFolder();

      beforeEach('insert malicious folder', () => db
        .into('folders')
        .insert([maliciousFolder]));
      it('removes XSS attack content', () => supertest(app)
        .get(`/api/folders/${maliciousFolder.id}`)
        .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.name).to.eql(sanitizedFolder.name);
        }));
    });
  });

  describe('POST /api/folders/', () => {
    const testFolders = makeFoldersArray();
    const testNotes = makeNotesArray();

    beforeEach('insert test data', () => db
      .into('folders')
      .insert(testFolders)
      .then(() => db
        .raw("SELECT setval('folders_id_seq', (SELECT MAX(id) from folders));")));

    it('creates a folder, responding with 201 and the new folder', () => {
      const newFolder = {
        name: 'New folder',
      };
      return supertest(app)
        .post('/api/folders')
        .send(newFolder)
        .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
        .expect(201)
        .expect((res) => {
          expect(res.body.name).to.eql(newFolder.name);
          expect(res.body).to.have.property('id');
          expect(res.headers.location).to.eql(`/api/folders/${res.body.id}`);
        })
        .then((res) => {
          supertest(app)
            .get(`/api/folders/${res.body.id}`)
            .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
            .expect(res.body);
        });
    });

    const requiredFields = ['name'];

    requiredFields.forEach((field) => {
      const newFolder = {
        name: 'Test folder',
      };

      it(`responds with 400 and an error message when the '${field}' is missing`, () => {
        delete newFolder[field];

        return supertest(app)
          .post('/api/folders')
          .send(newFolder)
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(400, { error: { message: `Missing '${field}' in request body` } });
      });
    });

    it('removes XSS attack content from response', () => {
      const { maliciousFolder, sanitizedFolder } = makeMaliciousFolder();
      return supertest(app)
        .post('/api/folders')
        .send(maliciousFolder)
        .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
        .expect(201)
        .expect((res) => {
          expect(res.body.name).to.eql(sanitizedFolder.name);
        });
    });
  });

  describe('DELETE /api/folders/:folder_id', () => {
    context('Given no folders', () => {
      it('responds with 404', () => {
        const folderId = 42;
        return supertest(app)
          .delete(`/api/folders/${folderId}`)
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(404, { error: { message: "Folder doesn't exist" } });
      });
    });

    context('Given there are folders in the database', () => {
      const testFolders = makeFoldersArray();

      beforeEach('insert folders', () => db
        .into('folders')
        .insert(testFolders));

      it('responds with 204 and removes the folder', () => {
        const idToRemove = 2;
        const expectedFolders = testFolders.filter((folders) => folders.id !== idToRemove);
        return supertest(app)
          .delete(`/api/folders/${idToRemove}`)
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(204)
          .then((res) => {
            supertest(app)
              .get('/api/folders')
              .expect(expectedFolders);
          });
      });
    });
  });

  describe('PATCH /api/folders/:folder_id', () => {
    context('Given no folders', () => {
      it('responds with 404', () => {
        const folderId = 42;
        return supertest(app)
          .patch(`/api/folders/${folderId}`)
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(404, { error: { message: "Folder doesn't exist" } });
      });
    });
    context('Given there are folders in the database', () => {
      const testFolders = makeFoldersArray();

      beforeEach('insert folders', () => db
        .into('folders')
        .insert(testFolders));
      it('responds with 204 and updates the folder', () => {
        const idToUpdate = 2;
        const updateFolder = {
          name: 'updated name',
        };
        const expectedFolder = {
          ...testFolders[idToUpdate - 1],
          ...updateFolder,
        };
        return supertest(app)
          .patch(`/api/folders/${idToUpdate}`)
          .send(updateFolder)
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(204)
          .then((res) => {
            supertest(app)
              .get(`/api/folders/${idToUpdate}`)
              .expect(expectedFolder);
          });
      });
      it('responds with 400 when no required fileds supplied', () => {
        const idToUpdate = 2;
        return supertest(app)
          .patch(`/api/folders/${idToUpdate}`)
          .send({ irrelevantField: 'foo' })
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(400, {
            error: {
              message: "Request body must contain 'name'",
            },
          });
      });
      it('responds with 204 when updating only a subset of fields', () => {
        const idToUpdate = 2;
        const updateFolder = {
          name: 'updated folder name',
        };
        const expectedFolder = {
          ...testFolders[idToUpdate - 1],
          ...updateFolder,
        };

        return supertest(app)
          .patch(`/api/folders/${idToUpdate}`)
          .send({
            ...updateFolder,
            fieldToIgnore: 'should not be in GET response',
          })
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(204)
          .then((res) => {
            supertest(app)
              .get(`/api/folders/${idToUpdate}`)
              .expect(expectedFolder);
          });
      });
    });
  });
});
