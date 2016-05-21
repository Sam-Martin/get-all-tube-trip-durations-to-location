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



    } else {

      if (Object.keys(data).length){
        // if this destination already exists, merge the values
        origins = data.Item.origins
        message = "Successfully merged item"
      }else{
        // If this destination does not already exist, go ahead and add it!
        origins = {}
        message = "Successfully added item"
      }

      // Merge/Strip out empty origins
      for(var originName in event.origins){
        console.log("evaluating " + originName)
        if(Object.keys(event.origins[originName]).length){
          console.log("adding " + originName)
          origins[originName] = event.origins[originName]
        }
      }


      var params = {
          TableName: table,
          Item:{
              "destination": event.destination,
              origins: origins
          }
      };

      docClient.put(params, function(err, data) {
          if (err) {
            return cb(null, {
              Error: "Unable to add item. Error JSON:" + JSON.stringify(err, null, 2)
            });

          } else {
            return cb(null, {message: message});

          }
      });

    }
  });
};
