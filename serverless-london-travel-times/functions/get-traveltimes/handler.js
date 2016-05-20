var AWS = require("aws-sdk");
var docClient = new AWS.DynamoDB.DocumentClient()

AWS.config.update({
  region: "eu-west-1",
  endpoint: "http://localhost:8000"
});

module.exports.handler = function(event, context, cb) {
  var table = "london-stations";

  var params = {
    TableName:table,
    Key: {
        destination: event.destination,
    }
  };

  docClient.get(params, function(err, data) {
      if (err) {
        return cb(null, {
          Error: "Unable to read item. Error JSON:" + JSON.stringify(err, null, 2)
        });

      } else if (!Object.keys(data).length){
        return cb(null, {Error:"Destination not found"})
      } else {
        console.log(JSON.stringify(data))
        return cb(null, data);

      }
  });

};
