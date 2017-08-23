/*
  model.js

  This file is required. It must export a class with at least one public function called `getData`

  Documentation: http://koopjs.github.io/docs/specs/provider/
*/
const request = require('request-promise').defaults({gzip: true, json: true})
const config = require('config')
const _maxPageSize = 100;

function Model (koop) {}

function serializeQueryParams(params) {
  const str = []
  for (const param in params) {
    if (params.hasOwnProperty(param)) {
      let val = params[param]
      if (typeof val !== 'string') {
        val = JSON.stringify(val)
      }
      str.push(`${encodeURIComponent(param)}=${encodeURIComponent(val)}`)
    }
  }
  return str.join('&')
}

// This is the only public function you need to implement
Model.prototype.getData = function (req, callback) {
  const portal = "http://www.arcgis.com/sharing/rest/search"
  let query = {f: 'json'}
  query.q = req.query.where || '*'

  query.num = req.query.resultRecordCount || 10
  query.start = req.query.resultOffset || 1
  let orderBy = req.query.orderByFields
  if(orderBy !== undefined && orderBy !== null) {
    let orderByArr = orderBy.split(" ");
    query.sortField = orderByArr[0] || 'title'
    query.sortOrder = orderByArr[1] || 'DESC'
  }
  console.log("Query", `${portal}?${serializeQueryParams(query)}`)
  let url = `${portal}?${serializeQueryParams(query)}`

  const requests = []
  requests.push(request(url))

  // Multiple pages
  while(req.query.resultRecordCount > _maxPageSize && query.start < req.query.resultRecordCount) {
    query.start = parseInt(query.start) + _maxPageSize
    console.log("Query", `${portal}?${serializeQueryParams(query)}`)
    requests.push(request(`${portal}?${serializeQueryParams(query)}`))
  }
  console.log("Num Requests", requests.length)
    Promise.all(requests)
      .then((pages) => {
        // if (err) return callback(err)
        // translate the response into geojson

        console.log("Pages|", pages.length)
        const items = pages.reduce((collection, page) => {
          console.log("Putting page", page.results.length)
          return collection.concat(page.results)
        }, [])

        console.log("Items|", items.length)

        const geojson = translate(items)
        // Cache data for 10 seconds at a time by setting the ttl or "Time to Live"
        // geojson.ttl = 10
        geojson.metadata = { name: "ArcGIS Search" }
        geojson.filtersApplied = { where: true }

        geojson.metadata = {
          name: "Search", // Get the workbook name before ! symbol and set as layer name
          description: 'Collaborate in Google docs, analyse in ArcGIS',
          displayField: 'title',
          "fields": [
{
"name": "created",
"type": "esriFieldTypeDate",
"alias": "created",
"length": null,
"editable": false,
"nullable": true,
"domain": null
},
{
"name": "title",
"type": "esriFieldTypeString",
"alias": "title",
"length": null,
"editable": false,
"nullable": true,
"domain": null
},
{
"name": "extent",
"type": "esriFieldTypeString",
"alias": "extent",
"length": null,
"editable": false,
"nullable": true,
"domain": null
},
{
"name": "OBJECTID",
"type": "esriFieldTypeOID",
"alias": "ID",
"length": null,
"editable": false,
"nullable": false,
"domain": null
},{
"name": "typeKeywords",
"type": "esriFieldTypeString",
"alias": "typeKeywords",
"length": null,
"editable": false,
"nullable": true,
"domain": null
}
]
        }
        // hand off the data to Koop
        callback(null, geojson)
      })


}

function translate (input) {
  // console.log("translate", input)
  const features = {
    type: 'FeatureCollection',
    features: input.map(formatFeature),
    count: input.total
  }
  return features;
}

function formatFeature (vehicle) {
  // Most of what we need to do here is extract the longitude and latitude
  let ring = []
  if(vehicle.extent.length == 0) {
    vehicle.extent = [[0,0], [1,1]]
  }
  console.log("Vehicle", vehicle)
  ring.push([vehicle.extent[0][0], vehicle.extent[0][1]])
  ring.push([vehicle.extent[0][0], vehicle.extent[1][1]])
  ring.push([vehicle.extent[1][0], vehicle.extent[1][1]])
  ring.push([vehicle.extent[1][0], vehicle.extent[0][1]])
  ring.push([vehicle.extent[0][0], vehicle.extent[0][1]])
  console.log("Vehicle rings", ring)
  const feature = {
    type: 'Feature',
    properties: vehicle,
    geometry: {
      "type": "Polygon",
      "coordinates": [ring]
    }
  }
  // But we also want to translate a few of the date fields so they are easier to use downstream
  const dateFields = ['created', 'modified']
  dateFields.forEach(field => {
    feature.properties[field] = new Date(feature.properties[field]).toISOString()
  })
  return feature
}

module.exports = Model

/* Example raw API response
{
  "resultSet": {
  "queryTime": 1488465776220,
  "vehicle": [
    {
      "expires": 1488466246000,
      "signMessage": "Red Line to Beaverton",
      "serviceDate": 1488441600000,
      "loadPercentage": null,
      "latitude": 45.5873117,
      "nextStopSeq": 1,
      "source": "tab",
      "type": "rail",
      "blockID": 9045,
      "signMessageLong": "MAX  Red Line to City Center & Beaverton",
      "lastLocID": 10579,
      "nextLocID": 10579,
      "locationInScheduleDay": 24150,
      "newTrip": false,
      "longitude": -122.5927705,
      "direction": 1,
      "inCongestion": null,
      "routeNumber": 90,
      "bearing": 145,
      "garage": "ELMO",
      "tripID": "7144393",
      "delay": -16,
      "extraBlockID": null,
      "messageCode": 929,
      "lastStopSeq": 26,
      "vehicleID": 102,
      "time": 1488465767051,
      "offRoute": false
    }
  ]
}
*/
