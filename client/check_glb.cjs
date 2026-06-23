const fs = require('fs');
const file = process.argv[2];
if (!file) {
  console.log('Provide a file path');
  process.exit(1);
}
const buf = fs.readFileSync(file);
let offset = 12; // skip header
const chunkLength = buf.readUInt32LE(offset);
const chunkType = buf.toString('utf8', offset + 4, offset + 8);
if (chunkType === 'JSON') {
  const jsonStr = buf.toString('utf8', offset + 8, offset + 8 + chunkLength);
  const json = JSON.parse(jsonStr);
  if (json.accessors) {
    const posAccessors = json.accessors.filter(a => a.type === 'VEC3');
    posAccessors.forEach(a => {
      console.log("max:", a.max, "min:", a.min);
    });
  }
} else {
  console.log("First chunk is not JSON:", chunkType);
}
