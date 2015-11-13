#Lambda Monitor
Lambda Monitor is a Node.js script for AWS Lambda that compares two blocks of JSON to one another, and writes the differences to a DynamoDB database.
It's used by [Sitemason](http://www.sitemason.com) as a systems monitoring service to take expected values from scripts monitoring individual
services, and compare them to live output. Lambda Monitor is then to be paired with a notification service that reads from the DynamoDb database.

Includes the fantastic [aws-grunt-lambda](https://github.com/Tim-B/grunt-aws-lambda) plugin to make local Lambda development a breeze.

#Monitor Registry Using Sitemason
The service uses a custom Sitemason application to maintain the registry of monitors which defines JSON output with the following fields per monitor: name, frequency, hostname, path, and rules. Each rule additionally includes a name, notification type, priority, limit, and message. 

The application should return JSON formatted like the below example for the comparisons to work:

```json
{  
   "element":{  
      "item":[  
         {  
            "custom_field_1":"10",
            "custom_field_2":"{\"mysql\":{\"connect\":false,\"select\":true,\"insert\":true,\"update\":true,\"delete\":true,\"error\":false},\"pma\":{\"302-redirect\":true,\"redirect-location\":true,\"200-ok\":true,\"content-length\":true}}",
            "custom_field_3":"www.sitemason.com",
            "custom_field_4":"/support/systems-monitoring/mysql.php",
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

The value stored in custom_field_2 should match the live output of the script. 