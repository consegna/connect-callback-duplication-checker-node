const fs = require('fs')

describe('Failure Tests for clear_handler', () => {
    const OLD_ENV = process.env;
    beforeEach(() => {
        jest.resetModules();
        process.env = { ...OLD_ENV };
    });

    afterAll(() => {
        process.env = OLD_ENV;
    });

    process.env.CALLBACKTABLE = "fakeTable";
    const handler = require('../index')

    test('Run Clear Handler No Empty Env Var', async () => {
        process.env.CALLBACKTABLE = null
        // Explicitly grab the handler here so the ENV var is UNSET
        const functionToTest = (require('../index')).clear_handler;
        await expect(functionToTest({}, null))
            .rejects
            .toThrow('Missing Required Environment Variable: CALLBACKTABLE');
    });

    test('Run Clear Handler No Parameters', async () => {
        let eventFile = fs.readFileSync('./events/bad_no_params.json');
        let event = JSON.parse(eventFile);
        let response = await handler.clear_handler(event, null);
        expect(response.result).toEqual('FAIL');
        expect(response.message).toEqual('ERROR_ENCOUNTERED');
        expect(response.duplicate).toBeFalsy();
    });
});

describe('Success Tests for clear_handler', () => {
    /*
    About Mocking: See 
    https://m-radzikowski.github.io/aws-sdk-client-mock/#dynamodb-documentclient
    */
    const { mockClient } = require('aws-sdk-client-mock');
    const {
        DynamoDBDocumentClient, GetCommand,
        DeleteCommand,
    } = require('@aws-sdk/lib-dynamodb');
    process.env.CALLBACKTABLE = "fakeTable";
    const handler = require('../index')
    const ddbMock = mockClient(DynamoDBDocumentClient);

    beforeEach(() => {
        ddbMock.reset();
    });

    test('Run Clear Handler No Entry', async () => {
        ddbMock.on(GetCommand, {
            TableName: 'fakeTable',
            Key: { 'callback_number': '+642101234567' },
        }).resolves({
            Item: undefined
        })
        let eventFile = fs.readFileSync('./events/good_all_content.json');
        let event = JSON.parse(eventFile);
        let response = await handler.clear_handler(event, null);
        expect(response.result).toEqual('SUCCESS');
        expect(response.message).toEqual('NO_ACTION');
    });

    test('Run Clear Handler Existing Entry', async () => {
        ddbMock.on(GetCommand, {
            TableName: 'fakeTable',
            Key: { 'callback_number': '+642101234567' },
        }).resolves({
            Item: {
                callback_number: "+642101234567",
                original_request_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
                created_at: 1637029856,
                ttl: 1637634656
            }
        })
        ddbMock.on(DeleteCommand, {
            TableName: 'fakeTable',
            Key: { 'callback_number': '+642101234567' },
        }).resolves({
            callback_number: "+642101234567",
            original_request_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
            created_at: 1637029856,
            ttl: 1637634656
        })
        let eventFile = fs.readFileSync('./events/good_all_content.json');
        let event = JSON.parse(eventFile);
        let response = await handler.clear_handler(event, null);
        expect(response.result).toEqual('SUCCESS');
        expect(response.message).toEqual('NUMBER_CLEARED');
    });
});