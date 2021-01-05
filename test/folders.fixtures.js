function makeFoldersArray() {
  return [
    {
      id: 1,
      name: 'Important',
    },
    {
      id: 2,
      name: 'Super',
    },
    {
      id: 3,
      name: 'Spangley',
    },
    {
      id: 4,
      name: 'Groovy',
    },
  ];
}

function makeMaliciousFolder() {
  const maliciousFolder = {
    id: 42,
    name: 'Inject <script>alert("xss");</script>',
  };
  const sanitizedFolder = {
    ...maliciousFolder,
    name: 'Inject &lt;script&gt;alert(\"xss\");&lt;/script&gt;',
  };
  return {
    maliciousFolder,
    sanitizedFolder,
  };
}

module.exports = {
  makeFoldersArray,
  makeMaliciousFolder,
};
