/**
 * Converts a string to an object
 * ex: `{ parent: 'Hello', child: world }` => { parent: 'Hello', child: world }
 * Also accepts string without curly surrounding braces
 * ex: `parent: 'Hello', child: world` => { parent: 'Hello', child: world }
 * 
 * @param {*} s 
 * @param {*} point 
 * @return undefined if the string cannot be converted
 */
const stringToObject = (s,point) => {
  try {
    const withCurlyBraces = (s.match(/^\s*\{(.*)?\}\s*$/g)) ? `${s}` : `{${s}}`      
    return eval(`Object.assign({}, ${withCurlyBraces})`)
  } catch( err ) {
    // console.error(err)
  }
}

exports.stringToObject = stringToObject
