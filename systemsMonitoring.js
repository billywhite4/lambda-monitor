var https = require('https'); // require node's https package: https://nodejs.org/api/https.html
var diff = require('deep-diff'); // require deep-diff: https://www.npmjs.com/package/deep-diff

exports.handler = function(event, context) { // start Lambda handler

	var requestCount = 0; // defines total # of requests made
	var responseCount = 0; // defines total # of of responses back
	var rules; // define custom rules per item set in Systems Monitoring tool in Sitemason
	var storedJSONValueParsed; // will be stored value; left-hand-side origin when comparing differences
	var monitorResponseJSONParsed; // will be live monitor value; right-hand-side comparand when comparing differences
	var testResultToLog = {}; // the final message to be stored in logs
	var frequency = 0; // to be used to determine when a script should run based on the setting in the item of the Systems Monitoring tool in Sitemason

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

			for (var i=0; i < storedResponseJSONParsed.element.item.length; i++) { // loop through stored JSON to assign values to new vars

				var item = storedResponseJSONParsed.element.item[i]; // find items in JSON

				var currentDateTime = Date.now(); // current timestamp since epoch in milliseconds (divide by 1000 to get seconds!) 
				
				frequency		= item.custom_field_1;
				
				testResultToLog["id"] 			= item.id; // unique ID assigned to the item by Sitemason in Systems Monitoring tool
				testResultToLog["name"] 		= item.title; // name given to item in Systems Monitoring tool
				testResultToLog["dateTime"]		= timeConverter(currentDateTime/1000);
				testResultToLog["timestamp"]	= currentDateTime;
				testResultToLog["frequency"] 	= frequency; // frequency monitor script should be run, set per item in the Systems Monitoring tool

				var tags 		= item.tags_by_group; // tags set per item in the Systems Monitoring tool for group and realm
				var value 		= item.custom_field_2; // the expected JSON response value of the monitor script, stored in Systems Monitoring item
				var hostname	= item.custom_field_3; // hostname of the location of the monitor script, set per item in the Systems Monitoring tool
				var path 		= item.custom_field_4; // path to the location of the monitor script, set per item in the Systems Monitoring tool
				rules 			= item.custom_field_json; // rules setting the notification type, limits, priority, and message to detrmine the alert

				for (i=0; i < tags.group.length; i++) { // loop through the tags to set the Group and Realm per item in the Systems Monitoring tool
					if (tags.group[i].id == '899') { // Group
						var groupTag = tags.group[i].tags.tag[0].name;
					} else if (tags.group[i].id == '898') { // Realm
						var realmTag = tags.group[i].tags.tag[0].name;
					}
				}

				testResultToLog["group"] = groupTag; // assign group tag to testResultToLog
				testResultToLog["realm"] = realmTag; // assign realm tag to testResultToLog
				testResultToLog["url"] = 'https://'+hostname+path; // assign url to testResultToLog
			
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


	var monitorRequestFunction = function(monitorResponse) { // function to be passed to monitorRequest

		var monitorResponseJSON = ''; // will hold the response body from monitorRequest

		monitorResponse.setEncoding('utf8'); // set character encoding to utf-8

		monitorResponse.on('data', function(monitorResponseChunk) { // as data arrives, do stuff
			monitorResponseJSON += monitorResponseChunk; // concatenate response chunks from monitorRequest to build data object
		});

		monitorResponse.on('end', function() { // when response is complete, do stuff

			monitorResponseJSONParsed = JSON.parse(monitorResponseJSON); // convert response data to parsed JSON object

			var messageToLog = new Array();

 			var differences = diff(storedJSONValueParsed, monitorResponseJSONParsed); // JSON object storing differences between stored vs response JSON blocks
			differences = JSON.stringify(differences);
			differences = JSON.parse(differences);

			rulesJSONParsed = JSON.parse(rules); // parse rules defined under storedRequest to JSON object

			for (var j=0; j < differences.length; j++) { // loop through differences

				var kind = differences[j].kind; // indicates the kind of change; N = newly added property; D = property was deleted; E = property was edited; A = change occurred within array
				var expectedValue = differences[j].lhs; // the value on the left-hand-side of the comparison (undefined if kind === 'N')
				var responseValue = differences[j].rhs; // the value on the right-hand-side of the comparison (undefined if kind === 'D')

				var diffPath = differences[j].path; // the property path (from the left-hand-side root)
				var diffSectionName = diffPath[0]; // name of the section that has changed
					
				var match = false; // set boolean for logic to determine if a match is present

				var ruleWithMessage = {}; // object to build a rule with a custom message per item in the Systems Monitoring tool
				var ruleWithOutMessage = {}; // object to build a rule where differences are present, but doesn't match an item in the Systems Monitoring tool
				
				for (var k=0; k < rulesJSONParsed.rules.length; k++) { // loop through rules
				
					var ruleName = rulesJSONParsed.rules[k].sectionName; // rule name set per item in the Systems Monitoring tool
					var message = rulesJSONParsed.rules[k].message + ' Value equals "' + responseValue + '", while expected value is "' + expectedValue + '"'; // rule message set per item in the Systems Monitoring tool
					var notificationType = rulesJSONParsed.rules[k].notificationType; // rule notification type (email, text, etc) set per item in the Systems Monitoring tool
					var priority = rulesJSONParsed.rules[k].priority; // rule priority set per item in the Systems Monitoring tool
				
					if (diffSectionName == ruleName) { // if the name of the difference and name of the rule match, build the ruleWithMessage
					
						ruleWithMessage["name"] = ruleName; // set the sectionName to ruleWithMessage
						
						if (diffPath[1]) { // if a section has a sub-value, add it to ruleWithMessage
							ruleWithMessage['value'] = diffPath[1];
						}

						ruleWithMessage["message"] = message; // set the message to ruleWithMessage
						ruleWithMessage["notificationType"] = notificationType; // set the notificationType to ruleWithMessage
						ruleWithMessage["priority"] = priority; // set the priority to ruleWithMessage

						messageToLog.push(ruleWithMessage); // add ruleWithMessage to messageToLog array

						match = true; // set match to true in order to exit the loop
					}
				}
				
				if (match == false) { // if match = false, means the difference doesn't match a custom rule in the Systems Monitoring tool. Must build ruleWithOutMessage.

					ruleWithOutMessage["name"] = diffSectionName; // set the sectionName to ruleWithOutMessage

					if (diffPath[1]) { // if a section has a sub-value, add it to ruleWithOutMessage
						ruleWithOutMessage['value'] = diffPath[1];
					}

					ruleWithOutMessage['message'] = 'Value equals "' + responseValue + '", while expected value is "' + expectedValue + '"';  // set the message to ruleWithOutMessage

					messageToLog.push(ruleWithOutMessage); // add ruleWithOutMessage to messageToLog array
				}
				
			}
			
			testResultToLog["message"] = messageToLog; // add messageToLog to testResultToLog
			testResultToLogString = JSON.stringify(testResultToLog); // stringify testResultToLog

			console.log(testResultToLog); // print messageToLog to console

			responseCount++; // iterates the # of responses on-end

			if (requestCount == responseCount) { // if requests equals responses, exit Lambda function
				context.succeed(true);	  
			}

		});			
	};

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