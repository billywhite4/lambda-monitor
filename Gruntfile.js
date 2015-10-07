var grunt = require('grunt');
grunt.loadNpmTasks('grunt-aws-lambda');

grunt.initConfig({
	lambda_invoke: {
		default: {
			options: {
				file_name: 'systemsMonitoring.js'
			}
		}
	},
	lambda_deploy: {
		default: {
			arn: 'arn:aws:lambda:us-west-2:986331161080:function:monitor_systemsMonitoring',
			options: {
				region: 'us-west-2'
			}
		}
	},
	lambda_package: {
		default: {
		}
	}
});

grunt.registerTask('deploy', ['lambda_package', 'lambda_deploy'])