const fs = require('fs')

// We grab the handler on each invocation to ensure we set 
// the ENV vars correctly, otherwise they always use the default

/*
TODO: Use Mocking Library to create appropriate mocking , such as
https://www.npmjs.com/package/aws-sdk-mock and
https://aws.amazon.com/blogs/developer/mocking-modular-aws-sdk-for-javascript-v3-in-unit-tests/
*/
describe('Failure Tests for set_handler', () => {
    const OLD_ENV = process.env;
    beforeEach(() => {
        jest.resetModules();
        process.env = { ...OLD_ENV };
    });

    afterAll(() => {
        process.env = OLD_ENV;
    });

    test('Run Set Handler No Empty Env Var', async () => {
        process.env.CALLBACKTABLE = null
        const functionToTest = (require('../index')).set_handler;
        await expect(functionToTest({}, null))
            .rejects
            .toThrow('Missing Required Environment Variable: CALLBACKTABLE');
    });

    test('Run Set Handler No Parameters', async () => {
        process.env.CALLBACKTABLE = "fakeTable";
        let eventFile = fs.readFileSync('./events/bad_no_params.json');
        let event = JSON.parse(eventFile);
        const functionToTest = (require('../index')).set_handler;
        let response = await functionToTest(event, null);
        expect(response.result).toEqual('FAIL');
        expect(response.message).toEqual('ERROR_ENCOUNTERED');
        expect(response.duplicate).toBeFalsy();
    });
});