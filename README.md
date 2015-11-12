#Synopsis
Lambda Monitor is a Node.js script on AWS Lambda that compares two blocks of JSON to one another, and writes the differences to a DynamoDB database. It's used by (Sitemason)[http://www.sitemason.com] as a systems monitoring service to take expected values from scripts monitoring individual services, and compare them to the live output. Lambda Monitor is then to be paired with a notification service that reads from the DynamoDb database.


