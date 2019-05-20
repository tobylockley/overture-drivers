
let val = 25

let ones
let tens
let hundreds

if (val == 0) {
  val = 1
}

if (val.toString().length == 3) {
  ones = val.toString().substring(2)
  tens = val.toString().substring(1, 2)
  hundreds = val.toString().substring(0, 1)
}
else if (val.toString().length == 2) {
  ones = val.toString().substring(1)
  tens = val.toString().substring(0, 1)
  hundreds = 0
}
else if (val.toString().length == 1) {
  ones = val
  tens = 0
  hundreds = 0
}
ones = parseInt(ones) + 48
tens = parseInt(tens) + 48
hundreds = parseInt(hundreds) + 48

console.log('hund ' + String.fromCharCode(hundreds))
console.log('tens ' + String.fromCharCode(tens))
console.log('ones ' + String.fromCharCode(ones))




let vals = Array.from(val.toString().padStart(3, '0')).map(char => char.charCodeAt(0))
console.log(vals)