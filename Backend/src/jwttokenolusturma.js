const bcrypt = require('bcrypt');

async function main() {
  const password = 'saban0707';
  const hash = await bcrypt.hash(password, 12);

  console.log('PasswordHash:', hash);
}

main();