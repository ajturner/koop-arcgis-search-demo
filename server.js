const Koop = require('koop')
const arcgisSearch = require('./koop-provider-arcgis-search')
const config = require('config')

const koop = new Koop()
koop.register(arcgisSearch)

module.exports = koop.server
// koop.server.listen(1337)
