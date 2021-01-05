const path = require('path');
const express = require('express');
const xss = require('xss');
const NotesService = require('./notes-service');
const logger = require('../logger');

const notesRouter = express.Router();
const jsonParser = express.json();

const serializeNote = (note) => ({
  id: note.id,
  name: xss(note.name),
  modified: note.modified,
  folderId: note.folderId,
  content: xss(note.content),
});

notesRouter
  .route('/')
  .get((req, res, next) => {
    const knexInstance = req.app.get('db');
    NotesService.getAllNotes(knexInstance)
      .then((notes) => {
        res.json(notes.map(serializeNote));
      })
      .catch(next);
  })
  .post(jsonParser, (req, res, next) => {
    const { name, folderId, content } = req.body;
    const newNote = { name, folderId, content };

    const newNoteKeys = Object.keys(newNote);
    newNoteKeys.forEach((key) => {
      if (newNote[key] === undefined) {
        return res.status(400).json({
          error: { message: `Missing '${key}' in request body` },
        });
      }
    });

    // const error = getNoteValidationError(newNote);
    // if (error) return res.status(400).send(error);

    NotesService.insertNote(
      req.app.get('db'),
      newNote,
    )
      .then((note) => {
        logger.info(`Note with id ${note.id} created`);
        res
          .status(201)
          .location(path.posix.join(req.originalUrl, `${note.id}`))
          .json(serializeNote(note));
      })
      .catch(next);
  });

notesRouter
  .route('/:note_id')
  .all((req, res, next) => {
    const { note_id } = req.params;
    NotesService.getById(req.app.get('db'), note_id)
      .then((note) => {
        if (!note) {
          logger.error(`Note with ${note_id} not found`);
          return res.status(404).json({
            error: { message: "Note doesn't exist" },
          });
        }

        res.note = note;
        next();
      })
      .catch(next);
  })
  .get((req, res) => {
    res.json(serializeNote(res.note));
  })
  .delete((req, res, next) => {
    NotesService.deleteNote(
      req.app.get('db'),
      req.params.note_id,
    )
      .then(() => {
        res.status(204).end();
      })
      .catch(next);
  })
  .patch(jsonParser, (req, res, next) => {
    const { name, folderId, content } = req.body;
    const noteToUpdate = { name, folderId, content };

    const numberOfValues = Object.values(noteToUpdate).filter(Boolean).length;
    if (numberOfValues === 0) {
      return res.status(400).json({
        error: {
          message: "Request body must contain either 'name', 'content', or 'folderId'",
        },
      });
    }

    NotesService.updateNote(
      req.app.get('db'),
      req.params.note_id,
      noteToUpdate,
    )
      .then(() => {
        res.status(204).end();
      })
      .catch(next);
  });

module.exports = notesRouter;
