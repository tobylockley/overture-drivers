var SOURCES = {
    96: 'RGB',           // 0x60
    144: 'HDMI1',        // 0x90
    145: 'HDMI2',        // 0x91
    208: 'DisplayPort',  // 0xD0
    165: 'OPS/DVI'       // 0xA5
}

const VALS = [
    { name: 'RGB', value: 0x60 },
    { name: 'HDMI1', value: 0x90 },
    { name: 'HDMI2', value: 0x91 },
    { name: 'DisplayPort', value: 0xD0 },
    { name: 'OPS/DVI', value: 0xA5 }
]

let s = 'HDMI2'

// for (let key in SOURCES) {
//     console.log(key)
//     if (SOURCES[key] === s) console.log(key + ' = ' + s)
// }

console.log('----------------')

console.log(VALS.find(x => x.name === 'HDMI1'))

// SOURCES.forEach(x => {
//     console.log(x)
// });
