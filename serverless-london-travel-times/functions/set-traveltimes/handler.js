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
          Error: "Unable to create item. Error JSON:" + JSON.stringify(err, null, 2)
        });

      } else if (!Object.keys(data).length){
        // If this desintation does not already exist, go ahead and add it!
        var params = {
            TableName: table,
            Item:{
                "destination": event.destination,
                origins: event.origins
            }
        };

        docClient.put(params, function(err, data) {
            if (err) {
              return cb(null, {
                Error: "Unable to add item. Error JSON:" + JSON.stringify(err, null, 2)
              });

            } else {
              return cb(null, {message: "Successfully added item"});

            }
        });
    } else {
      return cb(null, {
        Error: "Unable to create item. It already exists."
      });
    }
  });
};
