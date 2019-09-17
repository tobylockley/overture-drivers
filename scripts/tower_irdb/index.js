const fs = require('fs');
const path = require('path');
const readline_sync = require('readline-sync');

String.prototype.toTitleCase = function() {
  return this.replace(
    /\w\w+/g,
    txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
};

const subtypes = [
  'audiosystem',
  'avconference',
  'camera',
  'clickshare',
  'display',
  'generic',
  'hvac',
  'io',
  'lift',
  'lighting',
  'matrix',
  'power',
  'projector',
  'shades',
  'player'
];

// Does user have codes in raw.txt?
console.log('Tower IRDB Overture driver generator...');
console.log(
  'Before proceeding, you must place codes into raw.txt (copy from email)'
);
if (!readline_sync.keyInYN('Are you ready to proceed?')) {
  // Key that is not `Y` was pressed.
  process.exit();
}

// Query the user for input
const brand = readline_sync.question('Brand: ');
const model = readline_sync.question('Model: ');
const type_index = readline_sync.keyInSelect(subtypes, 'Select device subtype');

// Folder creation
const driver_name = `${brand}_${model}`
  .toLowerCase()
  .replace(/[^0-9a-zA-Z_\-.]/g, ''); // Make legal filename
const outputPath = path.resolve(`${__dirname}/../../drivers/${driver_name}`);
if (fs.existsSync(outputPath)) throw new Error('Error! Folder already exists!');
fs.mkdirSync(outputPath);

// Load data from file
var data = fs.readFileSync(path.join(__dirname, 'raw.txt'), 'utf8');

// ir_codes.json
let regex = /"(.+?)","sendir,\d+:\d+,(.*?)".*/g;
let ir_codes = {};
while ((match = regex.exec(data))) {
  ir_codes[match[1]] = match[2];
}
fs.writeFileSync(
  path.join(outputPath, 'ir_codes.json'),
  JSON.stringify(ir_codes, null, 2)
);

// package.json
let pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'template_package.json'))
);
pkg.name = driver_name;
pkg.description = `Driver for ${brand} ${model}`;
pkg.overture.brand = brand;
pkg.overture.models = [`${model}`];
pkg.overture.subtype = subtypes[type_index];
fs.writeFileSync(
  path.join(outputPath, 'package.json'),
  JSON.stringify(pkg, null, 2)
);

// index.js
fs.copyFileSync(
  path.join(__dirname, 'template_index.js'),
  path.join(outputPath, 'index.js')
);

let zipPath = path.resolve(`${__dirname}/../../zip`);
require(path.resolve(`${__dirname}/../package_driver/index.js`))(
  outputPath,
  zipPath
); // Zip driver using zip script

console.log(`Complete! Driver source saved in ${outputPath}`);
console.log('Zip package saved in ${zipPath}/`');
