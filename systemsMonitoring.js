var https = require('https'); // require node's https package: https://nodejs.org/api/https.html
var diff = require('deep-diff'); // require deep-diff: https://www.npmjs.com/package/deep-diff

exports.handler = function(event, context) { // start Lambda handler

	var requestCount = 0; // defines total # of requests made
	var responseCount = 0; // defines total # of of responses back
	var rules; // define custom rules per item set in Systems Monitoring tool in Sitemason
	var storedJSONValueParsed; // will be stored value; left-hand-side origin when comparing differences
	var monitorResponseJSONParsed; // will be live monitor value; right-hand-side comparand when comparing differences

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

				var id 			= item.id; // unique ID assigned to the item by Sitemason in Systems Monitoring tool
				var name 		= item.title; // name given to item in Systems Monitoring tool
				var frequency 	= item.custom_field_1; // frequency monitor script should be run, set per item in the Systems Monitoring tool
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
//  			console.log('differences:',differences);

			rulesJSONParsed = JSON.parse(rules); // parse rules defined under storedRequest to JSON object

			for (var j=0; j < rulesJSONParsed.rules.length; j++) { // loop through rules
				
				var ruleName = rulesJSONParsed.rules[j].jsonBlock; // rule name set per item in the Systems Monitoring tool
				var message = rulesJSONParsed.rules[j].message; // rule message set per item in the Systems Monitoring tool
				var notificationType = rulesJSONParsed.rules[j].notificationType; // rule notification type (email, text, etc) set per item in the Systems Monitoring tool
				var priority = rulesJSONParsed.rules[j].priority; // rule priority set per item in the Systems Monitoring tool
				
				for (var k=0; k < differences.length; k++) { // loop through differences

					var kind = differences[k].kind; // indicates the kind of change; N = newly added property; D = property was deleted; E = property was edited; A = change occurred within array
					var expectedValue = differences[k].lhs; // the value on the left-hand-side of the comparison (undefined if kind === 'N')
					var responseValue = differences[k].rhs; // the value on the right-hand-side of the comparison (undefined if kind === 'D')

					var diffPath = differences[k].path; // the property path (from the left-hand-side root)
// 					console.log('differences[k].path:',differences[k].path);
					var diffSection = diffPath[0]; // name of the section that has changed
					
					if (ruleName == diffSection) {
						var ruleToMessage = rulesJSONParsed.rules[j];
						if (diffPath[1]) {
							ruleToMessage['jsonBlockValue'] = diffPath[1];
						}
// 						console.log('write message for:',diffSection + ' -> ' + diffSubSection);
// 						console.log('with rule:',rulesJSONParsed.rules[j]);
						messageToLog.push(ruleToMessage);
					} else {
// 						console.log('change detected, but no rule for:',diffSection + ' -> ' + diffSubSection);
					}
				}
				
			}
			
			console.log('messageToLog:',messageToLog);

			responseCount++; // iterates the # of responses on-end

			if (requestCount == responseCount) { // if requests equals responses, exit Lambda function
				context.succeed(true);	  
			}

		});			
	};

};