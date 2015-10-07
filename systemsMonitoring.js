var https = require('https');

/**
 * Pass the data to send as `event.data`, and the request options as
 * `event.options`. For more information see the HTTPS module documentation
 * at https://nodejs.org/api/https.html.
 *
 * Will succeed with the response body.
 */
exports.handler = function(event, context) {
	var requestCount = 0;
	var responseCount = 0;

	var smReqFunction = function(smRes) {
	  var smResBody = '';
	  console.log("statusCode: ", smRes.statusCode);
	  console.log("headers: ", JSON.stringify(smRes.headers));

		smRes.on('data', function(smResChunk) {
			smResBody += smResChunk;
		});

		smRes.on('end', function() {
			console.log('Successfully processed HTTPS SMResponse');
			var smResBodyParsed;
			smResBodyParsed = JSON.parse(smResBody);
		
			console.log('smResBodyParsed',smResBodyParsed);
		});
			
	  responseCount++;
	  
	  if (requestCount == responseCount) {
		context.succeed(true);	  
	  }
	};

	var req = https.request({  hostname: 'www.sitemason.com', port: 443, path: '/site/i34wXC/systems-monitoring?tooljson', method: 'GET'}, function(res) {
		var body = '';
		console.log('Status:', res.statusCode);
		console.log('Headers:', JSON.stringify(res.headers));
		res.setEncoding('utf8');
		res.on('data', function(chunk) {
			body += chunk;
		});
		res.on('end', function() {
			console.log('Successfully processed HTTPS response');

			var bodyParsed;
			bodyParsed = JSON.parse(body);
		
			//console.log('Body:',bodyParsed);

			requestCount = bodyParsed.element.item.length;
			for (var i=0; i < bodyParsed.element.item.length; i++) {
				var item = bodyParsed.element.item[i];
				//console.log('Item:',item);

				var id 			= item.id;
				var name 		= item.title;
				var frequency 	= item.custom_field_1;
				var tags 		= item.tags_by_group;
				var value 		= item.custom_field_2;
				var rules 		= item.custom_field_json;
				var hostname	= item.custom_field_3;
				var path 		= item.custom_field_4;

				for (i=0; i < tags.group.length; i++) {
					if (tags.group[i].id == '899') { // Group
						var groupTag = tags.group[i].tags.tag[0].name;
					} else if (tags.group[i].id == '898') { // Realm
						var realmTag = tags.group[i].tags.tag[0].name;
					}
				}

				console.log('Item Output:',id + ' ' + name + ' ' + hostname + ' ' + path + ' ' + frequency + ' ' + groupTag + ' ' + realmTag);
				
				var options = {
				  hostname: hostname,
				  port: 443,
				  path: path,
				  method: 'GET'
				};

				var smReq = https.request({  hostname: hostname, port: 443, path: path, method: 'GET'}, smReqFunction);
				smReq.end();

				smReq.on('error', function(e) {
				  console.error(e);
				});

			}

            
        });
    });
    req.on('error', context.fail);
    req.write(JSON.stringify(event.data));
    req.end();
    
// 	function (err) {
// 	   if (err) {
// 		  msg = 'error: ' + err;
// 	   } else {
// 		  msg = 'Success';
// 	   }
// 	context.done(err, msg);
// 	}    
};