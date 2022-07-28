# Consegna Connect Callback Number Duplication Preventor

This simple repo shows the concept of using a DynamoDB table to ensure duplicate callbacks are not lodged in order to improve both customer experience and remove the appearance of extra calls awaiting a callback but stopping them before they are already lodged. This is based on a previously created (but at time of creation `404'ing`) AWS solution that used that same principals. For simplcity and the fact a large amount of code is reused both handlers are bundled into the same repo, however splitting these apart should be a relatively trivial task

## Quick Start

Some sample events are included to show what the event from Connect looks like, as well as some Jest tests to show the outputs from them.
Simply add these Lambda functions to your Connect instance, add the function to a Contact Flow, and decide on a routing strategy based on the responses.
The current design uses the modular nature of the AWS Javascript SDK V3, which is not currently supplied in Lambda functions, so ensure the 2 listed AWS packages are bundled (or as below).

## Deploying to Lambda

Everything that should be needed to deploy a successful Lambda package is included.

To generate the package that can then be used:

0. For best experience build on a \*nix based computer, as this should ensure any OS specific packages are correctly obtained. You can run on any OS, but you may need further testing once deployed to be sure that there isn't any extra OS specific functionality that has been lost.
1. Run the regular `npm install` command to install all dependencies
2. Complete any updates or modifications as required. Be sure to add/alter any tests that would be impacted, as your packaging will fail otherwise.
3. Run the command `npm run package`. This will step through linting, unit tests, and finally generate a ZIP file. Note that if you use the inbuilt `pack` command you will get a `.tgz` file, which is not desired. You always want the `.zip` version.
4. Once satisfied upload the ZIP using your preferred method. Recommendation is to use an IaC control, such as CloudFormation or Terraform, but in the simplest case uploading the ZIP via the console should behave as expected. Note that there are 2 handlers (so 2 functions) that are of note here, `index.set_handler` and `index.clear_handler`. Both have slightly different permissions sets, if you are unsure refer to `CONTRACT.md`. _Importantly_, ensure the Environment variable `CALLBACKTABLE` is set with the name of the DynamoDB table you want to read and write to.
5. Test the deployment. You can use the content from `./events` as your test events as a representative example of your Contact Flow event
6. Wire it up to your Connect Contact Flow!

## Improving from here

As with many things you can take this in many different directions.

- You may seek to add Amazon X-Ray to get more deep dive analytics/traces.
- You should wrap this up in your IaC provider of choice and get everything deployed via your favourite CI/CD pipeline.
- Enhance testing further, including testing the (currently) unexported helper functions

Justin Susans, 2021
