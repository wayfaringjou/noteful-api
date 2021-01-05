const path = require('path');
const express = require('express');
const xss = require('xss');
const logger = require('../logger');
const FoldersService = require('./folders-service');
const { getFolderValidationError } = require('./folders-validator');

const foldersRouter = express.Router();
const jsonParser = express.json();

const serializeFolders = (folder) => ({
  id: folder.id,
  name: xss(folder.name),
});

foldersRouter
  .route('/')
  .get((req, res, next) => {
    const knexInstance = req.app.get('db');
    FoldersService.getAllFolders(knexInstance)
      .then((folders) => {
        res.json(folders.map(serializeFolders));
      })
      .catch(next);
  })
  .post(jsonParser, (req, res, next) => {
    const { name } = req.body;
    const newFolder = { name };

    const newFolderKeys = Object.keys(newFolder);
    newFolderKeys.forEach((key) => {
      if (newFolder[key] === undefined) {
        return res.status(400).json({
          error: { message: `Missing '${key}' in request body` },
        });
      }
    });

    const error = getFolderValidationError(newFolder);
    if (error) return res.status(400).send(error);

    FoldersService.insertFolder(
      req.app.get('db'),
      newFolder,
    )
      .then((folder) => {
        logger.info(`Folder with id ${folder.id} created`);
        res
          .status(201)
          .location(path.posix.join(req.originalUrl, `${folder.id}`))
          .json(serializeFolders(folder));
      })
      .catch(next);
  });

foldersRouter
  .route('/:folder_id')
  .all((req, res, next) => {
    const { folder_id } = req.params;
    FoldersService.getById(req.app.get('db'), folder_id)
      .then((folder) => {
        if (!folder) {
          logger.error(`Folder with ${folder_id} not found`);
          return res.status(404).json({
            error: { message: "Folder doesn't exist" },
          });
        }

        res.folder = folder;
        next();
      })
      .catch(next);
  })
  .get((req, res) => {
    res.json(serializeFolders(res.folder));
  })
  .delete((req, res, next) => {
    FoldersService.deleteFolder(
      req.app.get('db'),
      req.params.folder_id,
    )
      .then((numRowsAffected) => {
        res.status(204).end();
      })
      .catch(next);
  })
  .patch(jsonParser, (req, res, next) => {
    const { name } = req.body;
    const folderToUpdate = { name };

    const numberOfValues = Object.values(folderToUpdate).filter(Boolean).length;
    if (numberOfValues === 0) {
      return res.status(400).json({
        error: { message: "Request body must contain 'name'" },
      });
    }
    FoldersService.updateFolder(
      req.app.get('db'),
      req.params.folder_id,
      folderToUpdate,
    )
      .then((numRowsAffected) => {
        res.status(204).end();
      })
      .catch(next);
  });

module.exports = foldersRouter;
