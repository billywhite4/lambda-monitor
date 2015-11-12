var AWS = require("aws-sdk"); // require AWS's SDK
var https = require('https'); // require node's https package: https://nodejs.org/api/https.html
var diff = require('deep-diff'); // require deep-diff: https://www.npmjs.com/package/deep-diff
var c = require('./smlib/common.js'); // require Tim Moses' common.js helper functions
var pv = require('private.js'); // includes private values excluded from public GitHub repo

AWS.config = { region: 'us-west-2' } // set AWS region for DynamoDB
var dynamodb = new AWS.DynamoDB(); // instantiate DynamoDB via AWSK SDK

exports.handler = function(event, context) { // start Lambda handler

	var requestCount = 0; // defines total # of requests made
	var responseCount = 0; // defines total # of of responses back
	var rules; // define custom rules per item set in Systems Monitoring tool in Sitemason
	var testResultToLog = {}; // the final message to be stored in logs
	var frequency = 0; // to be used to determine when a script should run based on the setting in the item of the Systems Monitoring tool in Sitemason
	var currentDateTime; // empty var to be set to current dateTime

	var storedRequestOptions = { // set options to pass to storedRequest; points to Sitemason.com tool /support/apps/systems-monitoring (sitemason_site2)
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

			for (var i=0; i < requestCount; i++) { // loop through stored JSON to assign values to new vars

				var item = storedResponseJSONParsed.element.item[i]; // find items in JSON

				currentDateTime = Date.now(); // current timestamp since epoch in milliseconds (divide by 1000 to get seconds!) 
				
				frequency		= item.custom_field_1; // frequency for which a monitor script should be run, set in the Systems Monitoring tool per item
				itemName		= item.title; // monitor script name, set in the Systems Monitoring tool per item
				itemId			= item.id; // id per monitor script, auto-set by Sitemason per item
				itemId			= itemId.toString(); // convert item id from number to string
				
				testResultToLog[itemId] = {}; // create object for storing sub-object to be logged
				
				testResultToLog[itemId]["name"] 		= itemName; // name given to item in Systems Monitoring tool
				testResultToLog[itemId]["dateTime"]		= timeConverter(currentDateTime/1000);
				testResultToLog[itemId]["timestamp"]	= currentDateTime;
				testResultToLog[itemId]["frequency"] 	= frequency; // frequency monitor script should be run, set per item in the Systems Monitoring tool

				var tags 		= item.tags_by_group; // tags set per item in the Systems Monitoring tool for group and realm
				var value 		= item.custom_field_2; // the expected JSON response value of the monitor script, stored in Systems Monitoring item
				var hostname	= item.custom_field_3; // hostname of the location of the monitor script, set per item in the Systems Monitoring tool
				var path 		= item.custom_field_4; // path to the location of the monitor script, set per item in the Systems Monitoring tool
				rules 			= item.custom_field_json; // rules setting the notification type, limits, priority, and message to detrmine the alert

				for (j=0; j < tags.group.length; j++) { // loop through the tags to set the Group and Realm per item in the Systems Monitoring tool
					if (tags.group[j].id === '899') { // Group
						var groupTag = tags.group[j].tags.tag[0].name;
					} else if (tags.group[j].id === '898') { // Realm
						var realmTag = tags.group[j].tags.tag[0].name;
					}
				}

				testResultToLog[itemId]["group"] = groupTag; // assign group tag to testResultToLog
				testResultToLog[itemId]["realm"] = realmTag; // assign realm tag to testResultToLog
				testResultToLog[itemId]["url"] = 'https://'+hostname+path; // assign url to testResultToLog
			
				var storedJSONValueParsed = JSON.parse(value); // convert response data to parsed JSON object

				var monitorRequestOptions = { // set options to pass to monitorRequest from the item stored in the Systems Monitoring tool
				  hostname: hostname,
				  port: 443,
				  path: path,
				  method: 'GET'
				};

				var startTime = Date.now(); // set start time of monitor script for use in comparing with endTime to determine total response time.

				var data = { // data to be passed through httpsRequest to monitorRequestFunction
					itemId: itemId,
					storedJSONValueParsed: storedJSONValueParsed,
					startTime: startTime
				};
				
				c.httpsRequest(monitorRequestOptions, monitorRequestFunction, data); // call to individual monitor script using common's c.httpsRequest
			}
        });
    });

    storedRequest.on('error', function(e) {  // error handling for storedRequest
		console.error(e);
	});

    storedRequest.end(); // end storedRequest


	var monitorRequestFunction = function(monitorResponse, output, data) { // function to be passed to monitorRequest
		
		// set variables local to this function through the "data" object
		var localItemId = data.itemId;
		localItemId = localItemId.toString();
		var localStoredJSONValueParsed = data.storedJSONValueParsed;
		var localStartTime = data.startTime;

		var monitorResponseJSON = ''; // will hold the response body from monitorRequest

		monitorResponseJSONParsed = JSON.parse(output); // convert response data to parsed JSON object

		var messageToLog = {}; // set var for messages object

		var differences = diff(localStoredJSONValueParsed, monitorResponseJSONParsed); // JSON object storing differences between stored vs response JSON blocks

		if(typeof(differences) != 'undefined'){ // check to make sure there are values in differences, if so build messagesToLog, else set to "No changes"

			rulesJSONParsed = JSON.parse(rules); // parse rules defined under storedRequest to JSON object

			for (var j=0; j < differences.length; j++) { // loop through differences

				var kind = differences[j].kind; // indicates the kind of change; N = newly added property; D = property was deleted; E = property was edited; A = change occurred within array
				var expectedValue = differences[j].lhs; // the value on the left-hand-side of the comparison (undefined if kind ==== 'N')
				var responseValue = differences[j].rhs; // the value on the right-hand-side of the comparison (undefined if kind ==== 'D')

				var diffPath = differences[j].path; // the property path (from the left-hand-side root)
				var diffSectionName = diffPath[0]; // name of the section that has changed
				
				var match = false; // set boolean for logic to determine if a match is present

				var ruleWithMessage = {}; // object to build a rule with a custom message per item in the Systems Monitoring tool
				var ruleWithOutMessage = {}; // object to build a rule where differences are present, but doesn't match an item in the Systems Monitoring tool
			
				if (diffPath[1]) { // determine section name to pass to "message" var
					var sectionForMessage = diffPath[1];
				} else {
					var sectionForMessage = diffSectionName;
				}
			
				for (var k=0; k < rulesJSONParsed.rules.length; k++) { // loop through rules
				
					var ruleName = rulesJSONParsed.rules[k].sectionName; // rule name set per item in the Systems Monitoring tool
					var message = rulesJSONParsed.rules[k].message + ' ' + sectionForMessage + ' equals "' + responseValue + '", while expected value is "' + expectedValue + '"'; // rule message set per item in the Systems Monitoring tool
					var notificationType = rulesJSONParsed.rules[k].notificationType; // rule notification type (email, text, etc) set per item in the Systems Monitoring tool
					var priority = rulesJSONParsed.rules[k].priority; // rule priority set per item in the Systems Monitoring tool
			
					if (diffSectionName === ruleName) { // if the name of the difference and name of the rule match, build the ruleWithMessage
				
						ruleWithMessage["name"] = ruleName; // set the sectionName to ruleWithMessage
					
						if (diffPath[1]) { // if a section has a sub-value, add it to ruleWithMessage
							ruleWithMessage['value'] = diffPath[1];
						}

						ruleWithMessage["message"] = message; // set the message to ruleWithMessage
						ruleWithMessage["notificationType"] = notificationType; // set the notificationType to ruleWithMessage
						ruleWithMessage["priority"] = priority; // set the priority to ruleWithMessage

						messageToLog[j] = ruleWithMessage; // add ruleWithMessage to messageToLog array
					
						match = true; // set match to true in order to exit the loop
					}
				}
			
				if (match === false) { // if match = false, means the difference doesn't match a custom rule in the Systems Monitoring tool. Must build ruleWithOutMessage.

					ruleWithOutMessage["name"] = diffSectionName; // set the sectionName to ruleWithOutMessage

					if (diffPath[1]) { // if a section has a sub-value, add it to ruleWithOutMessage
						ruleWithOutMessage['value'] = diffPath[1];
					}

					ruleWithOutMessage['message'] = sectionForMessage + ' equals "' + responseValue + '", while expected value is "' + expectedValue + '"';  // set the message to ruleWithOutMessage

					messageToLog[j] = ruleWithOutMessage; // add ruleWithOutMessage to messageToLog array
				}
			
			}
		} else {
			messageToLog = 'No changes.'; // if no differences, set messageToLog to "No changes."
		}
		
		testResultToLog[localItemId]["messages"] = messageToLog; // add messageToLog to testResultToLog

		var endTime = Date.now(); // set endTime to use as comparison to startTime to determine length of time each monitor script took to run. 		
		var responseTime = endTime - localStartTime; // subtracts startTime from endTime to come up with total responseTime
		
		testResultToLog[localItemId]["responseTimeMS"] = responseTime; // adds responseTime to output to be logged

		responseCount++; // iterates the # of responses on-end

		logID = currentDateTime.toString(); // current time in milliseconds since epoch as id to store in DynamoDB table

		if (requestCount === responseCount) { // if requests equals responses, exit Lambda function

			testResultToLogString = JSON.stringify(testResultToLog); // stringify testResultToLog
			testResultToLogParse = JSON.parse(testResultToLogString); // stringify testResultToLog

			console.log(testResultToLog); // print messageToLog to console

			var rightnow = timeConverter(currentDateTime/1000); // use timeConverter function to create human readable output for log

			var params = { // set parameters to log to DynamoDB
				TableName: 'monitor_logs',
				Item: {
					id: { N: logID }, // id key is current timestamp of milliseconds since epoch
					name: { S: rightnow }, // name is human readable dateTime
					log: { S: testResultToLogString } // final results to log
				}
			};

			dynamodb.putItem(params, function(err, data) {
				if (err) {
					console.log(err, err.stack); // an error occurred
					context.succeed(true);
				} else {
					console.log(data);           // successful response
					context.succeed(true);
				}
			});
		}

	};

	// function that converts unix timestamp into human readable format, from: http://stackoverflow.com/questions/847185/convert-a-unix-timestamp-to-time-in-javascript
	function timeConverter(UNIX_timestamp){
		var a = new Date(UNIX_timestamp * 1000);
		var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
		var year = a.getFullYear();
		var month = months[a.getMonth()];
		var date = a.getDate();
		var hour = a.getHours();
		var min = a.getMinutes();
		var sec = a.getSeconds();
		var time = date + ' ' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
		return time;
	}

};