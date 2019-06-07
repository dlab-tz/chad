module.exports = {
  getDataFromJSON (json, json_key) {
    let keys = Object.keys(json)
    if(json.hasOwnProperty(json_key)) {
      return json[json_key]
    } else {
      let key_found = keys.find((key) => {
        return key.endsWith('/' + json_key)
      })
      if(key_found) {
        return json[key_found]
      } else {
        return false
      }
    }
  }
}