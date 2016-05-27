
      var destinationToCheck = "London Eye, London"
      var apiURI = "https://9x05a3dbbk.execute-api.eu-west-1.amazonaws.com/prod/"
      var durationThreshold = 60
      var directionsService
      var stations
      var markers = {}
      var map;
      var searchRunning = false;
      var cancelSearch = false;
      var stationsArray = []
      var infoWindow
      $(document).ready(function(){
        $('#destinationToCheck').numeric()


      })

      function getUrlVars() {
        var vars = {};
        var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
          vars[key] = value;
        });
        return vars;
      }

      function toggleTrains(){
        trainsVisible = $('#includeTrains').is(":checked")

        stationsArray.forEach(function(stationName){
          var station = stations[stationName];
          console.log(station)
          if(!station.zone){
            markers[stationName].setVisible(trainsVisible);
          }
        })
      }

      var searchDestinationCommuteTimes = function(){
        destinationToCheck = $('#destinationToCheck').val();
        durationThreshold = $('#durationThreshold').val();

        // Change the destination pin colour to blue
        markers[destinationToCheck].setIcon('https://maps.google.com/mapfiles/ms/icons/blue-dot.png')

        // Set the search URL
        url = window.location.protocol + "//" +  window.location.hostname + window.location.pathname +
          "?destinationToCheck=" + encodeURIComponent(destinationToCheck) +
          "&durationThreshold=" + durationThreshold
        $('#searchUrl').val(url);
        $('#shareLinkFormGroup').css('display', 'inline');
        // Get origin durations from DynamoDB if we get
        $.getJSON(apiURI + '/get-traveltimes', {destination: destinationToCheck}, function(data){

          if(typeof(data.Error) != "undefined"){
            console.log(data.Error)

            // If we haven't got the destination already, clone the stations array and iterate through it
            clearSearch(function(){
              findStationsTravelTimes(stationsArray.slice(0),0)
            });
          }else{
            displayStationsTravelTimes(data.Item.origins)
          }

        })
      }

      function clearSearch(callback){
        if(searchRunning){
          console.log("A search is currently running, cancelling it and trying again in 2 seconds")
          cancelSearch = true
          setTimeout(function(){clearSearch(callback)},3000)
        }else{
          cancelSearch = false
          console.log("A search is not running, running callback")
          callback();
        }

      }


      function getStationsJSON(callback){
        // Fetch the list of stations
        $.getJSON("stations.json", function( response ) {
            stations = response

            stationsArray = []
            // generate an array of stations
            Object.keys(stations).forEach(function(stationName) {
               stationsArray.push(stationName)
            });

            $('#destinationToCheck').easyAutocomplete({
              data: stationsArray,
              list: {
            		match: {
            			enabled: true
            		}
            	}
           });
           callback();

        });
      }
      getStationsJSON(initMap)

      function displayStationsTravelTimes(stationTravelTimes){
        var unknownStationsArray = [];

        // Loop through each pre-populated station travel duration and bring it onto the map!
        for (var stationName in stations) {
          var station = stationTravelTimes[stationName]

          // We don't want to do anything with our destination pin
          if(stationName == destinationToCheck){
            continue
          }

          // Make sure it has the duration (otherwise add it to a list to be populated)
          if (stationTravelTimes.hasOwnProperty(stationName) && stationTravelTimes[stationName].hasOwnProperty("duration")) {

            // Create a tiny three-point polyline centring on the station to pass to RightMove
            var triCoords = [
              {lat: stations[stationName].lat, lng: stations[stationName].lng},
              {lat: stations[stationName].lat + 0.0001, lng: stations[stationName].lng + 0.0001},
              {lat: stations[stationName].lat - 0.0001, lng: stations[stationName].lng - 0.0001},
            ]
            var polyLine = new google.maps.Polyline({
              path: triCoords
            });
            var encodedPolyLine = google.maps.geometry.encoding.encodePath(polyLine.getPath());

            // Generate the rightMove URL
            var righMoveParams = {
              locationIdentifier: "USERDEFINEDAREA^{\"polylines\":\""+encodedPolyLine + "\"}",
              radius: 0.5
            }
            var rightMoveURL = "http://www.rightmove.co.uk/property-to-rent/map.html?"+ jQuery.param(righMoveParams)

            // Populate the node's info window
            var text = station.duration + " minutes from "  + stationName + " to " + destinationToCheck + '<br/>' +
                '<a href="' + rightMoveURL + '" target="_blank">RightMove for ' + stationName + ' + 0.5 miles</a>'
            mapinfoWindow(text, map, markers[stationName]);
            // Colour the node in accordance to our threshold
            if(station.duration < durationThreshold){
              markers[stationName].setIcon('https://maps.google.com/mapfiles/ms/icons/green-dot.png')
            }else{
              markers[stationName].setIcon('https://maps.google.com/mapfiles/ms/icons/red-dot.png')
            }
          }else{
              // add it to the unknownStationsArray if we don't know the travel duration to it
              unknownStationsArray.push(stationName)
          }
        }
        if(unknownStationsArray.length > 0){
          // Go out and find the unknown stations
          clearSearch(function(){
            findStationsTravelTimes(unknownStationsArray, 0)
          });

        }

      }

      function updateDynamoDB(stationsToAdd){

        $.post(apiURI+"/set-traveltimes", JSON.stringify({
            destination: destinationToCheck,
            origins: stationsToAdd
        }),function(response){
          console.log(response)
        }, "json" )
      }

      function sliceStations(unknownStationsArray,from,to){
        // Compile a list of the ten most recent stations
        var mostRecentStations = {}
        unknownStationsArray.slice(from,to).forEach(function(stationName, index){
          mostRecentStations[stationName] = stations[stationName]
        })
        return mostRecentStations
      }

      function findStationsTravelTimes(unknownStationsArray,index) {

        if(cancelSearch){
          console.log("Cancelling search due to cancelSearch flag being true")
          searchRunning = false;
          return
        }
        searchRunning = true;


        // If we've done all the stations, exit
        if(index >= unknownStationsArray.length){
          $('#progress').slideUp();

          updateDynamoDB(sliceStations(unknownStationsArray,index-10,index));
          searchRunning = false
          return
        }

        // Update DynamoDB with our findings every 10 results we find
        if(index > 0 && index % 10 == 0){
          updateDynamoDB(sliceStations(unknownStationsArray,index-10,index));
        }

        var stationName = unknownStationsArray[index]
        var origin = stations[stationName]
        var numKnownStations = (stationsArray.length - unknownStationsArray.length) + index;
        var percentageComplete = ((numKnownStations/stationsArray.length)*100)
        $('#progress').slideDown();
        $('#progressBar').css('width', percentageComplete + "%");
        $('#progressText').text(numKnownStations + ' of ' + stationsArray.length + ' stations')

        // Get the time of next monday at 9AM
        var arrivalTime = new Date();
        arrivalTime.setDate(arrivalTime.getDate() + (7-arrivalTime.getDay())%7+1)
        arrivalTime.setHours(9,0,0,0);

        // Get the duration of the trip from that source
        directionsService.route({
          origin: {lat: origin.lat,lng: origin.lng},
          destination: destinationToCheck,
          provideRouteAlternatives: true,
          travelMode: google.maps.TravelMode["TRANSIT"],
          transitOptions: {
            arrivalTime: arrivalTime
          }
        }, function(response, status) {

          var shortestRouteTime = 0;
          if (status == google.maps.DirectionsStatus.OK) {

            // Find the shortest total route time from all the legs
            response.routes.forEach(function(item, index){
              var curRouteTime = 0
              item.legs.map(function(obj){
                curRouteTime += obj.duration.value
              })
              if(shortestRouteTime == 0 || curRouteTime < shortestRouteTime){
                shortestRouteTime = curRouteTime
              }else{
              }
            })
            shortestRouteTimeMins = parseInt(shortestRouteTime/60)
            stations[stationName].duration = shortestRouteTimeMins

            // Populate the node's info window
            mapinfoWindow(shortestRouteTimeMins + " minutes from "  + stationName + " to " + destinationToCheck, map, markers[stationName])

            // Colour the node in accordance to our threshold
            if(shortestRouteTimeMins < durationThreshold){
              markers[stationName].setIcon('https://maps.google.com/mapfiles/ms/icons/green-dot.png')
            }else{
              markers[stationName].setIcon('https://maps.google.com/mapfiles/ms/icons/red-dot.png')
            }

            // Find the next station's duration in 2 seconds
            setTimeout(function(){findStationsTravelTimes(unknownStationsArray,index+1)}, 2000)
          } else {

            // Try again in 2 seconds
            console.log('Directions request failed due to ' + status);
            setTimeout(function(){findStationsTravelTimes(unknownStationsArray,index)}, 2000)
          }
        });
      }

      // Map an info window to a marker
      var mapinfoWindow = function(text, map, marker){

        marker.addListener('click', function() {
          infoWindow.setContent(text)
          infoWindow.open(map, marker);
        });

      }
      function populateMarkers(callback){

        Object.keys(stations).forEach(function(stationName){

          item = stations[stationName]
          var marker = new google.maps.Marker({
            position: {lat: item.lat, lng: item.lng},
            map: map,
            title: stationName,
            icon: 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png'
          });
          markers[stationName] = marker
        })
        callback();
      }
      function loadMarkers(callback){

        // reset the markers if they exist
        if(Object.keys(markers).length > 0){
          getStationsJSON(function(){

            Object.keys(markers).forEach(function(stationName, index){
              markers[stationName].setMap(null);
              if(index == Object.keys(markers).length -1){
                markers={}
                populateMarkers(callback);
              }
            })
          });
        }else{
          markers={}
          populateMarkers(callback);
        }
      }

      function initMap() {
        directionsService = new google.maps.DirectionsService;
        infoWindow = new google.maps.InfoWindow({
          content: ""
        });

        map = new google.maps.Map(document.getElementById('map'), {
          zoom: 10,
          center: {"lat":  51.528308,
          "lng":  -0.3817765}
        });

        // If there's a querystring variable, then populate fields as appropriate
        urlVars = getUrlVars();
        if(Object.keys(urlVars).length){
          ["durationThreshold", "destinationToCheck"].forEach(function(val, index){
            if(urlVars.hasOwnProperty(val)){
              $('#'+val).val(decodeURIComponent(urlVars[val]));
            }
          })
          loadMarkers(searchDestinationCommuteTimes);
        }
      }
