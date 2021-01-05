const logger = require('../logger');

const NO_ERRORS = null;

function getFolderValidationError({ name }) {
  if (name && name.length === 0) {
    logger.error('Empty folder name given');
    return {
      error: {
        message: "Folder name can't be empty",
      },
    };
  }
  return NO_ERRORS;
}

module.exports = { getFolderValidationError };
