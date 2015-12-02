#Lambda Monitor
Lambda Monitor is a Node.js script for AWS Lambda that compares two blocks of JSON to one another, and writes the differences to a DynamoDB database.
It's used by [Sitemason](http://www.sitemason.com) as a systems monitoring service to take expected values from scripts monitoring individual
services, and compare them to live output. Lambda Monitor is then to be paired with a notification service that reads from the DynamoDB database.

Includes the fantastic [aws-grunt-lambda](https://github.com/Tim-B/grunt-aws-lambda) plugin to make local Lambda development a breeze.

##Monitor Registry Using Sitemason
The service uses a custom Sitemason application to maintain the registry of monitors which outputs the expected monitor response along with rules for when they are different. The below details are pertinent only because they set the data model that the systemsMonitor.js script expects. 

Per `item` (or "monitor") in the registry, `custom_field_2` contains the expected JSON response for the matching monitor. In the example JSON below, a monitor called "mysql" tests whether a script (not included) can connect to a MySQL database, and do a handful of queries. Each monitor has fields for "name" (`title`), frequency (`custom_field_1`), hostname (`custom_field_3`), path (`custom_field_4`), and `custom_field_json` then contains the "rules" for how to handle notifications when the live output of the script does not match the `custom_field_2` JSON.

Each monitor is assigned a Realm and a Group. A Realm is a top-level grouping for a system environment, so you can have multiple monitors testing the same service in separate systems, like testing multiple MySQL databases with different hosts. A Group allows further categorization within a Realm, if for example there was one monitor testing MySQL connectivity, and another testing table integrity, etc. 

The rules dictate how notifications should be handled when a the JSON does not match. These rules are stored in `custom_field_json` and can contain multiple rules per monitor. The expected fields per rule are `name`, `notification type`, `priority`, `limit`, and `message`. 

The application should return JSON formatted like the below example for the comparisons to work:

###Example JSON from Sitemason application for MySQL Monitor
```json
{  
   "element":{  
      "item":[  
         {  
            "custom_field_1":"10",
            "custom_field_2":"{\"mysql\":{\"connect\":false,\"select\":true,\"insert\":true,\"update\":true,\"delete\":true,\"error\":false},\"pma\":{\"302-redirect\":true,\"redirect-location\":true,\"200-ok\":true,\"content-length\":true}}",
            "custom_field_3":"HOSTNAME",
            "custom_field_4":"PATH",
            "custom_field_json":"{\n\t\"rules\": [\n\t\t{\n\t\t\t\"message\": \"alert! changes to MySQL\",\n\t\t\t\"notificationType\": \"All\",\n\t\t\t\"priority\": \"1\",\n\t\t\t\"sectionName\": \"mysql\"\n\t\t}, {\n\t\t\t\"message\": \"something is wrong with PMA\",\n\t\t\t\"notificationType\": \"Feed\",\n\t\t\t\"priority\": \"2\",\n\t\t\t\"sectionName\": \"pma\"\n\t\t}\n\t]\n}",
            "id":"1734753",
            "tags_by_group":{  
               "group":[  
                  {  
                     "id":"899",
                     "name":"Groups",
                     "tags":{  
                        "tag":[  
                           {  
                              "name":"mysql"
                           }
                        ]
                     }
                  },
                  {  
                     "id":"898",
                     "name":"Realms",
                     "tags":{  
                        "tag":[  
                           {  
                              "name":"sitemason"
                           }
                        ]
                     }
                  }
               ]
            },
            "title":"mysql"
         }
      ]
   }
}
```
##Running

Run the Lambda script locally with the command `grunt lambda_invoke`, on the AWS CLI with:

```
$ aws lambda invoke \
--invocation-type {} \
--function-name ProcessKinesisRecords \
--region us-west-2 \
--payload file://file-path/input.txt \
--profile adminuser 
outputfile.txt
```

  or by selecting "Test" from Lambda within the AWS Console, the output should print something like the below for each monitor to the console:


```json
{ '1734753': 
   { name: 'mysql',
     dateTime: '12 Nov 2015 22:20:59',
     timestamp: 1447388459289,
     frequency: '10',
     group: 'mysql',
     realm: 'sitemason',
     url: 'https://www.sitemason.com/support/systems-monitoring/mysql.php',
     messages: { '0': [Object] },
     responseTimeMS: 891 } }
{}
```

And a row with the message object will be added to the DynamoDB database that looks something like this:

![Systemas Monitor DynamoDB Screenshot](http://www.sitemason.com/support/systems-monitoring/documentation/systems-monitor-dynamodb-screenshot.png)

