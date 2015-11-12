var grunt = require('grunt');
grunt.loadNpmTasks('grunt-aws-lambda');

grunt.initConfig({
	lambda_invoke: {
		default: {
			options: {
				file_name: '{lambda_file_name}'
			}
		}
	},
	lambda_deploy: {
		default: {
			arn: '{aws_arn}',
			options: {
				region: '{aws_region}'
			}
		}
	},
	lambda_package: {
		default: {
		}
	}
});

grunt.registerTask('deploy', ['lambda_package', 'lambda_deploy'])