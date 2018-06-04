const FolderZip = require('folder-zip')
const json = require('./package.json')
const name = `${json.name}.${json.version}`
const sources = json.overture.sources
const files = sources.map(x => ({ source: x, target: x}) )

const folderZip = new FolderZip()
folderZip.batchAdd(files, () => folderZip.writeToFile(`${name}.zip`))