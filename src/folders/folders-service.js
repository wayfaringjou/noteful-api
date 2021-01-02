const FoldersService = {
  getAllFolders(knex) {
    return knex.select('*').from('folders');
  },
};

module.exports = FoldersService;
