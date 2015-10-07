var https = require('https'); // require node's https package: https://nodejs.org/api/https.html
var diff = require('deep-diff'); // require deep-diff: https://www.npmjs.com/package/deep-diff

exports.handler = function(event, context) { // start Lambda handler

	var requestCount = 0; // defines total # of requests made
	var responseCount = 0; // defines total # of of responses back
	var storedJSONValueParsed; // will be stored value; left-hand-side origin when comparing differences
	var monitorResponseJSONParsed; // will be live monitor value; right-hand-side comparand when comparing differences

	var monitorRequestFunction = function(monitorResponse) { // function to be passed to monitorRequest

		var monitorResponseJSON = ''; // will hold the response body from monitorRequest

		monitorResponse.setEncoding('utf8'); // set character encoding to utf-8

		monitorResponse.on('data', function(monitorResponseChunk) { // as data arrives, do stuff
			monitorResponseJSON += monitorResponseChunk; // concatenate response chunks from monitorRequest to build data object
		});

		monitorResponse.on('end', function() { // when response is complete, do stuff

			monitorResponseJSONParsed = JSON.parse(monitorResponseJSON); // convert response data to parsed JSON object

 			var differences = diff(storedJSONValueParsed, monitorResponseJSONParsed); // compares stored vs response json blocks
 			console.log('differences:',differences); // prints results to the console

			responseCount++; // iterates the # of responses on-end

			if (requestCount == responseCount) { // if requests equals responses, exit Lambda function
				context.succeed(true);	  
			}

		});			
	};

	var storedRequestOptions = { // set options to pass to storedRequest; points to Sitemason.com tool (sitemason_site2) /support/apps/systems-monitoring
		hostname: 'www.sitemason.com',
		port: 443,
		path: '/site/i34wXC/systems-monitoring?tooljson',
		method: 'GET'
	};

	var storedRequest = https.request(storedRequestOptions, function(storedResponse) { // request to the Sitemason tool

		var storedResponseJSON = ''; // will hold the response body from storedRequest

		storedResponse.setEncoding('utf8'); // set character encoding to utf-8

		storedResponse.on('data', function(storedResponseChunk) { // as data arrives, do stuff
			storedResponseJSON += storedResponseChunk; // concatenate response chunks from storedRequest to build data object
		});

		storedResponse.on('end', function() { // when response is complete, do stuff

			var storedResponseJSONParsed; // define variable for parsed JSON of the stored request
			storedResponseJSONParsed = JSON.parse(storedResponseJSON); // convert response data to parsed JSON object

			requestCount = storedResponseJSONParsed.element.item.length; // determine # of requests for comparison with # of responses

			for (var i=0; i < storedResponseJSONParsed.element.item.length; i++) { // loop through stored JSON to assign values to new vars

				var item = storedResponseJSONParsed.element.item[i]; // find items in JSON

				var id 			= item.id; // unique ID assigned to the item by Sitemason in Systems Monitoring tool
				var name 		= item.title; // name given to item in Systems Monitoring tool
				var frequency 	= item.custom_field_1; // frequency monitor script should be run, set per item in the Systems Monitoring tool
				var tags 		= item.tags_by_group; // tags set per item in the Systems Monitoring tool for group and realm
				var value 		= item.custom_field_2; // the expected JSON response value of the monitor script, stored in Systems Monitoring item
				var rules 		= item.custom_field_json; // rules setting the notification type, limits, priority, and message to detrmine the alert
				var hostname	= item.custom_field_3; // hostname of the location of the monitor script, set per item in the Systems Monitoring tool
				var path 		= item.custom_field_4; // path to the location of the monitor script, set per item in the Systems Monitoring tool

				for (i=0; i < tags.group.length; i++) { // loop through the tags to set the Group and Realm per item in the Systems Monitoring tool
					if (tags.group[i].id == '899') { // Group
						var groupTag = tags.group[i].tags.tag[0].name;
					} else if (tags.group[i].id == '898') { // Realm
						var realmTag = tags.group[i].tags.tag[0].name;
					}
				}

				storedJSONValueParsed = JSON.parse(value); // convert response data to parsed JSON object

				var monitorRequestOptions = { // set options to pass to monitorRequest from the item stored in the Systems Monitoring tool
				  hostname: hostname,
				  port: 443,
				  path: path,
				  method: 'GET'
				};

				var monitorRequest = https.request(monitorRequestOptions, monitorRequestFunction); // request to the monitoring script

				monitorRequest.on('error', function(e) { // error handling for monitorRequest
					console.error(e);
				});

				monitorRequest.end(); // end monitorRequest
			}

            
        });
    });

    storedRequest.on('error', function(e) {  // error handling for storedRequest
		console.error(e);
	});

    storedRequest.end(); // end storedRequest
};